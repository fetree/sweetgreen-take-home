import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OrdersService } from './orders.service';
import { Order } from './models/order.model';

@Resolver(() => Order)
export class OrdersResolver {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Query(() => Order, { description: 'Retrieve a placed order by ID' })
  order(@Args('orderId', { type: () => String }) orderId: string) {
    return this.ordersService.findOne(orderId);
  }

  @Mutation(() => Order, { description: 'Checkout the active cart and create an order' })
  checkout(@Args('userId', { type: () => String }) userId: string) {
    return this.ordersService.checkout(userId);
  }
}
