import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { AttemptView, toAttemptView } from '../dto/attempt-views';

export interface IGetAttemptUseCase {
  execute(userId: string, attemptId: string): Promise<Result<AttemptView, AppError>>;
}

export const GET_ATTEMPT_USE_CASE = Symbol('GET_ATTEMPT_USE_CASE');

/**
 * Loads an attempt to (re)open the exam: questions without key, saved answers and the server
 * clock. An attempt whose time ran out is closed right here, without waiting for the job.
 */
@Injectable()
export class GetAttemptUseCase implements IGetAttemptUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
  ) {}

  async execute(userId: string, attemptId: string): Promise<Result<AttemptView, AppError>> {
    let attempt = await this.attempts.findOwned(userId, attemptId);
    if (!attempt) return Result.fail(ResourceErrors.notFound('Attempt'));
    const simulation = await this.simulations.findOwned(userId, attempt.simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Attempt'));

    const now = new Date();
    if (attempt.isActive && attempt.isPastDeadline(now)) {
      const locked = await this.attempts.withLock(userId, attemptId, (current) =>
        current.finish(simulation.questions, 'timeout', now),
      );
      if (locked) attempt = locked.attempt;
    }

    const number = await this.attempts.attemptNumber(attempt);
    return Result.ok(toAttemptView(attempt, simulation, number, now));
  }
}
