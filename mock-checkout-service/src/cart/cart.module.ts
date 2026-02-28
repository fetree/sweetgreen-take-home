import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';

@Module({
  imports: [LoyaltyModule],
  providers: [CartResolver, CartService],
  exports: [CartService],
})
export class CartModule {}
