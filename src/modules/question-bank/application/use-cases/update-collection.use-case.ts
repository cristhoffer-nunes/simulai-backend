import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  COLLECTION_REPOSITORY,
  CollectionSummary,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';
import { FieldError } from '../../domain/shared/field-error';
import { nameTaken, parseCollectionName, parseDescription } from '../collection-input';

export interface UpdateCollectionInput {
  userId: string;
  collectionId: string;
  name?: string;
  description?: string | null;
}

export interface IUpdateCollectionUseCase {
  execute(input: UpdateCollectionInput): Promise<Result<CollectionSummary, AppError>>;
}

export const UPDATE_COLLECTION_USE_CASE = Symbol('UPDATE_COLLECTION_USE_CASE');

@Injectable()
export class UpdateCollectionUseCase implements IUpdateCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository) {}

  async execute(input: UpdateCollectionInput): Promise<Result<CollectionSummary, AppError>> {
    const collection = await this.collections.findOwned(input.userId, input.collectionId);
    if (!collection) return Result.fail(ResourceErrors.notFound('Collection'));

    const errors: FieldError[] = [];
    if (input.name !== undefined) {
      const name = parseCollectionName(input.name);
      if (name.isFailure) errors.push(...name.error);
      else if (await nameTaken(this.collections, input.userId, name.value, collection.id)) {
        return Result.fail(
          ResourceErrors.conflict('You already have a collection with this name.', [
            {
              path: 'name',
              code: 'NAME_TAKEN',
              message: 'You already have a collection with this name.',
            },
          ]),
        );
      } else collection.rename(name.value);
    }
    if (input.description !== undefined) {
      const description = parseDescription(input.description);
      if (description.isFailure) errors.push(...description.error);
      else collection.describe(description.value);
    }
    if (errors.length > 0) {
      return Result.fail(AppError.validation('The collection has invalid fields.', errors));
    }

    await this.collections.save(collection);
    return Result.ok((await this.collections.summary(input.userId, collection.id))!);
  }
}
