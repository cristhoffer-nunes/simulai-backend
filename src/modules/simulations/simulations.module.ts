import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { QUESTION_POOL } from './application/ports/question-pool.port';
import {
  CREATE_SIMULATION_USE_CASE,
  CreateSimulationUseCase,
} from './application/use-cases/create-simulation.use-case';
import {
  GET_AVAILABILITY_USE_CASE,
  GetAvailabilityUseCase,
} from './application/use-cases/get-availability.use-case';
import {
  GET_SIMULATION_USE_CASE,
  GetSimulationUseCase,
} from './application/use-cases/get-simulation.use-case';
import {
  LIST_SIMULATIONS_USE_CASE,
  ListSimulationsUseCase,
} from './application/use-cases/list-simulations.use-case';
import {
  SET_SIMULATION_STATUS_USE_CASE,
  SetSimulationStatusUseCase,
} from './application/use-cases/set-simulation-status.use-case';
import { SIMULATION_REPOSITORY } from './domain/simulation.repository';
import { PrismaQuestionPoolAdapter } from './infrastructure/prisma-question-pool.adapter';
import { PrismaSimulationRepository } from './infrastructure/prisma-simulation.repository';
import { SimulationsController } from './presentation/controllers/simulations.controller';

/** Exams: simulation definitions with frozen snapshots (Sprints 4–5). */
@Module({
  imports: [IdentityModule],
  controllers: [SimulationsController],
  providers: [
    { provide: QUESTION_POOL, useClass: PrismaQuestionPoolAdapter },
    { provide: SIMULATION_REPOSITORY, useClass: PrismaSimulationRepository },
    { provide: GET_AVAILABILITY_USE_CASE, useClass: GetAvailabilityUseCase },
    { provide: CREATE_SIMULATION_USE_CASE, useClass: CreateSimulationUseCase },
    { provide: LIST_SIMULATIONS_USE_CASE, useClass: ListSimulationsUseCase },
    { provide: GET_SIMULATION_USE_CASE, useClass: GetSimulationUseCase },
    { provide: SET_SIMULATION_STATUS_USE_CASE, useClass: SetSimulationStatusUseCase },
  ],
})
export class SimulationsModule {}
