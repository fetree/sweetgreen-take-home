import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AmbiguousRedemptionError, LoyaltyService } from '../loyalty/loyalty.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const menuItem = { id: 'menu-1', name: 'Harvest Bowl', priceCents: 1495, available: true };

const cartItem = { id: 'ci-1', cartId: 'cart-1', menuItemId: 'menu-1', quantity: 2, menuItem };

const openCart = {
  id: 'cart-1',
  userId: 'user-1',
  status: 'OPEN',
  items: [cartItem],
  reward: null,
};

const openCartWithReward = {
  ...openCart,
  reward: {
    id: 'rwd-app-1',
    cartId: 'cart-1',
    code: 'SAVE500',
    rewardId: 'rwd_abc123',
    discountCents: 500,
    status: 'PENDING',
    appliedAt: new Date(),
  },
};

const createdOrder = {
  id: 'order-1',
  cartId: 'cart-1',
  userId: 'user-1',
  subtotalCents: 2990,
  discountCents: 0,
  totalCents: 2990,
  loyaltyStatus: 'NONE',
  redemptionId: null,
  createdAt: new Date(),
  items: [
    { id: 'oi-1', orderId: 'order-1', menuItemId: 'menu-1', name: 'Harvest Bowl', priceCents: 1495, quantity: 2 },
  ],
};

// ─── Mock factories ────────────────────────────────────────────────────────────

function makePrismaMock(overrides: Partial<any> = {}) {
  const tx = {
    order: { create: jest.fn().mockResolvedValue(createdOrder) },
    cart: { update: jest.fn().mockResolvedValue({}) },
  };

  return {
    client: {
      cart: { findFirst: jest.fn() },
      order: {
        findUnique: jest.fn().mockResolvedValue(createdOrder),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
      ...overrides,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;
  let mockPrisma: ReturnType<typeof makePrismaMock>;
  let mockLoyalty: { validate: jest.Mock; redeem: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = makePrismaMock();
    mockLoyalty = { validate: jest.fn(), redeem: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoyaltyService, useValue: mockLoyalty },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ─── Guard rails ────────────────────────────────────────────────────────

  it('throws NotFoundException when no active cart exists', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue(null);
    await expect(service.checkout('user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when cart is empty', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue({ ...openCart, items: [] });
    await expect(service.checkout('user-1')).rejects.toThrow(BadRequestException);
  });

  // ─── Happy path — no reward ──────────────────────────────────────────────

  it('creates order with loyaltyStatus NONE when no reward is applied', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue(openCart);

    const order = await service.checkout('user-1');

    expect(mockPrisma.client.$transaction).toHaveBeenCalled();
    expect(mockLoyalty.redeem).not.toHaveBeenCalled();
    expect(order.loyaltyStatus).toBe('NONE');
    expect(order.discountCents).toBe(0);
  });

  // ─── Happy path — reward redeemed ───────────────────────────────────────

  it('applies discount and sets REDEEMED when /redeem succeeds', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue(openCartWithReward);
    mockLoyalty.redeem.mockResolvedValue({ success: true, redemptionId: 'rdm_xyz' });

    await service.checkout('user-1');

    expect(mockPrisma.client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loyaltyStatus: 'REDEEMED',
          discountCents: 500,
          totalCents: 2490,
          redemptionId: 'rdm_xyz',
        }),
      }),
    );
  });

  // ─── Redeem definitive failure ───────────────────────────────────────────

  it('sets FAILED and charges full price when /redeem returns success: false', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue(openCartWithReward);
    mockLoyalty.redeem.mockResolvedValue({ success: false, error: 'already_redeemed' });

    await service.checkout('user-1');

    expect(mockPrisma.client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { loyaltyStatus: 'FAILED' } }),
    );
  });

  // ─── Redeem 500 / timeout — ambiguous ───────────────────────────────────

  it('sets AMBIGUOUS and withholds discount when /redeem throws AmbiguousRedemptionError', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue(openCartWithReward);
    mockLoyalty.redeem.mockRejectedValue(
      new AmbiguousRedemptionError('rwd_abc123', 'order-1', 'HTTP 500'),
    );

    // Order is still created — checkout does not throw
    await expect(service.checkout('user-1')).resolves.toBeDefined();

    expect(mockPrisma.client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { loyaltyStatus: 'AMBIGUOUS' } }),
    );
  });

  it('sets FAILED when loyalty service is completely unreachable', async () => {
    mockPrisma.client.cart.findFirst.mockResolvedValue(openCartWithReward);
    mockLoyalty.redeem.mockRejectedValue(
      new ServiceUnavailableException('Loyalty service unreachable'),
    );

    await expect(service.checkout('user-1')).resolves.toBeDefined();

    expect(mockPrisma.client.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { loyaltyStatus: 'FAILED' } }),
    );
  });
});
