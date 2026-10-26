import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseUrl: string;

  constructor(config: AppConfigService) {
    super({ datasources: { db: { url: config.databaseUrl } } });
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
