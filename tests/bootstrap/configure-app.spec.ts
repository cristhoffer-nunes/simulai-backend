import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { configureApp } from '@/bootstrap/configure-app';

class EchoDto {
  @IsString()
  text!: string;
}

@Controller('probe')
class ProbeController {
  @Get()
  ping() {
    return { ok: true };
  }

  @Post()
  echo(@Body() dto: EchoDto) {
    return dto;
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

/** The real HTTP setup of main.ts (Fastify 5 + plugins), exercised through Fastify's inject. */
describe('configureApp', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app, { corsOrigins: ['https://simulai.example'], rateLimitPerMinute: 5 });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  const inject = (options: Parameters<NestFastifyApplication['inject']>[0]) => app.inject(options);

  it('serves /simulai-backend/v1 routes with security headers', async () => {
    const response = await inject({ method: 'GET', url: '/simulai-backend/v1/probe' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect((await inject({ method: 'GET', url: '/probe' })).statusCode).toBe(404);
  });

  it('allows CORS only for the configured origin', async () => {
    const allowed = await inject({
      method: 'OPTIONS',
      url: '/simulai-backend/v1/probe',
      headers: { origin: 'https://simulai.example', 'access-control-request-method': 'POST' },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://simulai.example');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const other = await inject({
      method: 'OPTIONS',
      url: '/simulai-backend/v1/probe',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('validates bodies and refuses unknown fields', async () => {
    const ok = await inject({
      method: 'POST',
      url: '/simulai-backend/v1/probe',
      payload: { text: 'a' },
    });
    expect(ok.statusCode).toBe(201);
    const extra = await inject({
      method: 'POST',
      url: '/simulai-backend/v1/probe',
      payload: { text: 'a', admin: true },
    });
    expect(extra.statusCode).toBe(400);
  });

  it('rate limits each client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await inject({
            method: 'GET',
            url: '/simulai-backend/v1/probe',
            remoteAddress: '198.51.100.9',
          })
        ).statusCode,
      );
    }
    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    const elsewhere = await inject({
      method: 'GET',
      url: '/simulai-backend/v1/probe',
      remoteAddress: '198.51.100.10',
    });
    expect(elsewhere.statusCode).toBe(200);
  });
});
