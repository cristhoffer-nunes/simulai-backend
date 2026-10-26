import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfigService } from '../../../../config/app-config.service';
import {
  IPasswordResetTokenPort,
  IssuedResetToken,
  PasswordResetTokenClaims,
  PasswordResetTokenType,
} from '../../application/ports/password-reset-token.port';
import { TOKEN_ISSUER } from './jwt-rs256-token.adapter';

// Distinct audience from access tokens: a reset link can never be presented as a session.
export const RESET_TOKEN_AUDIENCE = 'simulai-password-reset';

@Injectable()
export class JwtPasswordResetTokenAdapter implements IPasswordResetTokenPort {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.privateKey = readFileSync(resolve(config.jwt.privateKeyPath), 'utf8');
    this.publicKey = readFileSync(resolve(config.jwt.publicKeyPath), 'utf8');
  }

  async issue(
    userId: string,
    email: string,
    type: PasswordResetTokenType,
  ): Promise<IssuedResetToken> {
    const jti = randomUUID();
    const ttlSeconds =
      type === 'first_access'
        ? this.config.passwordReset.firstAccessTtlSeconds
        : this.config.passwordReset.recoveryTtlSeconds;
    const token = await this.jwt.signAsync(
      { sub: userId, email, type, jti },
      {
        privateKey: this.privateKey,
        algorithm: 'RS256',
        expiresIn: ttlSeconds,
        audience: RESET_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      },
    );
    return { token, jti, ttlSeconds };
  }

  async verify(token: string): Promise<PasswordResetTokenClaims | null> {
    try {
      return await this.jwt.verifyAsync<PasswordResetTokenClaims>(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
        audience: RESET_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
    } catch {
      return null;
    }
  }
}
