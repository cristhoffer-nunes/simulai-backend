import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import { StudyAccess } from '../../../question-bank/presentation/study-access';
import {
  CREATE_SIMULATION_USE_CASE,
  ICreateSimulationUseCase,
} from '../../application/use-cases/create-simulation.use-case';
import {
  GET_AVAILABILITY_USE_CASE,
  IGetAvailabilityUseCase,
} from '../../application/use-cases/get-availability.use-case';
import {
  GET_SIMULATION_USE_CASE,
  IGetSimulationUseCase,
} from '../../application/use-cases/get-simulation.use-case';
import {
  IListSimulationsUseCase,
  LIST_SIMULATIONS_USE_CASE,
} from '../../application/use-cases/list-simulations.use-case';
import {
  ISetSimulationStatusUseCase,
  SET_SIMULATION_STATUS_USE_CASE,
} from '../../application/use-cases/set-simulation-status.use-case';
import {
  AvailabilityQueryDto,
  CreateSimulationDto,
  ListSimulationsQueryDto,
  UpdateSimulationDto,
} from '../dto/simulation.dto';

@ApiTags('Simulados')
@StudyAccess()
@Controller('simulations')
export class SimulationsController {
  constructor(
    @Inject(GET_AVAILABILITY_USE_CASE) private readonly availability: IGetAvailabilityUseCase,
    @Inject(CREATE_SIMULATION_USE_CASE) private readonly createSimulation: ICreateSimulationUseCase,
    @Inject(LIST_SIMULATIONS_USE_CASE) private readonly listSimulations: IListSimulationsUseCase,
    @Inject(GET_SIMULATION_USE_CASE) private readonly getSimulation: IGetSimulationUseCase,
    @Inject(SET_SIMULATION_STATUS_USE_CASE) private readonly setStatus: ISetSimulationStatusUseCase,
  ) {}

  /** Eligible questions per subject for the configurator (difficulty and collection filters). */
  @Get('availability')
  async available(@CurrentUser() user: AccessTokenClaims, @Query() query: AvailabilityQueryDto) {
    const result = await this.availability.execute({
      userId: user.sub,
      difficulty: query.difficulty ?? 'all',
      collectionId: query.collectionId,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AccessTokenClaims, @Body() dto: CreateSimulationDto) {
    const result = await this.createSimulation.execute({ userId: user.sub, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get()
  async list(@CurrentUser() user: AccessTokenClaims, @Query() query: ListSimulationsQueryDto) {
    const result = await this.listSimulations.execute({ userId: user.sub, ...query });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.getSimulation.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSimulationDto,
  ) {
    const result = await this.setStatus.execute(user.sub, id, dto.status);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }
}
