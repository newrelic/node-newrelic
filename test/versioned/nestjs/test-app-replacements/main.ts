import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function bootstrap(port) {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(port);
  return app
}
