import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';

// Prisma's defaults (2 s to start, 5 s to finish an interactive transaction) are too tight when the
// database is reached over the internet (e.g. running locally against the VPS): each statement
// pays the round trip. Transactions are kept short by design; these are safety margins.
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseUrl: string;

  constructor(config: AppConfigService) {
    super({
      datasources: { db: { url: config.databaseUrl } },
      transactionOptions: TRANSACTION_OPTIONS,
    });
    this.databaseUrl = config.databaseUrl;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    const url = new URL(this.databaseUrl);
    const database = url.pathname.replace(/^\//, '');
    const schema = url.searchParams.get('schema') ?? 'public';
    this.logger.log(`Connected to Postgres (database "${database}", schema "${schema}").`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
