import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

const GLOBAL_PREFIX = 'simulai-backend';

async function bootstrap() {
  const adapter = new FastifyAdapter({
    genReqId: (req: IncomingMessage) => (req.headers['x-correlation-id'] as string) || randomUUID(),
    // Imports (Phase 4) send up to 100 questions; 1 MB covers that with room to spare.
    bodyLimit: 1_048_576,
    trustProxy: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));

  await app.register(fastifyHelmet);
  await app.register(fastifyCors, {
    origin: config.corsOrigins,
    credentials: true,
  });
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' }); // ADR-012: /v1/...

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!config.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Simulai Backend')
      .setDescription('API da plataforma de questões e simulados Simulai.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, swaggerDocument);
  }

  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
}

bootstrap();
