import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  PASSWORD_RESET_TOKEN_SERVICE,
  IPasswordResetTokenPort,
  PasswordResetTokenType,
} from '../ports/password-reset-token.port';
import {
  PASSWORD_RESET_TOKEN_STORE,
  IPasswordResetTokenStorePort,
} from '../ports/password-reset-token-store.port';

export interface ValidateResetTokenOutput {
  email: string;
  type: PasswordResetTokenType;
}

export interface IValidateResetTokenUseCase {
  execute(token: string): Promise<Result<ValidateResetTokenOutput, AppError>>;
}

export const VALIDATE_RESET_TOKEN_USE_CASE = Symbol('VALIDATE_RESET_TOKEN_USE_CASE');

// Read-only check on /redefinir-senha's page load, before the form is shown. Never consumes it.
@Injectable()
export class ValidateResetTokenUseCase implements IValidateResetTokenUseCase {
  constructor(
    @Inject(PASSWORD_RESET_TOKEN_SERVICE) private readonly resetTokens: IPasswordResetTokenPort,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly resetTokenStore: IPasswordResetTokenStorePort,
  ) {}

  async execute(token: string): Promise<Result<ValidateResetTokenOutput, AppError>> {
    const claims = await this.resetTokens.verify(token);
    if (!claims) {
      return Result.fail(AppError.invalidResetToken());
    }

    const stillValid = await this.resetTokenStore.isValid(claims.sub, claims.jti);
    if (!stillValid) {
      return Result.fail(AppError.invalidResetToken());
    }

    return Result.ok({ email: claims.email, type: claims.type });
  }
}
