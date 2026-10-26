import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

const EVERY_HOUR_MS = 60 * 60 * 1000;

/** Deletes expired sessions, links and rate-limit windows (they are already ignored when read). */
@Injectable()
export class AuthStateCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthStateCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.run(), EVERY_HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    const now = new Date();
    try {
      const [sessions, links, buckets] = await this.prisma.$transaction([
        this.prisma.authSession.deleteMany({ where: { expiresAt: { lte: now } } }),
        this.prisma.passwordResetLink.deleteMany({ where: { expiresAt: { lte: now } } }),
        this.prisma.rateLimitBucket.deleteMany({ where: { windowEndsAt: { lte: now } } }),
      ]);
      const total = sessions.count + links.count + buckets.count;
      if (total > 0) this.logger.log(`Removed ${total} expired auth records.`);
    } catch (error) {
      this.logger.warn(`Auth cleanup failed: ${(error as Error).message}`);
    }
  }
}
