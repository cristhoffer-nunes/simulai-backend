import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  COLLECTION_REPOSITORY,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
} from '../../domain/questions/question.repository';

export interface AddQuestionsInput {
  userId: string;
  collectionId: string;
  questionIds: string[];
}

export interface IAddQuestionsToCollectionUseCase {
  execute(input: AddQuestionsInput): Promise<Result<{ added: number }, AppError>>;
}

export const ADD_QUESTIONS_TO_COLLECTION_USE_CASE = Symbol('ADD_QUESTIONS_TO_COLLECTION_USE_CASE');

/**
 * Adds questions to a collection. Both must belong to the student (data model: membership only
 * within the owner's own bank). Already-present questions are ignored, so retrying is safe.
 */
@Injectable()
export class AddQuestionsToCollectionUseCase implements IAddQuestionsToCollectionUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository,
    @Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository,
  ) {}

  async execute(input: AddQuestionsInput): Promise<Result<{ added: number }, AppError>> {
    const collection = await this.collections.findOwned(input.userId, input.collectionId);
    if (!collection) return Result.fail(ResourceErrors.notFound('Collection'));

    const unique = [...new Set(input.questionIds)];
    const owned = await this.questions.ownedIds(input.userId, unique);
    if (owned.length !== unique.length) return Result.fail(ResourceErrors.notFound('Question'));

    const added = await this.collections.addQuestions(collection.id, unique);
    return Result.ok({ added });
  }
}
