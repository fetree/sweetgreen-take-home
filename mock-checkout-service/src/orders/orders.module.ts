import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OrdersResolver } from './orders.resolver';
import { OrdersService } from './orders.service';

@Module({
  imports: [LoyaltyModule],
  providers: [OrdersResolver, OrdersService],
})
export class OrdersModule {}
