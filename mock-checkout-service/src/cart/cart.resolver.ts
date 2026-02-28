import { Inject } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CartService } from './cart.service';
import { Cart } from './models/cart.model';

@Resolver(() => Cart)
export class CartResolver {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @Query(() => Cart, { nullable: true, description: 'Get the active cart for a user' })
  cart(@Args('userId', { type: () => String }) userId: string) {
    return this.cartService.getCart(userId);
  }

  @Mutation(() => Cart, { description: 'Add a menu item to the cart' })
  addToCart(
    @Args('userId', { type: () => String }) userId: string,
    @Args('menuItemId', { type: () => String }) menuItemId: string,
    @Args('quantity', { type: () => Int, nullable: true, defaultValue: 1 }) quantity: number,
  ) {
    return this.cartService.addItem(userId, menuItemId, quantity);
  }

  @Mutation(() => Cart, { description: 'Remove an item from the cart' })
  removeFromCart(
    @Args('userId', { type: () => String }) userId: string,
    @Args('cartItemId', { type: () => String }) cartItemId: string,
  ) {
    return this.cartService.removeItem(userId, cartItemId);
  }

  @Mutation(() => Cart, { description: 'Update the quantity of a cart item' })
  updateCartItemQuantity(
    @Args('userId', { type: () => String }) userId: string,
    @Args('cartItemId', { type: () => String }) cartItemId: string,
    @Args('quantity', { type: () => Int }) quantity: number,
  ) {
    return this.cartService.updateItemQuantity(userId, cartItemId, quantity);
  }
}
