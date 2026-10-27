import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AttemptExpiryService } from './application/attempt-expiry.service';
import { QUESTION_POOL } from './application/ports/question-pool.port';
import {
  FINISH_ATTEMPT_USE_CASE,
  FinishAttemptUseCase,
} from './application/use-cases/finish-attempt.use-case';
import {
  GET_ATTEMPT_USE_CASE,
  GetAttemptUseCase,
} from './application/use-cases/get-attempt.use-case';
import {
  SAVE_ANSWER_USE_CASE,
  SaveAnswerUseCase,
} from './application/use-cases/save-answer.use-case';
import {
  START_ATTEMPT_USE_CASE,
  StartAttemptUseCase,
} from './application/use-cases/start-attempt.use-case';
import { ATTEMPT_REPOSITORY } from './domain/attempt.repository';
import { ATTEMPT_STATS_QUERY } from './application/ports/attempt-stats.port';
import {
  GET_ATTEMPT_RESULT_USE_CASE,
  GetAttemptResultUseCase,
} from './application/use-cases/get-attempt-result.use-case';
import { PrismaAttemptStatsQuery } from './infrastructure/prisma-attempt-stats.query';
import { PrismaAttemptRepository } from './infrastructure/prisma-attempt.repository';
import { AttemptsController } from './presentation/controllers/attempts.controller';
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
  controllers: [SimulationsController, AttemptsController],
  providers: [
    { provide: QUESTION_POOL, useClass: PrismaQuestionPoolAdapter },
    { provide: SIMULATION_REPOSITORY, useClass: PrismaSimulationRepository },
    { provide: GET_AVAILABILITY_USE_CASE, useClass: GetAvailabilityUseCase },
    { provide: CREATE_SIMULATION_USE_CASE, useClass: CreateSimulationUseCase },
    { provide: LIST_SIMULATIONS_USE_CASE, useClass: ListSimulationsUseCase },
    { provide: GET_SIMULATION_USE_CASE, useClass: GetSimulationUseCase },
    { provide: SET_SIMULATION_STATUS_USE_CASE, useClass: SetSimulationStatusUseCase },
    { provide: ATTEMPT_REPOSITORY, useClass: PrismaAttemptRepository },
    { provide: START_ATTEMPT_USE_CASE, useClass: StartAttemptUseCase },
    { provide: GET_ATTEMPT_USE_CASE, useClass: GetAttemptUseCase },
    { provide: SAVE_ANSWER_USE_CASE, useClass: SaveAnswerUseCase },
    { provide: FINISH_ATTEMPT_USE_CASE, useClass: FinishAttemptUseCase },
    { provide: ATTEMPT_STATS_QUERY, useClass: PrismaAttemptStatsQuery },
    { provide: GET_ATTEMPT_RESULT_USE_CASE, useClass: GetAttemptResultUseCase },
    AttemptExpiryService,
  ],
})
export class SimulationsModule {}
