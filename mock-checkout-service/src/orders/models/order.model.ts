import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { OrderItem } from './order-item.model';

@ObjectType()
export class Order {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  cartId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  subtotalCents: number;

  @Field(() => Int)
  discountCents: number;

  @Field(() => Int)
  totalCents: number;

  @Field(() => String, { nullable: true })
  redemptionId?: string;

  /**
   * NONE       — no reward was applied
   * PENDING    — redeem call is in-flight or the result is unknown (start state for reward carts)
   * REDEEMED   — loyalty service confirmed redemption; discount applied to totalCents
   * FAILED     — loyalty service definitively rejected; full price charged
   * AMBIGUOUS  — /redeem returned 500 or timed out; outcome unknown, discount withheld
   *              pending background reconciliation
   */
  @Field(() => String)
  loyaltyStatus: string;

  @Field(() => [OrderItem])
  items: OrderItem[];

  @Field(() => String)
  createdAt: Date;
}
