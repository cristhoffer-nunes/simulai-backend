import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
} from '../../domain/questions/question.repository';

export interface IArchiveQuestionUseCase {
  execute(userId: string, questionId: string): Promise<Result<void, AppError>>;
}

export const ARCHIVE_QUESTION_USE_CASE = Symbol('ARCHIVE_QUESTION_USE_CASE');

/**
 * DELETE /questions/:id archives (logical removal, API contract): the question leaves the bank's
 * default view and new simulations, but past exams and its history stay intact.
 */
@Injectable()
export class ArchiveQuestionUseCase implements IArchiveQuestionUseCase {
  constructor(@Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository) {}

  async execute(userId: string, questionId: string): Promise<Result<void, AppError>> {
    const question = await this.questions.findOwned(userId, questionId);
    if (!question) return Result.fail(ResourceErrors.notFound('Question'));
    question.archive();
    await this.questions.save(question);
    return Result.ok(undefined);
  }
}
