import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { RateLimitCheck, IRateLimiterPort } from '../../application/ports/rate-limiter.port';

const MAX_KEY_LENGTH = 320;

// Fixed-window counter in rate_limit_buckets. One upsert does increment-or-restart atomically, so
// concurrent attempts are all counted.
@Injectable()
export class PrismaRateLimiterAdapter implements IRateLimiterPort {
  constructor(private readonly prisma: PrismaService) {}

  async consume(key: string, maxAttempts: number, windowSeconds: number): Promise<RateLimitCheck> {
    const bucket = this.bucketKey(key);
    const rows = await this.prisma.$queryRaw<{ attempts: number; retry_after: number }[]>`
      INSERT INTO "simulai_service"."rate_limit_buckets" AS b ("key", "attempts", "window_ends_at")
      VALUES (${bucket}, 1, now() + make_interval(secs => ${windowSeconds}::float8))
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN b."window_ends_at" <= now() THEN 1 ELSE b."attempts" + 1 END,
        "window_ends_at" = CASE WHEN b."window_ends_at" <= now()
                                THEN EXCLUDED."window_ends_at" ELSE b."window_ends_at" END
      RETURNING "attempts",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("window_ends_at" - now()))))::int AS "retry_after"`;

    const row = rows[0];
    if (!row || row.attempts <= maxAttempts) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: row.retry_after };
  }

  async reset(key: string): Promise<void> {
    await this.prisma.rateLimitBucket.deleteMany({ where: { key: this.bucketKey(key) } });
  }

  private bucketKey(key: string): string {
    if (key.length <= MAX_KEY_LENGTH) return key;
    return `sha256:${createHash('sha256').update(key).digest('hex')}`;
  }
}
