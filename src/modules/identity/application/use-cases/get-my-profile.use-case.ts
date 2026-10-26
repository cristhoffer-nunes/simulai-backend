import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { Role } from '../../domain/entities/role.entity';
import { ROLE_REPOSITORY, IRoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';

export interface MyProfile {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  roles: string[];
  permissions: string[];
  createdAt: Date;
}

export interface IGetMyProfileUseCase {
  execute(userId: string): Promise<Result<MyProfile, AppError>>;
}

export const GET_MY_PROFILE_USE_CASE = Symbol('GET_MY_PROFILE_USE_CASE');

@Injectable()
export class GetMyProfileUseCase implements IGetMyProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
  ) {}

  async execute(userId: string): Promise<Result<MyProfile, AppError>> {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      return Result.fail(AppError.userNotFound(userId));
    }

    const { roleNames, permissions } = Role.toClaims(await this.roles.findRolesForUser(user.id));

    return Result.ok({
      id: user.id,
      email: user.email.toString(),
      displayName: user.displayName.toString(),
      initials: user.displayName.initials(),
      roles: roleNames,
      permissions,
      createdAt: user.createdAt,
    });
  }
}
