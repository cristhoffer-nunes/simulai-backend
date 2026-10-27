import { HealthCheckError } from '@nestjs/terminus';
import { HealthController } from '@/health/health.controller';
import { PrismaHealthIndicator } from '@/health/indicators/prisma.health-indicator';
import { appVersion, resetAppVersionCache } from '@/shared/app-version';

describe('health', () => {
  it('Postgres indicator', async () => {
    const ok = new PrismaHealthIndicator({ $queryRaw: jest.fn().mockResolvedValue([1]) } as never);
    await expect(ok.check('postgres')).resolves.toEqual({ postgres: { status: 'up' } });

    const down = new PrismaHealthIndicator({
      $queryRaw: jest.fn().mockRejectedValue(new Error('x')),
    } as never);
    await expect(down.check('postgres')).rejects.toBeInstanceOf(HealthCheckError);
  });

  it('controller checks the database', async () => {
    const health = {
      check: jest.fn(async (fns: (() => unknown)[]) => ({
        status: 'ok',
        info: await Promise.all(fns.map((fn) => fn())),
      })),
    };
    const prisma = { check: jest.fn().mockResolvedValue('p') };
    process.env.APP_VERSION = '9.9.9';

    await expect(new HealthController(health as never, prisma as never).check()).resolves.toEqual({
      status: 'ok',
      info: ['p'],
      version: '9.9.9',
    });
    delete process.env.APP_VERSION;
    expect(prisma.check).toHaveBeenCalledWith('postgres');
  });
});

describe('appVersion', () => {
  afterEach(() => {
    delete process.env.APP_VERSION;
    resetAppVersionCache();
  });

  it('prefers APP_VERSION, then package.json, then "unknown"', () => {
    process.env.APP_VERSION = '1.2.3';
    expect(appVersion()).toBe('1.2.3');
    delete process.env.APP_VERSION;
    const read = jest.fn().mockReturnValue('{"version":"0.14.1"}');
    expect(appVersion(read)).toBe('0.14.1');
    expect(appVersion(read)).toBe('0.14.1');
    expect(read).toHaveBeenCalledTimes(1);
    resetAppVersionCache();
    expect(appVersion(() => '{}')).toBe('unknown');
    resetAppVersionCache();
    expect(
      appVersion(() => {
        throw new Error('missing');
      }),
    ).toBe('unknown');
  });
});
