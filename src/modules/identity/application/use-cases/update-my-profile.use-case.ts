import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { DisplayName } from '../../domain/value-objects/display-name.vo';

export interface UpdateMyProfileInput {
  userId: string;
  displayName: string;
}

export interface IUpdateMyProfileUseCase {
  execute(
    input: UpdateMyProfileInput,
  ): Promise<Result<{ displayName: string; initials: string }, AppError>>;
}

export const UPDATE_MY_PROFILE_USE_CASE = Symbol('UPDATE_MY_PROFILE_USE_CASE');

@Injectable()
export class UpdateMyProfileUseCase implements IUpdateMyProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(
    input: UpdateMyProfileInput,
  ): Promise<Result<{ displayName: string; initials: string }, AppError>> {
    const name = DisplayName.create(input.displayName);
    if (name.isFailure) {
      return Result.fail(AppError.validation(name.error));
    }

    const user = await this.users.findById(input.userId);
    if (!user || !user.isActive) {
      return Result.fail(AppError.userNotFound(input.userId));
    }

    user.rename(name.value);
    await this.users.save(user);

    return Result.ok({
      displayName: user.displayName.toString(),
      initials: user.displayName.initials(),
    });
  }
}
