import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  // Fail fast on missing critical env vars
  const requiredEnv = ['JWT_SECRET', 'DB_HOST', 'DB_DATABASE'];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  // Ensure upload folders exist before any Multer disk-storage write, since
  // each upload route stores into a dedicated folder (e.g. /uploads/hero-slider).
  const uploadRoot = join(process.cwd(), 'uploads');
  for (const folder of [uploadRoot, join(uploadRoot, 'hero-slider')]) {
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Uploaded images (logos, page banners) are served directly from disk.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Release the port immediately on Ctrl+C / SIGTERM instead of lingering
  app.enableShutdownHooks();

  // Enable CORS — restrict to frontend origin in production
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3030';
  app.enableCors({ origin: corsOrigin });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('School Management API')
    .setDescription('API documentation for School Management System')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .build();

  // NOTE: @nestjs/swagger@11.4.7 has a pre-existing bug where its circular-
  // dependency detector can throw a false positive during schema generation
  // (reproducible even with only Auth+Users modules, unrelated to any DTO
  // shape in this codebase). Don't let broken API docs take down the whole
  // API — log it and keep the app running.
  try {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  } catch (err) {
    console.error(
      '[swagger] Failed to generate API docs, continuing without them:',
      err instanceof Error ? err.message : err,
    );
  }

  const port = config().port;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
