import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cart } from './models/cart.model';

@Injectable()
export class CartService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async getCart(userId: string): Promise<Cart | null> {
    const cart = await this.findOpenCart(userId);
    if (!cart) return null;
    return this.toCartModel(cart);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async addItem(
    userId: string,
    menuItemId: string,
    quantity: number,
  ): Promise<Cart> {
    const menuItem = await this.prisma.client.menuItem.findFirst({
      where: { id: menuItemId, available: true },
    });
    if (!menuItem)
      throw new NotFoundException('Menu item not found or unavailable');
    if (quantity < 1)
      throw new BadRequestException('Quantity must be at least 1');

    // Find or create an open cart for this user
    let cart = await this.findOpenCart(userId);
    if (!cart) {
      cart = await this.prisma.client.cart.create({
        data: { userId },
        include: this.cartInclude(),
      });
    }

    const existing = cart.items.find((i) => i.menuItemId === menuItemId);
    if (existing) {
      await this.prisma.client.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await this.prisma.client.cartItem.create({
        data: { cartId: cart.id, menuItemId, quantity },
      });
    }

    return this.toCartModel(await this.findOpenCartOrThrow(userId));
  }

  async removeItem(userId: string, cartItemId: string): Promise<Cart> {
    const cartItem = await this.prisma.client.cartItem.findFirst({
      where: { id: cartItemId, cart: { userId, status: 'OPEN' } },
    });
    if (!cartItem) throw new NotFoundException('Cart item not found');

    await this.prisma.client.cartItem.delete({ where: { id: cartItemId } });

    return this.toCartModel(await this.findOpenCartOrThrow(userId));
  }

  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    quantity: number,
  ): Promise<Cart> {
    if (quantity < 1)
      throw new BadRequestException('Quantity must be at least 1');

    const cartItem = await this.prisma.client.cartItem.findFirst({
      where: { id: cartItemId, cart: { userId, status: 'OPEN' } },
    });
    if (!cartItem) throw new NotFoundException('Cart item not found');

    await this.prisma.client.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });

    return this.toCartModel(await this.findOpenCartOrThrow(userId));
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private cartInclude() {
    return {
      items: { include: { menuItem: true } },
      reward: true,
    } as const;
  }

  private findOpenCart(userId: string) {
    return this.prisma.client.cart.findFirst({
      where: { userId, status: 'OPEN' },
      include: this.cartInclude(),
    });
  }

  private async findOpenCartOrThrow(userId: string) {
    const cart = await this.findOpenCart(userId);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  toCartModel(
    cart: Awaited<ReturnType<CartService['findOpenCart']>> & {},
  ): Cart {
    const items = cart.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      priceCents: item.menuItem.priceCents,
      quantity: item.quantity,
      lineCents: item.menuItem.priceCents * item.quantity,
    }));

    const subtotalCents = items.reduce((sum, i) => sum + i.lineCents, 0);
    const discountCents = cart.reward?.discountCents ?? 0;
    const totalCents = Math.max(0, subtotalCents - discountCents);

    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      items,
      subtotalCents,
      discountCents,
      totalCents,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
