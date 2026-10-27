import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  COLLECTION_REPOSITORY,
  CollectionSummary,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';

export interface IListCollectionsUseCase {
  execute(userId: string): Promise<Result<{ items: CollectionSummary[] }, AppError>>;
}

export const LIST_COLLECTIONS_USE_CASE = Symbol('LIST_COLLECTIONS_USE_CASE');

@Injectable()
export class ListCollectionsUseCase implements IListCollectionsUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository) {}

  async execute(userId: string): Promise<Result<{ items: CollectionSummary[] }, AppError>> {
    return Result.ok({ items: await this.collections.listByOwner(userId) });
  }
}
