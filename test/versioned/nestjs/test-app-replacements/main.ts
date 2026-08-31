import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

export async function bootstrap(port: number) {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(port);
  return app
}
