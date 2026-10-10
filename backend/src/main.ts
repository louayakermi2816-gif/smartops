import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // check every request body against its DTO rules
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Let the future dashboard (Next.js, Phase 6) call this API from the browser.
  // CORS_ORIGINS = comma-separated list of allowed web addresses.
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','),
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
