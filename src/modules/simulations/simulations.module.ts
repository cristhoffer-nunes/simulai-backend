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
  CONFIRM_ANSWER_USE_CASE,
  ConfirmAnswerUseCase,
} from './application/use-cases/confirm-answer.use-case';
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
import { PERFORMANCE_QUERY } from './application/ports/performance-query.port';
import {
  GET_DASHBOARD_USE_CASE,
  GetDashboardUseCase,
} from './application/use-cases/get-dashboard.use-case';
import {
  LIST_ATTEMPTS_USE_CASE,
  ListAttemptsUseCase,
} from './application/use-cases/list-attempts.use-case';
import { PrismaPerformanceQuery } from './infrastructure/prisma-performance.query';
import { HistoryController } from './presentation/controllers/history.controller';
import {
  CREATE_REVIEW_SIMULATION_USE_CASE,
  CreateReviewSimulationUseCase,
} from './application/use-cases/create-review-simulation.use-case';
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
  controllers: [SimulationsController, AttemptsController, HistoryController],
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
    { provide: CONFIRM_ANSWER_USE_CASE, useClass: ConfirmAnswerUseCase },
    { provide: FINISH_ATTEMPT_USE_CASE, useClass: FinishAttemptUseCase },
    { provide: ATTEMPT_STATS_QUERY, useClass: PrismaAttemptStatsQuery },
    { provide: GET_ATTEMPT_RESULT_USE_CASE, useClass: GetAttemptResultUseCase },
    { provide: PERFORMANCE_QUERY, useClass: PrismaPerformanceQuery },
    { provide: LIST_ATTEMPTS_USE_CASE, useClass: ListAttemptsUseCase },
    { provide: GET_DASHBOARD_USE_CASE, useClass: GetDashboardUseCase },
    { provide: CREATE_REVIEW_SIMULATION_USE_CASE, useClass: CreateReviewSimulationUseCase },
    AttemptExpiryService,
  ],
})
export class SimulationsModule {}
