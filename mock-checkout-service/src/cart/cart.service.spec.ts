import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMenuItem = { id: 'menu-1', name: 'Harvest Bowl', priceCents: 1495, available: true };

const mockCart = {
  id: 'cart-1',
  userId: 'user-1',
  status: 'OPEN',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    { id: 'item-1', cartId: 'cart-1', menuItemId: 'menu-1', quantity: 2, menuItem: mockMenuItem },
  ],
  reward: null,
};

const mockPrisma = {
  client: {
    menuItem: { findFirst: jest.fn() },
    cart: { findFirst: jest.fn(), create: jest.fn() },
    cartItem: { update: jest.fn(), create: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
  },
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCart', () => {
    it('returns null when no open cart exists', async () => {
      mockPrisma.client.cart.findFirst.mockResolvedValue(null);
      expect(await service.getCart('user-1')).toBeNull();
    });

    it('returns a cart with computed totals', async () => {
      mockPrisma.client.cart.findFirst.mockResolvedValue(mockCart);
      const cart = await service.getCart('user-1');
      expect(cart?.subtotalCents).toBe(1495 * 2);
      expect(cart?.discountCents).toBe(0);
      expect(cart?.totalCents).toBe(1495 * 2);
    });
  });

  describe('addItem', () => {
    it('throws NotFoundException for unavailable menu item', async () => {
      mockPrisma.client.menuItem.findFirst.mockResolvedValue(null);
      await expect(service.addItem('user-1', 'bad-id', 1)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for quantity < 1', async () => {
      mockPrisma.client.menuItem.findFirst.mockResolvedValue(mockMenuItem);
      await expect(service.addItem('user-1', 'menu-1', 0)).rejects.toThrow(BadRequestException);
    });

    it('increments quantity when item already in cart', async () => {
      mockPrisma.client.menuItem.findFirst.mockResolvedValue(mockMenuItem);
      mockPrisma.client.cart.findFirst
        .mockResolvedValueOnce(mockCart)  // first findOpenCart
        .mockResolvedValueOnce(mockCart); // findOpenCartOrThrow
      mockPrisma.client.cartItem.update.mockResolvedValue({});

      await service.addItem('user-1', 'menu-1', 1);
      expect(mockPrisma.client.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 3 } }),
      );
    });
  });

  describe('removeItem', () => {
    it('throws NotFoundException when cart item not found', async () => {
      mockPrisma.client.cartItem.findFirst.mockResolvedValue(null);
      await expect(service.removeItem('user-1', 'bad-item')).rejects.toThrow(NotFoundException);
    });
  });
});
