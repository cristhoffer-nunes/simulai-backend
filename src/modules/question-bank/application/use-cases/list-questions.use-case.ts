import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { Difficulty } from '../../domain/questions/question-content';
import { QuestionStatus } from '../../domain/questions/question.entity';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
} from '../../domain/questions/question.repository';
import { decodeCursor, encodeCursor } from '../../../../shared/pagination/cursor';
import { QuestionListResponse } from '../dto/question-views';

export interface ListQuestionsInput {
  userId: string;
  status?: QuestionStatus;
  subjectId?: string;
  topicId?: string;
  difficulty?: Difficulty;
  q?: string;
  collectionId?: string;
  cursor?: string;
  limit?: number;
}

export interface IListQuestionsUseCase {
  execute(input: ListQuestionsInput): Promise<Result<QuestionListResponse, AppError>>;
}

export const LIST_QUESTIONS_USE_CASE = Symbol('LIST_QUESTIONS_USE_CASE');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Newest first, keyset-paginated (stable while questions are added). Defaults to active ones. */
@Injectable()
export class ListQuestionsUseCase implements IListQuestionsUseCase {
  constructor(@Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository) {}

  async execute(input: ListQuestionsInput): Promise<Result<QuestionListResponse, AppError>> {
    const after = input.cursor ? decodeCursor(input.cursor) : undefined;
    if (after === null) {
      return Result.fail(
        AppError.validation('Invalid cursor.', [
          { path: 'cursor', code: 'INVALID_CURSOR', message: 'Invalid cursor.' },
        ]),
      );
    }

    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT)));
    const page = await this.questions.list({
      ownerUserId: input.userId,
      status: input.status ?? 'active',
      subjectId: input.subjectId,
      topicId: input.topicId,
      difficulty: input.difficulty,
      search: input.q?.trim() || undefined,
      collectionId: input.collectionId,
      after,
      limit,
    });

    const last = page.items[page.items.length - 1];
    return Result.ok({
      items: page.items,
      total: page.total,
      nextCursor: page.hasMore && last ? encodeCursor(last) : null,
    });
  }
}
