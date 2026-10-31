import { Inject, Injectable } from '@nestjs/common';
import { AppError, ExamErrors, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { AttemptAnswerView, toAnswerView } from '../dto/attempt-views';

export interface ConfirmAnswerInput {
  userId: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string;
}

export interface IConfirmAnswerUseCase {
  execute(input: ConfirmAnswerInput): Promise<Result<AttemptAnswerView, AppError>>;
}

export const CONFIRM_ANSWER_USE_CASE = Symbol('CONFIRM_ANSWER_USE_CASE');

/**
 * Study mode: locks the answer to one question and returns its grading (right or wrong, the
 * correct option and the explanation). The key of a question leaves the server only after its
 * answer is final, so it can never be used to change that answer.
 */
@Injectable()
export class ConfirmAnswerUseCase implements IConfirmAnswerUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
  ) {}

  async execute(input: ConfirmAnswerInput): Promise<Result<AttemptAnswerView, AppError>> {
    const found = await this.attempts.findOwned(input.userId, input.attemptId);
    if (!found) return Result.fail(ResourceErrors.notFound('Attempt'));
    const simulation = await this.simulations.findOwned(input.userId, found.simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Attempt'));
    if (simulation.mode !== 'study') return Result.fail(ExamErrors.notStudyMode());

    const locked = await this.attempts.withLock(input.userId, input.attemptId, (attempt) =>
      attempt.confirm(simulation.questions, input.questionId, input.selectedOptionId),
    );
    if (!locked) return Result.fail(ResourceErrors.notFound('Attempt'));

    const result = locked.value;
    if (result.isFailure) {
      switch (result.error) {
        case 'UNKNOWN_QUESTION':
          return Result.fail(ResourceErrors.notFound('Question'));
        case 'UNKNOWN_OPTION':
          return Result.fail(
            AppError.validation('This option does not exist in the question.', [
              { path: 'selectedOptionId', code: 'UNKNOWN_OPTION_ID', message: 'Unknown option.' },
            ]),
          );
        case 'CONFIRMED':
          return Result.fail(ExamErrors.answerConfirmed());
        default:
          return Result.fail(ExamErrors.attemptFinished(locked.attempt.status));
      }
    }
    const question = simulation.questions.find((item) => item.id === input.questionId);
    return Result.ok(toAnswerView(result.value, question));
  }
}
