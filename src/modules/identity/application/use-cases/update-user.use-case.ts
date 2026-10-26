import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ROLE_REPOSITORY, IRoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { ASSIGNABLE_ROLES, RoleName, Roles } from '../../domain/services/access-policy';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { toUserSummary, UserSummary } from '../dto/user-summary';
import { REFRESH_TOKEN_STORE, IRefreshTokenStorePort } from '../ports/refresh-token-store.port';

export interface UpdateUserInput {
  actorUserId: string;
  userId: string;
  displayName?: string;
  isActive?: boolean;
  role?: string;
}

export interface IUpdateUserUseCase {
  execute(input: UpdateUserInput): Promise<Result<UserSummary, AppError>>;
}

export const UPDATE_USER_USE_CASE = Symbol('UPDATE_USER_USE_CASE');

@Injectable()
export class UpdateUserUseCase implements IUpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: IRefreshTokenStorePort,
  ) {}

  async execute(input: UpdateUserInput): Promise<Result<UserSummary, AppError>> {
    const user = await this.users.findById(input.userId);
    if (!user) return Result.fail(AppError.userNotFound(input.userId));

    const isSelf = input.actorUserId === input.userId;
    // An administrator cannot lock themselves out (deactivate or drop the admin role).
    if (isSelf && (input.isActive === false || (input.role && input.role !== Roles.ADMIN))) {
      return Result.fail(AppError.cannotModifySelf());
    }

    if (input.displayName !== undefined) {
      const name = DisplayName.create(input.displayName);
      if (name.isFailure) return Result.fail(AppError.validation(name.error));
      user.rename(name.value);
    }

    let roleId: string | undefined;
    if (input.role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(input.role as RoleName)) {
        return Result.fail(AppError.roleNotFound(input.role));
      }
      const role = await this.roles.findByName(input.role);
      if (!role) return Result.fail(AppError.roleNotFound(input.role));
      roleId = role.id;
    }

    const deactivating = input.isActive === false && user.isActive;
    if (input.isActive === true) user.activate();
    if (input.isActive === false) user.deactivate();

    await this.users.save(user);
    if (roleId) await this.users.replaceRole(user.id, roleId);

    // Deactivation and role changes end every open session right away.
    if (deactivating || roleId) {
      await this.refreshTokens.revokeAllForUser(user.id);
    }

    const roleNames = (await this.roles.findRolesForUser(user.id)).map((role) => role.name);
    return Result.ok(toUserSummary(user, roleNames));
  }
}
