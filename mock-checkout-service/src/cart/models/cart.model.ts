import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { CartItem } from './cart-item.model';

@ObjectType()
export class Cart {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  status: string;

  @Field(() => [CartItem])
  items: CartItem[];

  @Field(() => Int)
  subtotalCents: number;

  @Field(() => Int)
  discountCents: number;

  @Field(() => Int)
  totalCents: number;

  @Field(() => String)
  createdAt: Date;

  @Field(() => String)
  updatedAt: Date;
}
