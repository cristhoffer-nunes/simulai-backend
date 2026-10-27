import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { Collection } from '../../domain/collections/collection.entity';
import {
  COLLECTION_REPOSITORY,
  CollectionSummary,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';
import { nameTaken, parseCollectionName, parseDescription } from '../collection-input';

export interface CreateCollectionInput {
  userId: string;
  name: string;
  description?: string | null;
}

export interface ICreateCollectionUseCase {
  execute(input: CreateCollectionInput): Promise<Result<CollectionSummary, AppError>>;
}

export const CREATE_COLLECTION_USE_CASE = Symbol('CREATE_COLLECTION_USE_CASE');

@Injectable()
export class CreateCollectionUseCase implements ICreateCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository) {}

  async execute(input: CreateCollectionInput): Promise<Result<CollectionSummary, AppError>> {
    const name = parseCollectionName(input.name);
    const description = parseDescription(input.description);
    const errors = [
      ...(name.isFailure ? name.error : []),
      ...(description.isFailure ? description.error : []),
    ];
    if (errors.length > 0) {
      return Result.fail(AppError.validation('The collection has invalid fields.', errors));
    }
    if (await nameTaken(this.collections, input.userId, name.value)) {
      return Result.fail(
        ResourceErrors.conflict('You already have a collection with this name.', [
          {
            path: 'name',
            code: 'NAME_TAKEN',
            message: 'You already have a collection with this name.',
          },
        ]),
      );
    }

    const collection = Collection.create(input.userId, name.value, description.value);
    await this.collections.create(collection);
    return Result.ok({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      questionCount: 0,
      createdAt: collection.createdAt,
    });
  }
}
