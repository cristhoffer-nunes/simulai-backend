import { CreateUserUseCase } from '@/modules/identity/application/use-cases/create-user.use-case';
import { User } from '@/modules/identity/domain/entities/user.entity';
import {
  buildUser,
  fakeConfig,
  fakeEmail,
  fakeHasher,
  fakeResetTokens,
  fakeResetTokenStore,
  fakeRoles,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('CreateUserUseCase', () => {
  function build(
    opts: { users?: ReturnType<typeof fakeUsers>; email?: ReturnType<typeof fakeEmail> } = {},
  ) {
    const users = opts.users ?? fakeUsers({ findByEmail: jest.fn().mockResolvedValue(null) });
    const roles = fakeRoles();
    const hasher = fakeHasher();
    const resetTokens = fakeResetTokens({
      issue: jest
        .fn()
        .mockResolvedValue({ token: 'invite.jwt', jti: 'jti-9', ttlSeconds: 259_200 }),
    });
    const store = fakeResetTokenStore();
    const email = opts.email ?? fakeEmail();
    const useCase = new CreateUserUseCase(
      users,
      roles,
      hasher,
      resetTokens,
      store,
      email,
      fakeConfig,
    );
    return { useCase, users, hasher, resetTokens, store, email };
  }

  const input = { email: 'Novo.Aluno@Exemplo.com', displayName: 'Novo Aluno', role: 'student' };

  it('creates the account with an unusable password and emails a first-access link', async () => {
    const { useCase, users, store, email } = build();

    const result = await useCase.execute(input);

    expect(result.isSuccess).toBe(true);
    const created = users.createWithRole.mock.calls[0]?.[0] as User;
    expect(created.email.toString()).toBe('novo.aluno@exemplo.com');
    expect(created.passwordHash).toBe('unusable-hash');
    expect(created.mustChangePassword).toBe(true);
    expect(users.createWithRole).toHaveBeenCalledWith(created, 'role-student');
    expect(store.save).toHaveBeenCalledWith(created.id, 'jti-9', 259_200);
    expect(email.sendInviteEmail).toHaveBeenCalledWith({
      to: 'novo.aluno@exemplo.com',
      userName: 'Novo Aluno',
      accessUrl: 'https://app.simulai.test/redefinir-senha?token=invite.jwt',
      validFor: '3 dias',
    });
    expect(result.value).toEqual(
      expect.objectContaining({
        accessLink: 'https://app.simulai.test/redefinir-senha?token=invite.jwt',
        emailSent: true,
        user: expect.objectContaining({ roles: ['student'], invitePending: true, initials: 'NA' }),
      }),
    );
  });

  it('still returns the link when the email provider fails', async () => {
    const { useCase } = build({
      email: fakeEmail({ sendInviteEmail: jest.fn().mockRejectedValue(new Error('down')) }),
    });

    const result = await useCase.execute(input);

    expect(result.value.emailSent).toBe(false);
    expect(result.value.accessLink).toContain('invite.jwt');
  });

  it('rejects a duplicated email', async () => {
    const { useCase, users } = build({
      users: fakeUsers({ findByEmail: jest.fn().mockResolvedValue(buildUser()) }),
    });

    const result = await useCase.execute(input);

    expect(result.error.kind).toBe('EMAIL_ALREADY_IN_USE');
    expect(users.createWithRole).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: 'not-an-email' }, 'VALIDATION_ERROR'],
    [{ displayName: ' ' }, 'VALIDATION_ERROR'],
    [{ role: 'superuser' }, 'ROLE_NOT_FOUND'],
  ])('rejects invalid input %j', async (patch, kind) => {
    const { useCase } = build();
    expect((await useCase.execute({ ...input, ...patch })).error.kind).toBe(kind);
  });

  it('fails when the role is missing from the database (seed not run)', async () => {
    const users = fakeUsers({ findByEmail: jest.fn().mockResolvedValue(null) });
    const useCase = new CreateUserUseCase(
      users,
      fakeRoles({ findByName: jest.fn().mockResolvedValue(null) }),
      fakeHasher(),
      fakeResetTokens(),
      fakeResetTokenStore(),
      fakeEmail(),
      fakeConfig,
    );
    expect((await useCase.execute(input)).error.kind).toBe('ROLE_NOT_FOUND');
  });
});
