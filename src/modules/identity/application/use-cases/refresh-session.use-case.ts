import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/app-config.service';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { SessionTokens } from '../dto/session-tokens';
import { RATE_LIMITER, IRateLimiterPort } from '../ports/rate-limiter.port';
import { REFRESH_TOKEN_STORE, IRefreshTokenStorePort } from '../ports/refresh-token-store.port';
import { SESSION_ISSUER, SessionIssuer } from '../session-issuer';

export interface RefreshSessionInput {
  refreshToken: string;
  ip: string;
}

export interface IRefreshSessionUseCase {
  execute(input: RefreshSessionInput): Promise<Result<SessionTokens, AppError>>;
}

export const REFRESH_SESSION_USE_CASE = Symbol('REFRESH_SESSION_USE_CASE');

@Injectable()
export class RefreshSessionUseCase implements IRefreshSessionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: IRefreshTokenStorePort,
    @Inject(RATE_LIMITER) private readonly rateLimiter: IRateLimiterPort,
    @Inject(SESSION_ISSUER) private readonly sessions: SessionIssuer,
    private readonly config: AppConfigService,
  ) {}

  async execute(input: RefreshSessionInput): Promise<Result<SessionTokens, AppError>> {
    const rateLimitKey = `refresh:${input.ip}`;
    const { maxAttempts, windowSeconds } = this.config.refreshRateLimit;

    const rateLimit = await this.rateLimiter.consume(rateLimitKey, maxAttempts, windowSeconds);
    if (!rateLimit.allowed) {
      return Result.fail(AppError.rateLimited(rateLimit.retryAfterSeconds));
    }

    const rotated = await this.refreshTokens.rotate(input.refreshToken);
    if (!rotated) {
      return Result.fail(AppError.invalidRefreshToken());
    }

    const user = await this.users.findById(rotated.userId);
    if (!user || !user.isActive || user.mustChangePassword) {
      await this.refreshTokens.revokeAllForUser(rotated.userId);
      return Result.fail(AppError.invalidRefreshToken());
    }

    await this.rateLimiter.reset(rateLimitKey);

    // Roles are re-read on every refresh, so a role change applies within one access-token TTL.
    const accessToken = await this.sessions.accessTokenFor(user);

    return Result.ok({
      accessToken,
      refreshToken: rotated.token,
      expiresInSeconds: this.config.jwt.accessTokenTtlSeconds,
    });
  }
}
