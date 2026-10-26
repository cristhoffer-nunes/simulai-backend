import {
  Permissions,
  ROLE_PERMISSIONS,
  Roles,
} from '@/modules/identity/domain/services/access-policy';

describe('access policy', () => {
  it('never grants an admin permission to students', () => {
    expect(ROLE_PERMISSIONS[Roles.STUDENT]).not.toContain(Permissions.USERS_MANAGE);
    expect(ROLE_PERMISSIONS[Roles.ADMIN]).toContain(Permissions.USERS_MANAGE);
  });
});
