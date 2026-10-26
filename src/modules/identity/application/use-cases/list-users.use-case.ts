import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { toUserSummary, UserSummary } from '../dto/user-summary';

export interface ListUsersInput {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive';
  page?: number;
  pageSize?: number;
}

export interface ListUsersOutput {
  items: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IListUsersUseCase {
  execute(input: ListUsersInput): Promise<Result<ListUsersOutput, AppError>>;
}

export const LIST_USERS_USE_CASE = Symbol('LIST_USERS_USE_CASE');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ListUsersUseCase implements IListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(input: ListUsersInput): Promise<Result<ListUsersOutput, AppError>> {
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)),
    );
    const search = input.search?.trim() || undefined;

    const { items, total } = await this.users.list({
      search,
      roleName: input.role,
      isActive: input.status === undefined ? undefined : input.status === 'active',
      page,
      pageSize,
    });

    return Result.ok({
      items: items.map(({ user, roleNames }) => toUserSummary(user, roleNames)),
      total,
      page,
      pageSize,
    });
  }
}
