import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './shared/database/prisma.module';
import { LoggerModule } from './shared/logging/logger.module';
import { ProblemDetailsFilter } from './shared/errors/problem-details.filter';
import { IdentityModule } from './modules/identity/identity.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, LoggerModule, PrismaModule, IdentityModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
