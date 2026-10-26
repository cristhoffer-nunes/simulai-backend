import { Role } from '../entities/role.entity';

export interface IRoleRepository {
  findByName(name: string): Promise<Role | null>;
  findRolesForUser(userId: string): Promise<Role[]>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
