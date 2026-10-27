import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { SimulationDifficulty } from '../../domain/simulation.entity';
import { IQuestionPoolPort, QUESTION_POOL, SubjectPool } from '../ports/question-pool.port';

export interface AvailabilityInput {
  userId: string;
  difficulty: SimulationDifficulty;
  collectionId?: string | null;
}

export interface IGetAvailabilityUseCase {
  execute(input: AvailabilityInput): Promise<Result<{ subjects: SubjectPool[] }, AppError>>;
}

export const GET_AVAILABILITY_USE_CASE = Symbol('GET_AVAILABILITY_USE_CASE');

/** How many eligible questions each subject has for these filters (simulation configurator). */
@Injectable()
export class GetAvailabilityUseCase implements IGetAvailabilityUseCase {
  constructor(@Inject(QUESTION_POOL) private readonly pool: IQuestionPoolPort) {}

  async execute(input: AvailabilityInput): Promise<Result<{ subjects: SubjectPool[] }, AppError>> {
    const collectionId = input.collectionId ?? null;
    if (collectionId && !(await this.pool.ownsCollection(input.userId, collectionId))) {
      return Result.fail(ResourceErrors.notFound('Collection'));
    }
    const subjects = await this.pool.availability({
      ownerUserId: input.userId,
      difficulty: input.difficulty,
      collectionId,
    });
    return Result.ok({ subjects });
  }
}
