import { ForgotPasswordUseCase } from '@/modules/identity/application/use-cases/forgot-password.use-case';
import {
  buildUser,
  fakeConfig,
  fakeEmail,
  fakeRateLimiter,
  fakeResetTokens,
  fakeResetTokenStore,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('ForgotPasswordUseCase', () => {
  function build(
    opts: {
      users?: ReturnType<typeof fakeUsers>;
      rateLimiter?: ReturnType<typeof fakeRateLimiter>;
      email?: ReturnType<typeof fakeEmail>;
    } = {},
  ) {
    const users = opts.users ?? fakeUsers();
    const rateLimiter = opts.rateLimiter ?? fakeRateLimiter();
    const resetTokens = fakeResetTokens();
    const store = fakeResetTokenStore();
    const email = opts.email ?? fakeEmail();
    const useCase = new ForgotPasswordUseCase(
      users,
      rateLimiter,
      resetTokens,
      store,
      email,
      fakeConfig,
    );
    return { useCase, users, resetTokens, store, email };
  }

  const input = { email: 'Mariana@exemplo.com', ip: '9.9.9.9' };

  it('emails a recovery link for an active account with a password', async () => {
    const { useCase, resetTokens, store, email } = build();

    const result = await useCase.execute(input);

    expect(result.isSuccess).toBe(true);
    expect(resetTokens.issue).toHaveBeenCalledWith('user-1', 'mariana@exemplo.com', 'recovery');
    expect(store.save).toHaveBeenCalledWith('user-1', 'jti-1', 3600);
    expect(email.sendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'mariana@exemplo.com',
      resetUrl: 'https://app.simulai.test/redefinir-senha?token=reset.jwt',
      validFor: '1 hora',
    });
  });

  it('issues a first-access link when the invite was never completed', async () => {
    const { useCase, resetTokens } = build({
      users: fakeUsers({
        findByEmail: jest.fn().mockResolvedValue(buildUser({ mustChangePassword: true })),
      }),
    });

    await useCase.execute(input);

    expect(resetTokens.issue).toHaveBeenCalledWith('user-1', 'mariana@exemplo.com', 'first_access');
  });

  it.each([
    ['unknown account', fakeUsers({ findByEmail: jest.fn().mockResolvedValue(null) })],
    [
      'inactive account',
      fakeUsers({ findByEmail: jest.fn().mockResolvedValue(buildUser({ isActive: false })) }),
    ],
  ])('answers the same for an %s and sends nothing', async (_label, users) => {
    const { useCase, email } = build({ users });

    const result = await useCase.execute(input);

    expect(result.isSuccess).toBe(true);
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('answers the same when rate limited and never looks the user up', async () => {
    const { useCase, users } = build({
      rateLimiter: fakeRateLimiter({
        consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 10 }),
      }),
    });

    const result = await useCase.execute(input);

    expect(result.isSuccess).toBe(true);
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('swallows email delivery failures', async () => {
    const { useCase } = build({
      email: fakeEmail({ sendPasswordResetEmail: jest.fn().mockRejectedValue(new Error('down')) }),
    });

    await expect(useCase.execute(input)).resolves.toMatchObject({ isSuccess: true });
  });
});
