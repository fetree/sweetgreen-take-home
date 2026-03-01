import {
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';

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
    super(
      `Redemption outcome unknown for reward ${rewardId} on order ${orderId}: ${cause}`,
    );
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
    return this.post<ValidateResult>(
      '/validate',
      { code, cartTotal },
      this.validateTimeoutMs,
    );
  }

  /**
   * @SEE AmbiguousRedemptionError (above)
   * What happens if a customer applies a reward, then the service is down at
   * checkout?
   * 5xx and timeouts are treated as AMBIGUOUS, not FAILED, because the loyalty
   * service has a ghost failure mode — it may have recorded the redemption and
   * still returned 500. Marking FAILED would risk allowing a double redemption.
   * If this were a real project, discount is withheld until a background
   * job confirms the outcome.
   */

  /**
   * @SEE What if `/redeem` times out—do you complete the order?
   * With or without the discount?
   * I complete the order without the discount. I had 2 outcomes that I had in mind
   * with this decision.
   * 1 - The background job will reward the customer with their next order or give
   * credit they can use for their next order.
   * 2 - If the customer calls support before their order they can query our DB
   * (with an internal tool of course) to find their order and see it's ambiguous
   * and resolve their error and give credit.
   * I considered the opposite, where we give credit no matter what, and this would
   * keep the customers very happy. But if the loyalty rewards were given out so
   * easily, we would lose customer satisfaction by taking away money, which is
   * "scam-like" behavior, or lose money by just accepting all rewards.
   */

  /**
   * @SEE How do you avoid charging full price if the discount was already
   * shown in the cart?
   * Unfortunately, this has to be shown to the user with a toast: "Unfortunately,
   * we could not apply your loyalty code at the moment. Please give us a moment to
   * reconcile your loyalty reward or reach out to our support team".
   * So the backend will notify the frontend that it's AMBIGUOUS and communicate to
   * the user accordingly.
   */

  /**
   * @SEE - What if two concurrent checkouts try to use the same reward?
   * In the case of this
   */

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
        this.logger.warn(
          `/redeem returned ${response.status} for reward ${rewardId} — ambiguous`,
        );
        throw new AmbiguousRedemptionError(
          rewardId,
          orderId,
          `HTTP ${response.status}`,
        );
      }

      return response.json() as Promise<RedeemResult>;
    } catch (err: any) {
      if (err instanceof AmbiguousRedemptionError) throw err;

      if (err.name === 'AbortError') {
        // Timeout is also ambiguous — request may have reached the service
        this.logger.warn(
          `/redeem timed out for reward ${rewardId} — ambiguous`,
        );
        throw new AmbiguousRedemptionError(rewardId, orderId, 'timeout');
      }

      // Network-level failure before the request landed — safe to treat as not redeemed
      this.logger.error(
        `/redeem unreachable for reward ${rewardId}: ${err.message}`,
      );
      throw new ServiceUnavailableException('Loyalty service unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async post<T>(
    path: string,
    body: object,
    timeoutMs: number,
  ): Promise<T> {
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
        throw new ServiceUnavailableException(
          `Loyalty service unavailable (${response.status})`,
        );
      }

      return response.json() as Promise<T>;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;

      if (err.name === 'AbortError') {
        this.logger.warn(
          `Loyalty service ${path} timed out after ${timeoutMs}ms`,
        );
        throw new ServiceUnavailableException('Loyalty service timed out');
      }

      this.logger.error(`Loyalty service ${path} failed: ${err.message}`);
      throw new ServiceUnavailableException('Loyalty service unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
}
