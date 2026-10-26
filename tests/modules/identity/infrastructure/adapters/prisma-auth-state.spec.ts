import { AppConfigService } from '@/config/app-config.service';
import { PrismaPasswordResetTokenStoreAdapter } from '@/modules/identity/infrastructure/adapters/prisma-password-reset-token-store.adapter';
import { PrismaRateLimiterAdapter } from '@/modules/identity/infrastructure/adapters/prisma-rate-limiter.adapter';
import { PrismaRefreshTokenStoreAdapter } from '@/modules/identity/infrastructure/adapters/prisma-refresh-token-store.adapter';
import { AuthStateCleanupService } from '@/modules/identity/infrastructure/auth-state-cleanup.service';

describe('Postgres-backed auth state', () => {
  describe('PrismaRateLimiterAdapter', () => {
    function build(rows: unknown[]) {
      const prisma = {
        $queryRaw: jest.fn().mockResolvedValue(rows),
        rateLimitBucket: { deleteMany: jest.fn() },
      };
      return { prisma, limiter: new PrismaRateLimiterAdapter(prisma as never) };
    }

    it('allows attempts inside the limit', async () => {
      const { limiter, prisma } = build([{ attempts: 5, retry_after: 600 }]);
      await expect(limiter.consume('login:a@b.co:1.2.3.4', 5, 900)).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
      const values = prisma.$queryRaw.mock.calls[0].slice(1);
      expect(values).toEqual(['login:a@b.co:1.2.3.4', 900]);
    });

    it('blocks past the limit with the remaining window', async () => {
      const { limiter } = build([{ attempts: 6, retry_after: 321 }]);
      await expect(limiter.consume('k', 5, 900)).resolves.toEqual({
        allowed: false,
        retryAfterSeconds: 321,
      });
    });

    it('hashes keys longer than the column and resets buckets', async () => {
      const { limiter, prisma } = build([{ attempts: 1, retry_after: 900 }]);
      const long = 'x'.repeat(400);
      await limiter.consume(long, 5, 900);
      expect(prisma.$queryRaw.mock.calls[0][1]).toMatch(/^sha256:[0-9a-f]{64}$/);
      await limiter.reset('k');
      expect(prisma.rateLimitBucket.deleteMany).toHaveBeenCalledWith({ where: { key: 'k' } });
    });

    it('treats an empty result as allowed', async () => {
      const { limiter } = build([]);
      await expect(limiter.consume('k', 5, 900)).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
    });
  });

  describe('PrismaPasswordResetTokenStoreAdapter', () => {
    it('keeps one live link per user', async () => {
      const prisma = {
        passwordResetLink: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          deleteMany: jest.fn(),
        },
      };
      const store = new PrismaPasswordResetTokenStoreAdapter(prisma as never);

      await store.save('u1', 'jti-1', 60);
      expect(prisma.passwordResetLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          update: expect.objectContaining({ jti: 'jti-1' }),
        }),
      );

      const future = new Date(Date.now() + 60_000);
      prisma.passwordResetLink.findUnique.mockResolvedValue({ jti: 'jti-1', expiresAt: future });
      await expect(store.isValid('u1', 'jti-1')).resolves.toBe(true);
      await expect(store.isValid('u1', 'other')).resolves.toBe(false);

      prisma.passwordResetLink.findUnique.mockResolvedValue({
        jti: 'jti-1',
        expiresAt: new Date(0),
      });
      await expect(store.isValid('u1', 'jti-1')).resolves.toBe(false);

      prisma.passwordResetLink.findUnique.mockResolvedValue(null);
      await expect(store.isValid('u1', 'jti-1')).resolves.toBe(false);

      await store.consume('u1');
      expect(prisma.passwordResetLink.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('PrismaRefreshTokenStoreAdapter', () => {
    const config = { jwt: { refreshTokenTtlSeconds: 100 } } as unknown as AppConfigService;

    function build(removed: unknown[] = []) {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue(removed),
        authSession: { create: jest.fn() },
      };
      const prisma = {
        authSession: { create: jest.fn(), deleteMany: jest.fn() },
        $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      };
      return { tx, prisma, store: new PrismaRefreshTokenStoreAdapter(prisma as never, config) };
    }

    it('issues an opaque token and stores only its hash', async () => {
      const { prisma, store } = build();
      const issued = await store.issue('u1');

      expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(issued.tokenId).toMatch(/^[0-9a-f]{64}$/);
      expect(prisma.authSession.create).toHaveBeenCalledWith({
        data: { tokenHash: issued.tokenId, userId: 'u1', expiresAt: issued.expiresAt },
      });
      expect(JSON.stringify(prisma.authSession.create.mock.calls)).not.toContain(issued.token);
    });

    it('rotates a live token inside one transaction', async () => {
      const { tx, store } = build([{ user_id: 'u1', expires_at: new Date(Date.now() + 60_000) }]);
      const rotated = await store.rotate('old-token');

      expect(rotated).toEqual(expect.objectContaining({ userId: 'u1' }));
      expect(tx.authSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tokenHash: rotated!.tokenId, userId: 'u1' }),
      });
    });

    it('rejects unknown, replayed or expired tokens', async () => {
      await expect(build([]).store.rotate('x')).resolves.toBeNull();

      const expired = build([{ user_id: 'u1', expires_at: new Date(Date.now() - 1) }]);
      await expect(expired.store.rotate('x')).resolves.toBeNull();
      expect(expired.tx.authSession.create).not.toHaveBeenCalled();
    });

    it('revokes one session or all sessions of a user', async () => {
      const { prisma, store } = build();
      await store.revoke('t');
      expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      });
      await store.revokeAllForUser('u1');
      expect(prisma.authSession.deleteMany).toHaveBeenLastCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('AuthStateCleanupService', () => {
    function build(fail = false) {
      const prisma = {
        authSession: { deleteMany: jest.fn().mockReturnValue('s') },
        passwordResetLink: { deleteMany: jest.fn().mockReturnValue('l') },
        rateLimitBucket: { deleteMany: jest.fn().mockReturnValue('b') },
        $transaction: fail
          ? jest.fn().mockRejectedValue(new Error('db down'))
          : jest.fn().mockResolvedValue([{ count: 2 }, { count: 0 }, { count: 1 }]),
      };
      return { prisma, service: new AuthStateCleanupService(prisma as never) };
    }

    it('deletes expired rows hourly and stops on shutdown', async () => {
      jest.useFakeTimers();
      const { prisma, service } = build();
      service.onModuleInit();
      jest.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: expect.any(Date) } },
      });
      service.onModuleDestroy();
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('never throws when the database is unavailable', async () => {
      await expect(build(true).service.run()).resolves.toBeUndefined();
      new AuthStateCleanupService({} as never).onModuleDestroy();
    });
  });
});
