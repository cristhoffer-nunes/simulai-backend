import { AuthenticateUserUseCase } from '@/modules/identity/application/use-cases/authenticate-user.use-case';
import {
  buildSessionIssuer,
  buildUser,
  fakeConfig,
  fakeHasher,
  fakeRateLimiter,
  fakeRefreshTokens,
  fakeResetTokens,
  fakeResetTokenStore,
  fakeTokens,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('AuthenticateUserUseCase', () => {
  function build(
    overrides: {
      users?: ReturnType<typeof fakeUsers>;
      hasher?: ReturnType<typeof fakeHasher>;
      rateLimiter?: ReturnType<typeof fakeRateLimiter>;
    } = {},
  ) {
    const users = overrides.users ?? fakeUsers();
    const hasher = overrides.hasher ?? fakeHasher();
    const rateLimiter = overrides.rateLimiter ?? fakeRateLimiter();
    const resetTokens = fakeResetTokens();
    const resetTokenStore = fakeResetTokenStore();
    const tokens = fakeTokens();
    const refresh = fakeRefreshTokens();
    const useCase = new AuthenticateUserUseCase(
      users,
      hasher,
      rateLimiter,
      resetTokens,
      resetTokenStore,
      buildSessionIssuer(tokens, refresh),
      fakeConfig,
    );
    return { useCase, users, hasher, rateLimiter, resetTokens, resetTokenStore, tokens, refresh };
  }

  const input = { email: ' Mariana@Exemplo.com ', password: 'Secret#123', ip: '10.0.0.1' };

  it('opens a session with roles and permissions for valid credentials', async () => {
    const { useCase, tokens, rateLimiter } = build();

    const result = await useCase.execute(input);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      accessToken: 'signed.access.token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 900,
    });
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'mariana@exemplo.com',
      roles: ['student'],
      permissions: ['study.access'],
    });
    expect(rateLimiter.consume).toHaveBeenCalledWith('login:mariana@exemplo.com:10.0.0.1', 5, 900);
    expect(rateLimiter.reset).toHaveBeenCalledWith('login:mariana@exemplo.com:10.0.0.1');
  });

  it('fails with RATE_LIMITED before touching the user store', async () => {
    const rateLimiter = fakeRateLimiter({
      consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 120 }),
    });
    const { useCase, users } = build({ rateLimiter });

    const result = await useCase.execute(input);

    expect(result.error.kind).toBe('RATE_LIMITED');
    expect(result.error.details).toEqual({ retryAfterSeconds: 120 });
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('fails with INVALID_CREDENTIALS for an unknown email', async () => {
    const { useCase } = build({
      users: fakeUsers({ findByEmail: jest.fn().mockResolvedValue(null) }),
    });

    const result = await useCase.execute(input);

    expect(result.error.kind).toBe('INVALID_CREDENTIALS');
  });

  it('fails with INVALID_CREDENTIALS for a wrong password and keeps the attempt counted', async () => {
    const { useCase, rateLimiter } = build({
      hasher: fakeHasher({ compare: jest.fn().mockResolvedValue(false) }),
    });

    const result = await useCase.execute(input);

    expect(result.error.kind).toBe('INVALID_CREDENTIALS');
    expect(rateLimiter.reset).not.toHaveBeenCalled();
  });

  it('only reveals an inactive account after the password matches', async () => {
    const inactive = buildUser({ isActive: false });
    const { useCase } = build({
      users: fakeUsers({ findByEmail: jest.fn().mockResolvedValue(inactive) }),
    });

    const result = await useCase.execute(input);

    expect(result.error.kind).toBe('USER_INACTIVE');
  });

  it('returns a first-access reset token instead of a session while the password is provisional', async () => {
    const invited = buildUser({ mustChangePassword: true });
    const { useCase, resetTokens, resetTokenStore, tokens } = build({
      users: fakeUsers({ findByEmail: jest.fn().mockResolvedValue(invited) }),
    });

    const result = await useCase.execute(input);

    expect(result.value).toEqual({ passwordResetRequired: true, resetToken: 'reset.jwt' });
    expect(resetTokens.issue).toHaveBeenCalledWith('user-1', 'mariana@exemplo.com', 'first_access');
    expect(resetTokenStore.save).toHaveBeenCalledWith('user-1', 'jti-1', 3600);
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
  });
});
