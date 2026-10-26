import { User } from '../entities/user.entity';

export interface UserListFilter {
  search?: string;
  roleName?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface UserWithRoles {
  user: User;
  roleNames: string[];
}

export interface UserPage {
  items: UserWithRoles[];
  total: number;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  list(filter: UserListFilter): Promise<UserPage>;
  /** Persists a new user together with its role assignment, atomically. */
  createWithRole(user: User, roleId: string): Promise<void>;
  save(user: User): Promise<void>;
  /** Replaces the user's roles with exactly this one, atomically. */
  replaceRole(userId: string, roleId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
