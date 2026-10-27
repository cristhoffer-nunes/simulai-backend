import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
  QuestionDetail,
} from '../../domain/questions/question.repository';

export interface IGetQuestionUseCase {
  execute(userId: string, questionId: string): Promise<Result<QuestionDetail, AppError>>;
}

export const GET_QUESTION_USE_CASE = Symbol('GET_QUESTION_USE_CASE');

/** The student's own question, with the correct option (this is the editor, not an exam). */
@Injectable()
export class GetQuestionUseCase implements IGetQuestionUseCase {
  constructor(@Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository) {}

  async execute(userId: string, questionId: string): Promise<Result<QuestionDetail, AppError>> {
    const detail = await this.questions.detail(userId, questionId);
    return detail ? Result.ok(detail) : Result.fail(ResourceErrors.notFound('Question'));
  }
}
