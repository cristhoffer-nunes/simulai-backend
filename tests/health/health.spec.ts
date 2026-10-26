import { HealthCheckError } from '@nestjs/terminus';
import { HealthController } from '@/health/health.controller';
import { PrismaHealthIndicator } from '@/health/indicators/prisma.health-indicator';

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
      check: jest.fn(async (fns: (() => unknown)[]) => Promise.all(fns.map((fn) => fn()))),
    };
    const prisma = { check: jest.fn().mockResolvedValue('p') };

    await expect(new HealthController(health as never, prisma as never).check()).resolves.toEqual([
      'p',
    ]);
    expect(prisma.check).toHaveBeenCalledWith('postgres');
  });
});
