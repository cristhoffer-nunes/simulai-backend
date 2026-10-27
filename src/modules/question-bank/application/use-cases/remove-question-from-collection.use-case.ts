import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  COLLECTION_REPOSITORY,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';

export interface IRemoveQuestionFromCollectionUseCase {
  execute(
    userId: string,
    collectionId: string,
    questionId: string,
  ): Promise<Result<void, AppError>>;
}

export const REMOVE_QUESTION_FROM_COLLECTION_USE_CASE = Symbol(
  'REMOVE_QUESTION_FROM_COLLECTION_USE_CASE',
);

/** Takes a question out of a collection (idempotent). The question itself is untouched. */
@Injectable()
export class RemoveQuestionFromCollectionUseCase implements IRemoveQuestionFromCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository) {}

  async execute(
    userId: string,
    collectionId: string,
    questionId: string,
  ): Promise<Result<void, AppError>> {
    const collection = await this.collections.findOwned(userId, collectionId);
    if (!collection) return Result.fail(ResourceErrors.notFound('Collection'));
    await this.collections.removeQuestion(collection.id, questionId);
    return Result.ok(undefined);
  }
}
