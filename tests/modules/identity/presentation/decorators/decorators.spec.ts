import { currentUserFactory } from '@/modules/identity/presentation/decorators/current-user.decorator';
import {
  PERMISSIONS_KEY,
  RequirePermissions,
} from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { AdminUsersController } from '@/modules/identity/presentation/controllers/admin-users.controller';

describe('decorators', () => {
  it('CurrentUser reads request.user', () => {
    const user = { sub: 'u1' };
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as never;
    expect(currentUserFactory(undefined, ctx)).toBe(user);
  });

  it('RequirePermissions stores metadata; the admin controller requires users.manage', () => {
    class Target {}
    RequirePermissions('a', 'b')(Target);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, Target)).toEqual(['a', 'b']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AdminUsersController)).toEqual(['users.manage']);
  });
});
