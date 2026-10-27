/**
 * Roles and permissions of Simulai. Roles are data (seeded in the database); these constants are
 * the vocabulary the code checks against. Administrators use the whole system (their own study
 * area plus account management); students never receive any admin permission, so every /admin
 * route is closed to them.
 */
export const Roles = {
  ADMIN: 'admin',
  STUDENT: 'student',
} as const;
export type RoleName = (typeof Roles)[keyof typeof Roles];
export const ASSIGNABLE_ROLES: readonly RoleName[] = [Roles.ADMIN, Roles.STUDENT];

export const Permissions = {
  /** Create, list, edit, deactivate accounts — the admin area. */
  USERS_MANAGE: 'users.manage',
  /** Own question bank, imports, collections, simulations and results — the student area. */
  STUDY_ACCESS: 'study.access',
} as const;
export type PermissionName = (typeof Permissions)[keyof typeof Permissions];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionName[]> = {
  [Roles.ADMIN]: [Permissions.USERS_MANAGE, Permissions.STUDY_ACCESS],
  [Roles.STUDENT]: [Permissions.STUDY_ACCESS],
};
