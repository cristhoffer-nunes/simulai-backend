import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get jwt() {
    return {
      privateKeyPath: this.config.get('JWT_PRIVATE_KEY_PATH', { infer: true }),
      publicKeyPath: this.config.get('JWT_PUBLIC_KEY_PATH', { infer: true }),
      accessTokenTtlSeconds: this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
      refreshTokenTtlSeconds: this.config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true }),
    };
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get loginRateLimit() {
    return {
      maxAttempts: this.config.get('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', { infer: true }),
      windowSeconds: this.config.get('LOGIN_RATE_LIMIT_WINDOW_SECONDS', { infer: true }),
    };
  }

  get refreshRateLimit() {
    return {
      maxAttempts: this.config.get('REFRESH_RATE_LIMIT_MAX_ATTEMPTS', { infer: true }),
      windowSeconds: this.config.get('REFRESH_RATE_LIMIT_WINDOW_SECONDS', { infer: true }),
    };
  }

  get passwordReset() {
    return {
      recoveryTtlSeconds: this.config.get('PASSWORD_RESET_TOKEN_TTL_SECONDS', { infer: true }),
      firstAccessTtlSeconds: this.config.get('FIRST_ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
    };
  }

  get forgotPasswordRateLimit() {
    return {
      maxAttempts: this.config.get('FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS', { infer: true }),
      windowSeconds: this.config.get('FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS', { infer: true }),
    };
  }

  get frontendUrl(): string {
    return this.config.get('FRONTEND_URL', { infer: true }).replace(/\/$/, '');
  }

  get email() {
    return {
      resendApiKey: this.config.get('RESEND_API_KEY', { infer: true }) ?? '',
      fromAddress: this.config.get('EMAIL_FROM', { infer: true }),
    };
  }
}
