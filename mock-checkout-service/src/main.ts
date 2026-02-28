import 'reflect-metadata';

// tsx uses esbuild which doesn't emit decorator metadata. NestJS GraphQL reads
// `design:paramtypes` before checking for explicit type functions, crashing when
// it gets `undefined` instead of an array. Returning `[]` makes it fall through
// to the explicit `type: () => X` provided on every @Args/@Field decorator.
const _getMetadata = Reflect.getMetadata.bind(Reflect);
Reflect.getMetadata = (key: string, target: any, propertyKey?: any) => {
  const result = _getMetadata(key, target, propertyKey);
  if (
    key === 'design:paramtypes' &&
    result === undefined &&
    propertyKey !== undefined
  ) {
    return [];
  }
  return result;
};

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Checkout service running on http://localhost:${port}/graphql`);
}

bootstrap();
