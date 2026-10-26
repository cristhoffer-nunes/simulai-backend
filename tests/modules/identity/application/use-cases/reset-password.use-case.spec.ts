import { ResetPasswordUseCase } from '@/modules/identity/application/use-cases/reset-password.use-case';
import {
  buildSessionIssuer,
  buildUser,
  fakeEmail,
  fakeHasher,
  fakeRefreshTokens,
  fakeResetTokens,
  fakeResetTokenStore,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('ResetPasswordUseCase', () => {
  const claims = (type: 'first_access' | 'recovery') => ({
    sub: 'user-1',
    email: 'mariana@exemplo.com',
    type,
    jti: 'jti-1',
    iat: 1,
    exp: 2,
  });

  function build(
    opts: {
      type?: 'first_access' | 'recovery';
      verify?: jest.Mock;
      isValid?: jest.Mock;
      users?: ReturnType<typeof fakeUsers>;
      email?: ReturnType<typeof fakeEmail>;
    } = {},
  ) {
    const user = buildUser({ mustChangePassword: true });
    const users = opts.users ?? fakeUsers({ findById: jest.fn().mockResolvedValue(user) });
    const hasher = fakeHasher();
    const refresh = fakeRefreshTokens();
    const resetTokens = fakeResetTokens({
      verify: opts.verify ?? jest.fn().mockResolvedValue(claims(opts.type ?? 'first_access')),
    });
    const store = fakeResetTokenStore(opts.isValid ? { isValid: opts.isValid } : {});
    const email = opts.email ?? fakeEmail();
    const useCase = new ResetPasswordUseCase(
      users,
      hasher,
      refresh,
      resetTokens,
      store,
      email,
      buildSessionIssuer(undefined, refresh),
    );
    return { useCase, users, user, hasher, refresh, store, email };
  }

  const strong = 'Nova#Senha1';

  it('sets the password, clears the provisional flag, burns the link and signs in', async () => {
    const { useCase, users, user, refresh, store, email } = build();

    const result = await useCase.execute({ token: 't', newPassword: strong });

    expect(result.value.accessToken).toBe('signed.access.token');
    expect(user.passwordHash).toBe('new-hash');
    expect(user.mustChangePassword).toBe(false);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(store.consume).toHaveBeenCalledWith('user-1');
    expect(refresh.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(email.sendPasswordChangedEmail).not.toHaveBeenCalled();
  });

  it('notifies the holder after a recovery reset, without failing if email is down', async () => {
    const email = fakeEmail({
      sendPasswordChangedEmail: jest.fn().mockRejectedValue(new Error('x')),
    });
    const { useCase } = build({ type: 'recovery', email });

    const result = await useCase.execute({ token: 't', newPassword: strong });
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.isSuccess).toBe(true);
    expect(email.sendPasswordChangedEmail).toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const { useCase } = build({ verify: jest.fn().mockResolvedValue(null) });
    expect((await useCase.execute({ token: 't', newPassword: strong })).error.kind).toBe(
      'INVALID_RESET_TOKEN',
    );
  });

  it('rejects a token that was already used', async () => {
    const { useCase } = build({ isValid: jest.fn().mockResolvedValue(false) });
    expect((await useCase.execute({ token: 't', newPassword: strong })).error.kind).toBe(
      'INVALID_RESET_TOKEN',
    );
  });

  it.each(['short1!', 'alllowercase1!', 'NoDigits!!', 'NoSymbol123'])(
    'rejects the weak password "%s"',
    async (password) => {
      const { useCase, users } = build();
      const result = await useCase.execute({ token: 't', newPassword: password });
      expect(result.error.kind).toBe('WEAK_PASSWORD');
      expect(users.save).not.toHaveBeenCalled();
    },
  );

  it('rejects when the account was deactivated meanwhile', async () => {
    const { useCase } = build({
      users: fakeUsers({ findById: jest.fn().mockResolvedValue(buildUser({ isActive: false })) }),
    });
    expect((await useCase.execute({ token: 't', newPassword: strong })).error.kind).toBe(
      'INVALID_RESET_TOKEN',
    );
  });
});
