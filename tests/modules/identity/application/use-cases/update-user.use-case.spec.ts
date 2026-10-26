import { UpdateUserUseCase } from '@/modules/identity/application/use-cases/update-user.use-case';
import {
  adminRole,
  buildUser,
  fakeRefreshTokens,
  fakeRoles,
  fakeUsers,
} from '../../../../helpers/identity-fakes';

describe('UpdateUserUseCase', () => {
  function build(user = buildUser(), roles = fakeRoles()) {
    const users = fakeUsers({ findById: jest.fn().mockResolvedValue(user) });
    const refresh = fakeRefreshTokens();
    return { useCase: new UpdateUserUseCase(users, roles, refresh), users, refresh, user };
  }

  it('deactivates an account and ends its sessions', async () => {
    const { useCase, users, refresh, user } = build();

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      userId: 'user-1',
      isActive: false,
    });

    expect(result.value.isActive).toBe(false);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(refresh.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('reactivates without revoking sessions', async () => {
    const { useCase, refresh } = build(buildUser({ isActive: false }));

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      userId: 'user-1',
      isActive: true,
    });

    expect(result.value.isActive).toBe(true);
    expect(refresh.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('renames and changes the role, revoking sessions so new claims apply', async () => {
    const roles = fakeRoles({ findRolesForUser: jest.fn().mockResolvedValue([adminRole]) });
    const { useCase, users, refresh } = build(buildUser(), roles);

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      userId: 'user-1',
      displayName: 'Mariana S.',
      role: 'admin',
    });

    expect(users.replaceRole).toHaveBeenCalledWith('user-1', 'role-admin');
    expect(refresh.revokeAllForUser).toHaveBeenCalled();
    expect(result.value).toEqual(
      expect.objectContaining({ displayName: 'Mariana S.', roles: ['admin'] }),
    );
  });

  it.each([{ isActive: false }, { role: 'student' }])(
    'stops an administrator from locking themselves out (%j)',
    async (patch) => {
      const { useCase, users } = build();
      const result = await useCase.execute({ actorUserId: 'user-1', userId: 'user-1', ...patch });
      expect(result.error.kind).toBe('CANNOT_MODIFY_SELF');
      expect(users.save).not.toHaveBeenCalled();
    },
  );

  it('lets an administrator rename themselves', async () => {
    const { useCase } = build();
    const result = await useCase.execute({
      actorUserId: 'user-1',
      userId: 'user-1',
      displayName: 'Novo Nome',
    });
    expect(result.isSuccess).toBe(true);
  });

  it('returns USER_NOT_FOUND for an unknown id', async () => {
    const users = fakeUsers({ findById: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateUserUseCase(users, fakeRoles(), fakeRefreshTokens());
    expect((await useCase.execute({ actorUserId: 'a', userId: 'x' })).error.kind).toBe(
      'USER_NOT_FOUND',
    );
  });

  it.each([
    [{ displayName: '' }, 'VALIDATION_ERROR'],
    [{ role: 'root' }, 'ROLE_NOT_FOUND'],
  ])('rejects %j', async (patch, kind) => {
    const { useCase } = build();
    expect(
      (await useCase.execute({ actorUserId: 'a', userId: 'user-1', ...patch })).error.kind,
    ).toBe(kind);
  });

  it('fails when the role row is missing', async () => {
    const { useCase } = build(
      buildUser(),
      fakeRoles({ findByName: jest.fn().mockResolvedValue(null) }),
    );
    expect(
      (await useCase.execute({ actorUserId: 'a', userId: 'user-1', role: 'admin' })).error.kind,
    ).toBe('ROLE_NOT_FOUND');
  });
});
