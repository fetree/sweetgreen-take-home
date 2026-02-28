const express = require('express');
const crypto = require('crypto');

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
};

class SeededRandom {
  constructor(seed) {
    this.seed = seed ? this.hashCode(seed) : Date.now();
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  between(min, max) {
    return min + this.next() * (max - min);
  }

  intBetween(min, max) {
    return Math.floor(this.between(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(array) {
    return array[this.intBetween(0, array.length - 1)];
  }
}

const rng = new SeededRandom(null);
const redemptions = new Map();
const recentRedeemRequests = new Map();

const KNOWN_CODES = {
  'SAVE500': { valid: true, discountCents: 500, behavior: 'normal' },
  'SAVE1000': { valid: true, discountCents: 1000, behavior: 'normal' },
  'PERCENT20': { valid: true, discountPercent: 20, behavior: 'normal' },
  'EXPIRED2024': { valid: false, reason: 'expired', behavior: 'normal' },
  'USED_ALREADY': { valid: false, reason: 'already_redeemed', behavior: 'normal' },
  'MINIMUM50': { valid: true, discountCents: 1000, minCartTotal: 5000, behavior: 'normal' },
};

const FAILURE_TYPES = {
  validate: [
    { type: 'normal', weight: 70 },
    { type: 'slow', weight: 10 },
    { type: 'timeout', weight: 5 },
    { type: 'error_500', weight: 10 },
    { type: 'error_503', weight: 5 },
  ],
  redeem: [
    { type: 'normal', weight: 75 },
    { type: 'slow', weight: 5 },
    { type: 'error_500', weight: 10 },
    { type: 'ghost', weight: 5 },
    { type: 'race', weight: 5 },
  ],
};

function selectFailureType(endpoint) {
  const failures = FAILURE_TYPES[endpoint];
  const totalWeight = failures.reduce((sum, f) => sum + f.weight, 0);
  let random = rng.next() * totalWeight;
  for (const failure of failures) {
    random -= failure.weight;
    if (random <= 0) return failure.type;
  }
  return 'normal';
}

function generateRewardId(code, cartTotal) {
  const hash = crypto.createHash('sha256')
    .update(`${code}-${cartTotal}`)
    .digest('hex')
    .substring(0, 12);
  return `rwd_${hash}`;
}

function generateRedemptionId() {
  return `rdm_${crypto.randomBytes(6).toString('hex')}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.post('/validate', async (req, res) => {
  const { code, cartTotal } = req.body;

  if (!code || cartTotal === undefined) {
    return res.status(400).json({ error: 'missing_parameters' });
  }

  const knownCode = KNOWN_CODES[code?.toUpperCase()];
  const failureType = selectFailureType('validate');

  try {
    switch (failureType) {
      case 'slow':
        await delay(rng.intBetween(3000, 5000));
        break;
      case 'timeout':
        await delay(15000);
        return;
      case 'error_500':
        await delay(rng.intBetween(50, 200));
        return res.status(500).json({ error: 'internal_error' });
      case 'error_503':
        await delay(rng.intBetween(50, 200));
        res.header('Retry-After', '5');
        return res.status(503).json({ error: 'service_unavailable' });
      default:
        await delay(rng.intBetween(50, 200));
    }

    let response;

    if (!knownCode) {
      response = {
        valid: false,
        discountCents: 0,
        rewardId: null,
        reason: 'not_found',
      };
    } else if (!knownCode.valid) {
      response = {
        valid: false,
        discountCents: 0,
        rewardId: null,
        reason: knownCode.reason,
      };
    } else {
      if (knownCode.minCartTotal && cartTotal < knownCode.minCartTotal) {
        response = {
          valid: false,
          discountCents: 0,
          rewardId: null,
          reason: 'minimum_not_met',
        };
      } else {
        const discountCents = knownCode.discountPercent
          ? Math.floor(cartTotal * (knownCode.discountPercent / 100))
          : knownCode.discountCents;

        const rewardId = generateRewardId(code, cartTotal);
        const existingRedemption = redemptions.get(rewardId);
        
        if (existingRedemption?.status === 'redeemed') {
          response = {
            valid: false,
            discountCents: 0,
            rewardId: null,
            reason: 'already_redeemed',
          };
        } else {
          response = {
            valid: true,
            discountCents,
            rewardId,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          };
        }
      }
    }

    res.json(response);

  } catch (error) {
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/redeem', async (req, res) => {
  const { rewardId, orderId } = req.body;

  if (!rewardId || !orderId) {
    return res.status(400).json({ error: 'missing_parameters' });
  }

  const now = Date.now();
  const lastRequest = recentRedeemRequests.get(rewardId);
  const isRace = lastRequest && (now - lastRequest) < 100;
  recentRedeemRequests.set(rewardId, now);

  const failureType = selectFailureType('redeem');

  try {
    const existing = redemptions.get(rewardId);

    switch (failureType) {
      case 'slow':
        await delay(rng.intBetween(3000, 5000));
        break;
      case 'error_500':
        await delay(rng.intBetween(50, 200));
        return res.status(500).json({ error: 'internal_error' });
      case 'ghost':
        await delay(rng.intBetween(50, 200));
        if (!existing || existing.status !== 'redeemed') {
          redemptions.set(rewardId, {
            status: 'redeemed',
            redeemedAt: new Date().toISOString(),
            orderId,
            redemptionId: generateRedemptionId(),
          });
        }
        return res.status(500).json({ error: 'internal_error' });
      default:
        await delay(rng.intBetween(50, 200));
    }

    if (existing?.status === 'redeemed') {
      if (failureType === 'race' && isRace) {
        return res.json({
          success: true,
          redemptionId: generateRedemptionId(),
          redeemedAt: new Date().toISOString(),
        });
      }
      return res.json({
        success: false,
        error: 'already_redeemed',
      });
    }

    const redemptionId = generateRedemptionId();
    const redeemedAt = new Date().toISOString();

    redemptions.set(rewardId, {
      status: 'redeemed',
      redeemedAt,
      orderId,
      redemptionId,
    });

    res.json({
      success: true,
      redemptionId,
      redeemedAt,
    });

  } catch (error) {
    res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(config.port, () => {
  console.log(`Mock Loyalty Service running on port ${config.port}`);
});
