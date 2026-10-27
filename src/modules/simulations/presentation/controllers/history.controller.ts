import { Controller, Get, Header, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import { StudyAccess } from '../../../question-bank/presentation/study-access';
import {
  GET_DASHBOARD_USE_CASE,
  IGetDashboardUseCase,
} from '../../application/use-cases/get-dashboard.use-case';
import {
  IListAttemptsUseCase,
  LIST_ATTEMPTS_USE_CASE,
} from '../../application/use-cases/list-attempts.use-case';
import { ListAttemptsQueryDto } from '../dto/simulation.dto';

/** RES-02: history of attempts and the home dashboard. Always the signed-in student's own data. */
@ApiTags('Histórico')
@StudyAccess()
@Controller()
export class HistoryController {
  constructor(
    @Inject(LIST_ATTEMPTS_USE_CASE) private readonly listAttempts: IListAttemptsUseCase,
    @Inject(GET_DASHBOARD_USE_CASE) private readonly getDashboard: IGetDashboardUseCase,
  ) {}

  @Get('attempts')
  @Header('Cache-Control', 'no-store')
  async list(@CurrentUser() user: AccessTokenClaims, @Query() query: ListAttemptsQueryDto) {
    const result = await this.listAttempts.execute({ userId: user.sub, ...query });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get('simulations/:id/attempts')
  @Header('Cache-Control', 'no-store')
  async ofSimulation(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
    @Query() query: ListAttemptsQueryDto,
  ) {
    const result = await this.listAttempts.execute({ ...query, userId: user.sub, simulationId });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get('dashboard/overview')
  @Header('Cache-Control', 'no-store')
  async overview(@CurrentUser() user: AccessTokenClaims) {
    const result = await this.getDashboard.execute(user.sub);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }
}
