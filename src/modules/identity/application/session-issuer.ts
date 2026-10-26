import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { Role } from '../domain/entities/role.entity';
import { User } from '../domain/entities/user.entity';
import { ROLE_REPOSITORY, IRoleRepository } from '../domain/repositories/role.repository';
import { SessionTokens } from './dto/session-tokens';
import { REFRESH_TOKEN_STORE, IRefreshTokenStorePort } from './ports/refresh-token-store.port';
import { TOKEN_SERVICE, ITokenServicePort } from './ports/token.port';

export const SESSION_ISSUER = Symbol('SESSION_ISSUER');

/** Signs an access token with the user's current roles/permissions. */
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenServicePort,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: IRefreshTokenStorePort,
    private readonly config: AppConfigService,
  ) {}

  async accessTokenFor(user: User): Promise<string> {
    const roles = await this.roles.findRolesForUser(user.id);
    const { roleNames, permissions } = Role.toClaims(roles);
    return this.tokens.signAccessToken({
      sub: user.id,
      email: user.email.toString(),
      roles: roleNames,
      permissions,
    });
  }

  /** New session: access token + freshly issued refresh token. */
  async openSession(user: User): Promise<SessionTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.accessTokenFor(user),
      this.refreshTokens.issue(user.id),
    ]);
    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresInSeconds: this.config.jwt.accessTokenTtlSeconds,
    };
  }
}
