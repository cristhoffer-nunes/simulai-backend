import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfigService } from '../../../../config/app-config.service';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IssuedRefreshToken,
  IRefreshTokenStorePort,
  RotatedRefreshToken,
} from '../../application/ports/refresh-token-store.port';

// Opaque refresh tokens (256 random bits), stored only as SHA-256 hashes in auth_sessions.
// Rotation deletes the old row and inserts the new one in one transaction; the DELETE ... RETURNING
// is atomic, so the same token presented twice (replay or race) only works once.
@Injectable()
export class PrismaRefreshTokenStoreAdapter implements IRefreshTokenStorePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const token = this.newToken();
    const tokenId = this.hash(token);
    const expiresAt = this.expiresAt();
    await this.prisma.authSession.create({ data: { tokenHash: tokenId, userId, expiresAt } });
    return { token, tokenId, expiresAt };
  }

  async rotate(token: string): Promise<RotatedRefreshToken | null> {
    const oldHash = this.hash(token);

    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.$queryRaw<{ user_id: string; expires_at: Date }[]>`
        DELETE FROM "simulai_service"."auth_sessions"
        WHERE "token_hash" = ${oldHash}
        RETURNING "user_id", "expires_at"`;

      const session = removed[0];
      if (!session || session.expires_at.getTime() <= Date.now()) return null;

      const newToken = this.newToken();
      const tokenId = this.hash(newToken);
      const expiresAt = this.expiresAt();
      await tx.authSession.create({
        data: { tokenHash: tokenId, userId: session.user_id, expiresAt },
      });

      return { token: newToken, tokenId, expiresAt, userId: session.user_id };
    });
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { tokenHash: this.hash(token) } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
  }

  private newToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiresAt(): Date {
    return new Date(Date.now() + this.config.jwt.refreshTokenTtlSeconds * 1000);
  }
}
