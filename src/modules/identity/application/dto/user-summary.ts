import { User } from '../../domain/entities/user.entity';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  roles: string[];
  isActive: boolean;
  /** True while the account holder has not set a password yet (invite pending). */
  invitePending: boolean;
  createdAt: Date;
}

export function toUserSummary(user: User, roles: string[]): UserSummary {
  return {
    id: user.id,
    email: user.email.toString(),
    displayName: user.displayName.toString(),
    initials: user.displayName.initials(),
    roles,
    isActive: user.isActive,
    invitePending: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
