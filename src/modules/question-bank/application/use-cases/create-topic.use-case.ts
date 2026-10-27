import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { CatalogName } from '../../domain/shared/catalog-name.vo';
import {
  ITaxonomyRepository,
  TAXONOMY_REPOSITORY,
} from '../../domain/taxonomy/taxonomy.repository';
import { TaxonomyEntry } from '../dto/taxonomy-entry';

export interface CreateTopicInput {
  userId: string;
  subjectId: string;
  name: string;
}

export interface ICreateTopicUseCase {
  execute(input: CreateTopicInput): Promise<Result<TaxonomyEntry, AppError>>;
}

export const CREATE_TOPIC_USE_CASE = Symbol('CREATE_TOPIC_USE_CASE');

/** Creates a private topic under a visible subject, reusing a same-name topic if one exists. */
@Injectable()
export class CreateTopicUseCase implements ICreateTopicUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository) {}

  async execute(input: CreateTopicInput): Promise<Result<TaxonomyEntry, AppError>> {
    const name = CatalogName.create(input.name);
    if (name.isFailure) {
      return Result.fail(
        AppError.validation(name.error, [
          { path: 'name', code: 'INVALID_NAME', message: name.error },
        ]),
      );
    }

    const subject = await this.taxonomy.findVisibleSubject(input.userId, input.subjectId);
    if (!subject) return Result.fail(ResourceErrors.notFound('Subject'));

    const existing = subject.findTopicByName(name.value);
    if (existing) {
      return Result.ok({
        id: existing.id,
        name: existing.name,
        custom: existing.ownerUserId !== null,
        created: false,
      });
    }

    const topic = subject.newTopic(input.userId, name.value);
    await this.taxonomy.addTopic(topic);
    return Result.ok({ id: topic.id, name: topic.name, custom: true, created: true });
  }
}
