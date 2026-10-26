import { IssueAccessLinkUseCase } from '@/modules/identity/application/use-cases/issue-access-link.use-case';
import {
  buildUser,
  fakeConfig,
  fakeEmail,
  fakeResetTokens,
  fakeResetTokenStore,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('IssueAccessLinkUseCase', () => {
  function build(user: ReturnType<typeof buildUser> | null, email = fakeEmail()) {
    const resetTokens = fakeResetTokens();
    const store = fakeResetTokenStore();
    const useCase = new IssueAccessLinkUseCase(
      fakeUsers({ findById: jest.fn().mockResolvedValue(user) }),
      resetTokens,
      store,
      email,
      fakeConfig,
    );
    return { useCase, resetTokens, store, email };
  }

  it('re-sends the invite while the account has no password yet', async () => {
    const { useCase, resetTokens, email } = build(buildUser({ mustChangePassword: true }));

    const result = await useCase.execute('user-1');

    expect(resetTokens.issue).toHaveBeenCalledWith('user-1', 'mariana@exemplo.com', 'first_access');
    expect(email.sendInviteEmail).toHaveBeenCalled();
    expect(result.value).toEqual({
      accessLink: 'https://app.simulai.test/redefinir-senha?token=reset.jwt',
      type: 'first_access',
      emailSent: true,
    });
  });

  it('sends a recovery link once the account is set up', async () => {
    const { useCase, email } = build(buildUser());

    const result = await useCase.execute('user-1');

    expect(result.value.type).toBe('recovery');
    expect(email.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('reports emailSent=false when delivery fails', async () => {
    const { useCase } = build(
      buildUser(),
      fakeEmail({ sendPasswordResetEmail: jest.fn().mockRejectedValue(new Error('down')) }),
    );
    expect((await useCase.execute('user-1')).value.emailSent).toBe(false);
  });

  it('fails for unknown and inactive accounts', async () => {
    expect((await build(null).useCase.execute('x')).error.kind).toBe('USER_NOT_FOUND');
    expect((await build(buildUser({ isActive: false })).useCase.execute('x')).error.kind).toBe(
      'USER_INACTIVE',
    );
  });
});
