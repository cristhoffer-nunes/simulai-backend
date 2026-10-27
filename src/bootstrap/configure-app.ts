import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';

export const GLOBAL_PREFIX = 'simulai-backend';

export interface HttpSettings {
  corsOrigins: string[];
  /** Requests per minute per client IP (all routes). */
  rateLimitPerMinute?: number;
}

/**
 * HTTP hardening and routing shared by main.ts and the tests, so what is tested is what runs:
 * security headers, CORS, a global rate limit, /simulai-backend/v1 routes and input validation.
 */
export async function configureApp(
  app: NestFastifyApplication,
  settings: HttpSettings,
): Promise<void> {
  await app.register(fastifyHelmet);
  await app.register(fastifyCors, {
    origin: settings.corsOrigins,
    credentials: true,
  });
  await app.register(fastifyRateLimit, {
    max: settings.rateLimitPerMinute ?? 100,
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
}
