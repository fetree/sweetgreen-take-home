import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Query(() => String, { description: 'Health check' })
  health(): string {
    return this.healthService.getHealth();
  }
}
