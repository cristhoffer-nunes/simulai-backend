import { RefreshSessionUseCase } from '@/modules/identity/application/use-cases/refresh-session.use-case';
import {
  buildSessionIssuer,
  buildUser,
  fakeConfig,
  fakeRateLimiter,
  fakeRefreshTokens,
  fakeTokens,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('RefreshSessionUseCase', () => {
  const rotated = {
    token: 'rotated-token',
    tokenId: 'h',
    expiresAt: new Date(),
    userId: 'user-1',
  };

  function build(
    opts: {
      users?: ReturnType<typeof fakeUsers>;
      rotate?: jest.Mock;
      rateLimiter?: ReturnType<typeof fakeRateLimiter>;
    } = {},
  ) {
    const users = opts.users ?? fakeUsers();
    const refresh = fakeRefreshTokens({
      rotate: opts.rotate ?? jest.fn().mockResolvedValue(rotated),
    });
    const rateLimiter = opts.rateLimiter ?? fakeRateLimiter();
    const tokens = fakeTokens();
    const useCase = new RefreshSessionUseCase(
      users,
      refresh,
      rateLimiter,
      buildSessionIssuer(tokens, refresh),
      fakeConfig,
    );
    return { useCase, refresh, rateLimiter, tokens };
  }

  it('rotates the refresh token and signs a fresh access token', async () => {
    const { useCase, rateLimiter } = build();

    const result = await useCase.execute({ refreshToken: 'old', ip: '1.1.1.1' });

    expect(result.value).toEqual({
      accessToken: 'signed.access.token',
      refreshToken: 'rotated-token',
      expiresInSeconds: 900,
    });
    expect(rateLimiter.reset).toHaveBeenCalledWith('refresh:1.1.1.1');
  });

  it('fails with RATE_LIMITED when the IP exceeded the window', async () => {
    const { useCase, refresh } = build({
      rateLimiter: fakeRateLimiter({
        consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 30 }),
      }),
    });

    const result = await useCase.execute({ refreshToken: 'old', ip: '1.1.1.1' });

    expect(result.error.kind).toBe('RATE_LIMITED');
    expect(refresh.rotate).not.toHaveBeenCalled();
  });

  it('fails with INVALID_REFRESH_TOKEN for an unknown or already-used token', async () => {
    const { useCase } = build({ rotate: jest.fn().mockResolvedValue(null) });

    const result = await useCase.execute({ refreshToken: 'stale', ip: '1.1.1.1' });

    expect(result.error.kind).toBe('INVALID_REFRESH_TOKEN');
  });

  it.each([
    ['missing', null],
    ['deactivated', buildUser({ isActive: false })],
    ['back to provisional password', buildUser({ mustChangePassword: true })],
  ])('revokes every session when the user is %s', async (_label, user) => {
    const { useCase, refresh } = build({
      users: fakeUsers({ findById: jest.fn().mockResolvedValue(user) }),
    });

    const result = await useCase.execute({ refreshToken: 'old', ip: '1.1.1.1' });

    expect(result.error.kind).toBe('INVALID_REFRESH_TOKEN');
    expect(refresh.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });
});
