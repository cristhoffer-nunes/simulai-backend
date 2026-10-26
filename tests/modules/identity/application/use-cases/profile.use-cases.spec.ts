import { GetMyProfileUseCase } from '@/modules/identity/application/use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from '@/modules/identity/application/use-cases/update-my-profile.use-case';
import { buildUser, fakeRoles, fakeUsers } from '../../../../helpers/identity-fakes';

describe('GetMyProfileUseCase', () => {
  it('returns profile, initials, roles and permissions', async () => {
    const result = await new GetMyProfileUseCase(fakeUsers(), fakeRoles()).execute('user-1');

    expect(result.value).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'mariana@exemplo.com',
        displayName: 'Mariana Souza',
        initials: 'MS',
        roles: ['student'],
        permissions: ['study.access'],
      }),
    );
  });

  it.each([null, buildUser({ isActive: false })])(
    'fails for a missing or inactive user',
    async (user) => {
      const useCase = new GetMyProfileUseCase(
        fakeUsers({ findById: jest.fn().mockResolvedValue(user) }),
        fakeRoles(),
      );
      expect((await useCase.execute('user-1')).error.kind).toBe('USER_NOT_FOUND');
    },
  );
});

describe('UpdateMyProfileUseCase', () => {
  it('renames the account', async () => {
    const user = buildUser();
    const users = fakeUsers({ findById: jest.fn().mockResolvedValue(user) });

    const result = await new UpdateMyProfileUseCase(users).execute({
      userId: 'user-1',
      displayName: '  Ana   Clara  Lima ',
    });

    expect(result.value).toEqual({ displayName: 'Ana Clara Lima', initials: 'AL' });
    expect(users.save).toHaveBeenCalledWith(user);
  });

  it('rejects an empty name', async () => {
    const result = await new UpdateMyProfileUseCase(fakeUsers()).execute({
      userId: 'user-1',
      displayName: '   ',
    });
    expect(result.error.kind).toBe('VALIDATION_ERROR');
  });

  it('fails for an inactive user', async () => {
    const users = fakeUsers({
      findById: jest.fn().mockResolvedValue(buildUser({ isActive: false })),
    });
    const result = await new UpdateMyProfileUseCase(users).execute({
      userId: 'user-1',
      displayName: 'X',
    });
    expect(result.error.kind).toBe('USER_NOT_FOUND');
  });
});
