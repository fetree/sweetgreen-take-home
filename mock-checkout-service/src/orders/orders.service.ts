import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import {
  AmbiguousRedemptionError,
  LoyaltyService,
} from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { Order } from './models/order.model';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(AlertsService) private readonly alerts: AlertsService,
  ) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findOne(orderId: string): Promise<Order> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderModel(order);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async checkout(userId: string): Promise<Order> {
    // 1. Load the active cart with all details needed for checkout
    const cart = await this.prisma.client.cart.findFirst({
      where: { userId, status: 'OPEN' },
      include: {
        items: { include: { menuItem: true } },
        reward: true,
      },
    });

    if (!cart) throw new NotFoundException('No active cart found');
    if (cart.items.length === 0)
      throw new BadRequestException('Cannot checkout an empty cart');

    const subtotalCents = cart.items.reduce(
      (sum, i) => sum + i.menuItem.priceCents * i.quantity,
      0,
    );

    const hasReward = !!cart.reward;

    // 2. Atomically create the order and close the cart.
    //
    //    The order is created at full price (discountCents = 0). The discount is only
    //    applied after /redeem explicitly succeeds. This guarantees we never apply a
    //    discount that wasn't confirmed — the worst case is the customer sees full price
    //    until a background job reconciles an AMBIGUOUS status.
    const order = await this.prisma.client.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          cartId: cart.id,
          userId,
          subtotalCents,
          discountCents: 0,
          totalCents: subtotalCents,
          loyaltyStatus: hasReward ? 'PENDING' : 'NONE',
          items: {
            create: cart.items.map((item) => ({
              menuItemId: item.menuItemId,
              name: item.menuItem.name, // snapshot
              priceCents: item.menuItem.priceCents, // snapshot
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CHECKED_OUT' },
      });

      return newOrder;
    });

    // 3. Call /redeem outside the transaction — it's an external HTTP call that
    //    cannot participate in a DB transaction. The order already exists at this
    //    point; we only update its loyaltyStatus and totalCents based on the result.
    if (hasReward && cart.reward) {
      await this.processRedemption(order.id, subtotalCents, cart.reward);
    }

    return this.findOne(order.id);
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async processRedemption(
    orderId: string,
    subtotalCents: number,
    reward: { rewardId: string; discountCents: number },
  ): Promise<void> {
    try {
      const result = await this.loyalty.redeem(reward.rewardId, orderId);

      if (result.success) {
        // Confirmed — apply discount and record the redemptionId
        const discountCents = reward.discountCents;
        const totalCents = Math.max(0, subtotalCents - discountCents);

        await this.prisma.client.order.update({
          where: { id: orderId },
          data: {
            loyaltyStatus: 'REDEEMED',
            discountCents,
            totalCents,
            redemptionId: result.redemptionId,
          },
        });

        this.logger.log(
          `Order ${orderId} redeemed (${result.redemptionId}), saved $${(discountCents / 100).toFixed(2)}`,
        );
      } else {
        // Definitive failure (e.g. already_redeemed) — charge full price
        await this.prisma.client.order.update({
          where: { id: orderId },
          data: { loyaltyStatus: 'FAILED' },
        });

        this.logger.warn(`Order ${orderId} redemption failed: ${result.error}`);
      }
    } catch (err: any) {
      if (err instanceof AmbiguousRedemptionError) {
        // /redeem returned 500 or timed out.
        //
        // This is the ghost-error scenario: the loyalty service may have already
        // recorded the redemption on their side despite the error response. We
        // CANNOT retry blindly — that risks a double-redemption. Instead we mark
        // the order AMBIGUOUS and withhold the discount until a background job
        // confirms the outcome using the redemptionId as an idempotency anchor.
        await this.prisma.client.order.update({
          where: { id: orderId },
          data: { loyaltyStatus: 'AMBIGUOUS' },
        });

        this.logger.warn(
          `Order ${orderId} has ambiguous redemption status. ` +
            `Background reconciliation required. Cause: ${err.cause}`,
        );
        this.alerts.critical(
          'Ambiguous loyalty redemption — manual reconciliation required',
          {
            orderId,
            rewardId: err.rewardId,
            cause: err.cause,
          },
        );
      } else {
        // Network failure — request never reached the loyalty service.
        // Safe to mark as FAILED and charge full price.
        await this.prisma.client.order.update({
          where: { id: orderId },
          data: { loyaltyStatus: 'FAILED' },
        });

        this.logger.error(
          `Order ${orderId} redemption unreachable: ${err.message}`,
        );
        this.alerts.warn('Loyalty service unreachable during redemption', {
          orderId,
          error: err.message,
        });
      }
    }
  }

  private toOrderModel(
    order: Awaited<ReturnType<typeof this.prisma.client.order.findUnique>> & {
      items: {
        id: string;
        menuItemId: string | null;
        name: string;
        priceCents: number;
        quantity: number;
      }[];
    },
  ): Order {
    return {
      id: order.id,
      cartId: order.cartId,
      userId: order.userId,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      redemptionId: order.redemptionId ?? undefined,
      loyaltyStatus: order.loyaltyStatus,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId ?? undefined,
        name: item.name,
        priceCents: item.priceCents,
        quantity: item.quantity,
        lineCents: item.priceCents * item.quantity,
      })),
      createdAt: order.createdAt,
    };
  }
}
