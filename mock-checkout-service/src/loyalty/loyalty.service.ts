import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';

export type ValidateResult =
  | { valid: true; discountCents: number; rewardId: string; expiresAt: string }
  | { valid: false; reason: string };

export type RedeemResult =
  | { success: true; redemptionId: string }
  | { success: false; error: string };

/**
 * Thrown when /redeem returns a 500 or times out.
 *
 * A 500 from /redeem is AMBIGUOUS — the loyalty service has a "ghost" failure
 * mode where it records the redemption successfully but still returns 500.
 * A timeout is equally ambiguous: the request may have been processed before
 * the connection dropped.
 *
 * Callers must NOT assume the redemption failed. The order should be completed
 * with loyaltyStatus = AMBIGUOUS and the discount applied, pending reconciliation.
 */
export class AmbiguousRedemptionError extends Error {
  constructor(
    public readonly rewardId: string,
    public readonly orderId: string,
    public readonly cause: string,
  ) {
    super(`Redemption outcome unknown for reward ${rewardId} on order ${orderId}: ${cause}`);
    this.name = 'AmbiguousRedemptionError';
  }
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);
  private readonly baseUrl: string;
  private readonly validateTimeoutMs = 5_000;
  private readonly redeemTimeoutMs = 10_000;

  constructor() {
    this.baseUrl = process.env.LOYALTY_SERVICE_URL ?? 'http://localhost:3001';
  }

  async validate(code: string, cartTotal: number): Promise<ValidateResult> {
    // /validate is a read-only check — safe to throw on any error
    return this.post<ValidateResult>('/validate', { code, cartTotal }, this.validateTimeoutMs);
  }

  async redeem(rewardId: string, orderId: string): Promise<RedeemResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.redeemTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId, orderId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // 500 from /redeem is ambiguous: the mock service has a ghost mode that
        // redeems successfully then returns 500. Treat all 5xx as ambiguous.
        this.logger.warn(`/redeem returned ${response.status} for reward ${rewardId} — ambiguous`);
        throw new AmbiguousRedemptionError(rewardId, orderId, `HTTP ${response.status}`);
      }

      return response.json() as Promise<RedeemResult>;
    } catch (err: any) {
      if (err instanceof AmbiguousRedemptionError) throw err;

      if (err.name === 'AbortError') {
        // Timeout is also ambiguous — request may have reached the service
        this.logger.warn(`/redeem timed out for reward ${rewardId} — ambiguous`);
        throw new AmbiguousRedemptionError(rewardId, orderId, 'timeout');
      }

      // Network-level failure before the request landed — safe to treat as not redeemed
      this.logger.error(`/redeem unreachable for reward ${rewardId}: ${err.message}`);
      throw new ServiceUnavailableException('Loyalty service unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async post<T>(path: string, body: object, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`Loyalty service ${path} returned ${response.status}`);
        throw new ServiceUnavailableException(`Loyalty service unavailable (${response.status})`);
      }

      return response.json() as Promise<T>;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;

      if (err.name === 'AbortError') {
        this.logger.warn(`Loyalty service ${path} timed out after ${timeoutMs}ms`);
        throw new ServiceUnavailableException('Loyalty service timed out');
      }

      this.logger.error(`Loyalty service ${path} failed: ${err.message}`);
      throw new ServiceUnavailableException('Loyalty service unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
}
