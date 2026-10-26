import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Postgres check failed',
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
