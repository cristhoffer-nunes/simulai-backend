import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/app-config.service';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { SessionTokens } from '../dto/session-tokens';
import { PASSWORD_HASHER, IPasswordHasherPort } from '../ports/password-hasher.port';
import { RATE_LIMITER, IRateLimiterPort } from '../ports/rate-limiter.port';
import {
  PASSWORD_RESET_TOKEN_SERVICE,
  IPasswordResetTokenPort,
} from '../ports/password-reset-token.port';
import {
  PASSWORD_RESET_TOKEN_STORE,
  IPasswordResetTokenStorePort,
} from '../ports/password-reset-token-store.port';
import { SESSION_ISSUER, SessionIssuer } from '../session-issuer';

export interface AuthenticateUserInput {
  email: string;
  password: string;
  ip: string;
}

// Returned instead of a session when the account still has a provisional password — the frontend
// redirects to /redefinir-senha?token=... instead of opening the app.
export interface PasswordResetRequiredOutput {
  passwordResetRequired: true;
  resetToken: string;
}

export type AuthenticateUserOutput = SessionTokens | PasswordResetRequiredOutput;

export interface IAuthenticateUserUseCase {
  execute(input: AuthenticateUserInput): Promise<Result<AuthenticateUserOutput, AppError>>;
}

export const AUTHENTICATE_USER_USE_CASE = Symbol('AUTHENTICATE_USER_USE_CASE');

@Injectable()
export class AuthenticateUserUseCase implements IAuthenticateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasherPort,
    @Inject(RATE_LIMITER) private readonly rateLimiter: IRateLimiterPort,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE) private readonly resetTokens: IPasswordResetTokenPort,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly resetTokenStore: IPasswordResetTokenStorePort,
    @Inject(SESSION_ISSUER) private readonly sessions: SessionIssuer,
    private readonly config: AppConfigService,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<Result<AuthenticateUserOutput, AppError>> {
    const email = input.email.trim().toLowerCase();
    const rateLimitKey = `login:${email}:${input.ip}`;
    const { maxAttempts, windowSeconds } = this.config.loginRateLimit;

    const rateLimit = await this.rateLimiter.consume(rateLimitKey, maxAttempts, windowSeconds);
    if (!rateLimit.allowed) {
      return Result.fail(AppError.rateLimited(rateLimit.retryAfterSeconds));
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      return Result.fail(AppError.invalidCredentials());
    }

    const passwordMatches = await this.hasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      return Result.fail(AppError.invalidCredentials());
    }

    // Checked only after the password: an inactive account is not revealed to a guesser.
    if (!user.isActive) {
      return Result.fail(AppError.userInactive());
    }

    await this.rateLimiter.reset(rateLimitKey);

    if (user.mustChangePassword) {
      const { token, jti, ttlSeconds } = await this.resetTokens.issue(
        user.id,
        user.email.toString(),
        'first_access',
      );
      await this.resetTokenStore.save(user.id, jti, ttlSeconds);
      return Result.ok({ passwordResetRequired: true, resetToken: token });
    }

    return Result.ok(await this.sessions.openSession(user));
  }
}
