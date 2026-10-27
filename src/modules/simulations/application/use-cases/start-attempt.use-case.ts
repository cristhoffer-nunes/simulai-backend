import { Inject, Injectable } from '@nestjs/common';
import { AppError, ExamErrors, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { Attempt } from '../../domain/attempt.entity';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';

export interface StartedAttempt {
  id: string;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  serverNow: Date;
  totalQuestions: number;
}

export interface IStartAttemptUseCase {
  execute(userId: string, simulationId: string): Promise<Result<StartedAttempt, AppError>>;
}

export const START_ATTEMPT_USE_CASE = Symbol('START_ATTEMPT_USE_CASE');

/**
 * RN-023: one attempt in progress per simulation. An active attempt whose time already ran out
 * is closed first (as a timeout), so the student can start again.
 */
@Injectable()
export class StartAttemptUseCase implements IStartAttemptUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
  ) {}

  async execute(userId: string, simulationId: string): Promise<Result<StartedAttempt, AppError>> {
    const simulation = await this.simulations.findOwned(userId, simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Simulation'));
    if (simulation.status === 'archived') return Result.fail(ExamErrors.simulationArchived());

    const active = await this.attempts.findActive(userId, simulationId);
    if (active) {
      const now = new Date();
      if (!active.isPastDeadline(now))
        return Result.fail(ExamErrors.attemptAlreadyActive(active.id));
      await this.attempts.withLock(userId, active.id, (locked) =>
        locked.finish(simulation.questions, 'timeout', now),
      );
    }

    const attempt = Attempt.start(simulation);
    if (!(await this.attempts.create(attempt))) {
      // Two "start" clicks at once: the other request won.
      const winner = await this.attempts.findActive(userId, simulationId);
      return Result.fail(ExamErrors.attemptAlreadyActive(winner?.id ?? ''));
    }
    return Result.ok({
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      serverNow: new Date(),
      totalQuestions: simulation.questionCount,
    });
  }
}
