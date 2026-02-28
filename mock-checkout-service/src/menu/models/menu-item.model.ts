import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MenuItem {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Int)
  priceCents: number;

  @Field(() => Boolean)
  available: boolean;
}
