import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfigService } from '../../../../config/app-config.service';
import {
  AccessTokenClaims,
  AccessTokenPayload,
  ITokenServicePort,
} from '../../application/ports/token.port';

export const ACCESS_TOKEN_AUDIENCE = 'simulai';
export const TOKEN_ISSUER = 'simulai-backend';

@Injectable()
export class JwtRs256TokenAdapter implements ITokenServicePort {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.privateKey = readFileSync(resolve(config.jwt.privateKeyPath), 'utf8');
    this.publicKey = readFileSync(resolve(config.jwt.publicKeyPath), 'utf8');
  }

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      privateKey: this.privateKey,
      algorithm: 'RS256',
      expiresIn: this.config.jwt.accessTokenTtlSeconds,
      audience: ACCESS_TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      return await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
        audience: ACCESS_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }

  getPublicKeyPem(): string {
    return this.publicKey;
  }
}
