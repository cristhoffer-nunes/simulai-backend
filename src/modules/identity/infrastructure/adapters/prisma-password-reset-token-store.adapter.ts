import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { IPasswordResetTokenStorePort } from '../../application/ports/password-reset-token-store.port';

// One row per user (password_reset_links): issuing a new link overwrites the jti, so the previous
// link stops working; completing the reset deletes the row (single use).
@Injectable()
export class PrismaPasswordResetTokenStoreAdapter implements IPasswordResetTokenStorePort {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.prisma.passwordResetLink.upsert({
      where: { userId },
      create: { userId, jti, expiresAt },
      update: { jti, expiresAt },
    });
  }

  async isValid(userId: string, jti: string): Promise<boolean> {
    const link = await this.prisma.passwordResetLink.findUnique({ where: { userId } });
    return Boolean(link && link.jti === jti && link.expiresAt.getTime() > Date.now());
  }

  async consume(userId: string): Promise<void> {
    await this.prisma.passwordResetLink.deleteMany({ where: { userId } });
  }
}
