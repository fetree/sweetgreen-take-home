import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  menuItemId?: string;

  @Field(() => String)
  name: string;

  @Field(() => Int)
  priceCents: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => Int)
  lineCents: number;
}
