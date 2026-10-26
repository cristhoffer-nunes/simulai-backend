import { ListUsersUseCase } from '@/modules/identity/application/use-cases/list-users.use-case';
import { buildUser, fakeUsers } from '../../../../helpers/identity-fakes';

describe('ListUsersUseCase', () => {
  it('maps filters and paginates', async () => {
    const users = fakeUsers({
      list: jest.fn().mockResolvedValue({
        items: [{ user: buildUser(), roleNames: ['student'] }],
        total: 41,
      }),
    });

    const result = await new ListUsersUseCase(users).execute({
      search: '  souza ',
      role: 'student',
      status: 'inactive',
      page: 3,
      pageSize: 20,
    });

    expect(users.list).toHaveBeenCalledWith({
      search: 'souza',
      roleName: 'student',
      isActive: false,
      page: 3,
      pageSize: 20,
    });
    expect(result.value.total).toBe(41);
    expect(result.value.items[0]).toEqual(
      expect.objectContaining({
        email: 'mariana@exemplo.com',
        roles: ['student'],
        invitePending: false,
      }),
    );
  });

  it('applies defaults and clamps the page size', async () => {
    const users = fakeUsers();

    const result = await new ListUsersUseCase(users).execute({
      pageSize: 5000,
      page: -2,
      search: '  ',
    });

    expect(users.list).toHaveBeenCalledWith({
      search: undefined,
      roleName: undefined,
      isActive: undefined,
      page: 1,
      pageSize: 100,
    });
    expect(result.value.page).toBe(1);
  });

  it('maps the active status filter', async () => {
    const users = fakeUsers();
    await new ListUsersUseCase(users).execute({ status: 'active' });
    expect(users.list).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, pageSize: 20 }),
    );
  });
});
