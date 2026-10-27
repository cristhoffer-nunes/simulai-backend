import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { AttemptSummary, toAttemptSummary } from '../dto/attempt-views';

export interface IFinishAttemptUseCase {
  execute(userId: string, attemptId: string): Promise<Result<AttemptSummary, AppError>>;
}

export const FINISH_ATTEMPT_USE_CASE = Symbol('FINISH_ATTEMPT_USE_CASE');

/**
 * SIM-05: finishes and scores once; repeating returns the same result. If the time had already
 * run out, it is recorded as a timeout ending at the deadline.
 */
@Injectable()
export class FinishAttemptUseCase implements IFinishAttemptUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
  ) {}

  async execute(userId: string, attemptId: string): Promise<Result<AttemptSummary, AppError>> {
    const found = await this.attempts.findOwned(userId, attemptId);
    if (!found) return Result.fail(ResourceErrors.notFound('Attempt'));
    const simulation = await this.simulations.findOwned(userId, found.simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Attempt'));

    const now = new Date();
    const locked = await this.attempts.withLock(userId, attemptId, (attempt) =>
      attempt.finish(simulation.questions, attempt.isPastDeadline(now) ? 'timeout' : 'manual', now),
    );
    if (!locked) return Result.fail(ResourceErrors.notFound('Attempt'));
    return Result.ok(toAttemptSummary(locked.attempt));
  }
}
