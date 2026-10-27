import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  COLLECTION_REPOSITORY,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';

export interface IDeleteCollectionUseCase {
  execute(userId: string, collectionId: string): Promise<Result<void, AppError>>;
}

export const DELETE_COLLECTION_USE_CASE = Symbol('DELETE_COLLECTION_USE_CASE');

/** Deletes the collection; its questions stay in the bank (RN-012). */
@Injectable()
export class DeleteCollectionUseCase implements IDeleteCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository) {}

  async execute(userId: string, collectionId: string): Promise<Result<void, AppError>> {
    const collection = await this.collections.findOwned(userId, collectionId);
    if (!collection) return Result.fail(ResourceErrors.notFound('Collection'));
    await this.collections.delete(collection.id);
    return Result.ok(undefined);
  }
}
