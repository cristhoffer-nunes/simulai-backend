import { Inject, Injectable } from '@nestjs/common';
import { AppError, ExamErrors, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { AnswerRejection, AttemptAnswer } from '../../domain/attempt.entity';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';

export interface SaveAnswerInput {
  userId: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
}

export interface SavedAnswer {
  questionId: string;
  selectedOptionId: string | null;
  answeredAt: Date;
}

export interface ISaveAnswerUseCase {
  execute(input: SaveAnswerInput): Promise<Result<SavedAnswer, AppError>>;
}

export const SAVE_ANSWER_USE_CASE = Symbol('SAVE_ANSWER_USE_CASE');

/**
 * PUT semantics (RN-021): saving the same mark twice is harmless. Late answers are refused and,
 * if the deadline passed, the attempt is closed as a timeout in the same locked transaction.
 */
@Injectable()
export class SaveAnswerUseCase implements ISaveAnswerUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
  ) {}

  async execute(input: SaveAnswerInput): Promise<Result<SavedAnswer, AppError>> {
    const found = await this.attempts.findOwned(input.userId, input.attemptId);
    if (!found) return Result.fail(ResourceErrors.notFound('Attempt'));
    const simulation = await this.simulations.findOwned(input.userId, found.simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Attempt'));

    const now = new Date();
    const locked = await this.attempts.withLock(input.userId, input.attemptId, (attempt) => {
      const result = attempt.answer(
        simulation.questions,
        input.questionId,
        input.selectedOptionId,
        now,
      );
      if (result.isFailure && result.error === 'DEADLINE_PASSED') {
        attempt.finish(simulation.questions, 'timeout', now);
      }
      return result;
    });
    if (!locked) return Result.fail(ResourceErrors.notFound('Attempt'));

    const result = locked.value;
    if (result.isFailure) return Result.fail(this.toError(result.error, locked.attempt.status));
    const answer: AttemptAnswer = result.value;
    return Result.ok({
      questionId: answer.simulationQuestionId,
      selectedOptionId: answer.selectedOptionId,
      answeredAt: answer.answeredAt,
    });
  }

  private toError(rejection: AnswerRejection, status: string): AppError {
    switch (rejection) {
      case 'UNKNOWN_QUESTION':
        return ResourceErrors.notFound('Question');
      case 'UNKNOWN_OPTION':
        return AppError.validation('This option does not exist in the question.', [
          { path: 'selectedOptionId', code: 'UNKNOWN_OPTION_ID', message: 'Unknown option.' },
        ]);
      default:
        return ExamErrors.attemptFinished(status);
    }
  }
}
