import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AppliedReward {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  code: string;

  @Field(() => String)
  rewardId: string;

  @Field(() => Int)
  discountCents: number;

  @Field(() => String)
  status: string;
}
