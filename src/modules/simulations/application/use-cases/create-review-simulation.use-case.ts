import { Inject, Injectable } from '@nestjs/common';
import { AppError, ExamErrors, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { reviewSimulationFrom } from '../../domain/review';
import { Simulation } from '../../domain/simulation.entity';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { SimulationView, toSimulationView } from '../dto/simulation-views';

export interface ICreateReviewSimulationUseCase {
  execute(userId: string, attemptId: string): Promise<Result<SimulationView, AppError>>;
}

export const CREATE_REVIEW_SIMULATION_USE_CASE = Symbol('CREATE_REVIEW_SIMULATION_USE_CASE');

/** "Treinar só as erradas" from a finished attempt (the answer key is known only after it ends). */
@Injectable()
export class CreateReviewSimulationUseCase implements ICreateReviewSimulationUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
  ) {}

  async execute(userId: string, attemptId: string): Promise<Result<SimulationView, AppError>> {
    let attempt = await this.attempts.findOwned(userId, attemptId);
    if (!attempt) return Result.fail(ResourceErrors.notFound('Attempt'));
    const simulation = await this.simulations.findOwned(userId, attempt.simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Attempt'));

    if (attempt.isActive && attempt.isPastDeadline()) {
      const locked = await this.attempts.withLock(userId, attemptId, (current) =>
        current.finish(simulation.questions, 'timeout'),
      );
      if (locked) attempt = locked.attempt;
    }
    if (attempt.isActive) return Result.fail(ExamErrors.attemptInProgress());

    const plan = reviewSimulationFrom(simulation, attempt);
    if (plan.isFailure) {
      return Result.fail(ResourceErrors.conflict('Every question was right: nothing to review.'));
    }
    const review = Simulation.create(plan.value);
    await this.simulations.create(review);
    return Result.ok(toSimulationView(review));
  }
}
