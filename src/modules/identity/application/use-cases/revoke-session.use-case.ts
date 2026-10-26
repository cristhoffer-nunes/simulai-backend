import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { REFRESH_TOKEN_STORE, IRefreshTokenStorePort } from '../ports/refresh-token-store.port';

export interface IRevokeSessionUseCase {
  execute(refreshToken: string): Promise<Result<void, AppError>>;
}

export const REVOKE_SESSION_USE_CASE = Symbol('REVOKE_SESSION_USE_CASE');

@Injectable()
export class RevokeSessionUseCase implements IRevokeSessionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: IRefreshTokenStorePort,
  ) {}

  async execute(refreshToken: string): Promise<Result<void, AppError>> {
    await this.refreshTokens.revoke(refreshToken);
    return Result.ok(undefined);
  }
}
