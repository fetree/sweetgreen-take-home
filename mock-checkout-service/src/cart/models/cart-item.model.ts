import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  menuItemId: string;

  @Field(() => String)
  name: string;

  @Field(() => Int)
  priceCents: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => Int)
  lineCents: number; // priceCents * quantity
}
