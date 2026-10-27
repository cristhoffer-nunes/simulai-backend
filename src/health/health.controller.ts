import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { appVersion } from '../shared/app-version';
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator';

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const result = await this.health.check([() => this.prismaHealth.check('postgres')]);
    return { ...result, version: appVersion() };
  }
}
