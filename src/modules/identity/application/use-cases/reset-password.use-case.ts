import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { isStrongPassword } from '../../domain/services/password-policy';
import { SessionTokens } from '../dto/session-tokens';
import { EMAIL_PORT, IEmailPort } from '../ports/email.port';
import { PASSWORD_HASHER, IPasswordHasherPort } from '../ports/password-hasher.port';
import {
  PASSWORD_RESET_TOKEN_SERVICE,
  IPasswordResetTokenPort,
} from '../ports/password-reset-token.port';
import {
  PASSWORD_RESET_TOKEN_STORE,
  IPasswordResetTokenStorePort,
} from '../ports/password-reset-token-store.port';
import { REFRESH_TOKEN_STORE, IRefreshTokenStorePort } from '../ports/refresh-token-store.port';
import { SESSION_ISSUER, SessionIssuer } from '../session-issuer';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface IResetPasswordUseCase {
  execute(input: ResetPasswordInput): Promise<Result<SessionTokens, AppError>>;
}

export const RESET_PASSWORD_USE_CASE = Symbol('RESET_PASSWORD_USE_CASE');

@Injectable()
export class ResetPasswordUseCase implements IResetPasswordUseCase {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasherPort,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: IRefreshTokenStorePort,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE) private readonly resetTokens: IPasswordResetTokenPort,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly resetTokenStore: IPasswordResetTokenStorePort,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    @Inject(SESSION_ISSUER) private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: ResetPasswordInput): Promise<Result<SessionTokens, AppError>> {
    const claims = await this.resetTokens.verify(input.token);
    if (!claims) {
      return Result.fail(AppError.invalidResetToken());
    }

    const stillValid = await this.resetTokenStore.isValid(claims.sub, claims.jti);
    if (!stillValid) {
      return Result.fail(AppError.invalidResetToken());
    }

    if (!isStrongPassword(input.newPassword)) {
      return Result.fail(AppError.weakPassword());
    }

    const user = await this.users.findById(claims.sub);
    if (!user || !user.isActive) {
      return Result.fail(AppError.invalidResetToken());
    }

    user.changePasswordHash(await this.hasher.hash(input.newPassword));
    user.clearMustChangePassword();
    await this.users.save(user);

    // Single use: burn the link and every other session now that the password changed.
    await Promise.all([
      this.resetTokenStore.consume(claims.sub),
      this.refreshTokens.revokeAllForUser(claims.sub),
    ]);

    const session = await this.sessions.openSession(user);

    if (claims.type === 'recovery') {
      this.sendPasswordChangedNotice(user.email.toString());
    }

    return Result.ok(session);
  }

  // Fire-and-forget: how the holder learns about a reset they did not request.
  private sendPasswordChangedNotice(to: string): void {
    this.email.sendPasswordChangedEmail({ to, changedAt: new Date() }).catch((error) => {
      this.logger.warn(`Failed to send password-changed email: ${(error as Error).message}`);
    });
  }
}
