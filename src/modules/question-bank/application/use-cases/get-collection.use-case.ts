import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  COLLECTION_REPOSITORY,
  CollectionSummary,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';

export interface IGetCollectionUseCase {
  execute(userId: string, collectionId: string): Promise<Result<CollectionSummary, AppError>>;
}

export const GET_COLLECTION_USE_CASE = Symbol('GET_COLLECTION_USE_CASE');

/** Collection data and count; its questions come from GET /questions?collectionId=. */
@Injectable()
export class GetCollectionUseCase implements IGetCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository) {}

  async execute(
    userId: string,
    collectionId: string,
  ): Promise<Result<CollectionSummary, AppError>> {
    const summary = await this.collections.summary(userId, collectionId);
    return summary ? Result.ok(summary) : Result.fail(ResourceErrors.notFound('Collection'));
  }
}
