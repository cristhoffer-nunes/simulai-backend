import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../../config/app-config.service';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { buildAccessUrl, humanizeTtl, linkTypeFor } from '../access-link';
import { EMAIL_PORT, IEmailPort } from '../ports/email.port';
import { RATE_LIMITER, IRateLimiterPort } from '../ports/rate-limiter.port';
import {
  PASSWORD_RESET_TOKEN_SERVICE,
  IPasswordResetTokenPort,
} from '../ports/password-reset-token.port';
import {
  PASSWORD_RESET_TOKEN_STORE,
  IPasswordResetTokenStorePort,
} from '../ports/password-reset-token-store.port';

export interface ForgotPasswordInput {
  email: string;
  ip: string;
}

export interface IForgotPasswordUseCase {
  execute(input: ForgotPasswordInput): Promise<Result<void, AppError>>;
}

export const FORGOT_PASSWORD_USE_CASE = Symbol('FORGOT_PASSWORD_USE_CASE');

// Same response whether or not the account exists, the limit was hit or the email was sent — any
// difference would turn this endpoint into a user-existence oracle.
@Injectable()
export class ForgotPasswordUseCase implements IForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(RATE_LIMITER) private readonly rateLimiter: IRateLimiterPort,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE) private readonly resetTokens: IPasswordResetTokenPort,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly resetTokenStore: IPasswordResetTokenStorePort,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    private readonly config: AppConfigService,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<Result<void, AppError>> {
    const email = input.email.trim().toLowerCase();
    const { maxAttempts, windowSeconds } = this.config.forgotPasswordRateLimit;

    const [emailLimit, ipLimit] = await Promise.all([
      this.rateLimiter.consume(`forgot-password:email:${email}`, maxAttempts, windowSeconds),
      this.rateLimiter.consume(`forgot-password:ip:${input.ip}`, maxAttempts, windowSeconds),
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      return Result.ok(undefined);
    }

    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      return Result.ok(undefined);
    }

    try {
      const type = linkTypeFor(user.mustChangePassword);
      const { token, jti, ttlSeconds } = await this.resetTokens.issue(
        user.id,
        user.email.toString(),
        type,
      );
      await this.resetTokenStore.save(user.id, jti, ttlSeconds);

      await this.email.sendPasswordResetEmail({
        to: user.email.toString(),
        resetUrl: buildAccessUrl(this.config.frontendUrl, token),
        validFor: humanizeTtl(ttlSeconds),
      });
    } catch (error) {
      this.logger.warn(`Failed to send password-reset email: ${(error as Error).message}`);
    }

    return Result.ok(undefined);
  }
}
