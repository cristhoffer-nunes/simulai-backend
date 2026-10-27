import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { CatalogName } from '../../domain/shared/catalog-name.vo';
import { Subject } from '../../domain/taxonomy/subject.entity';
import {
  ITaxonomyRepository,
  TAXONOMY_REPOSITORY,
} from '../../domain/taxonomy/taxonomy.repository';
import { TaxonomyEntry } from '../dto/taxonomy-entry';

export interface CreateSubjectInput {
  userId: string;
  knowledgeAreaId: string;
  name: string;
}

export interface ICreateSubjectUseCase {
  execute(input: CreateSubjectInput): Promise<Result<TaxonomyEntry, AppError>>;
}

export const CREATE_SUBJECT_USE_CASE = Symbol('CREATE_SUBJECT_USE_CASE');

/**
 * Creates a private subject. If one with the same name (ignoring case and accents) is already
 * visible to the student — catalog or their own — that one is returned, so typing "anatomia" in
 * the editor reuses the catalog "Anatomia" instead of creating a twin.
 */
@Injectable()
export class CreateSubjectUseCase implements ICreateSubjectUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository) {}

  async execute(input: CreateSubjectInput): Promise<Result<TaxonomyEntry, AppError>> {
    const name = CatalogName.create(input.name);
    if (name.isFailure) {
      return Result.fail(
        AppError.validation(name.error, [
          { path: 'name', code: 'INVALID_NAME', message: name.error },
        ]),
      );
    }
    if (!(await this.taxonomy.areaExists(input.knowledgeAreaId))) {
      return Result.fail(ResourceErrors.notFound('Knowledge area'));
    }

    const existing = await this.taxonomy.findVisibleSubjectByName(
      input.userId,
      input.knowledgeAreaId,
      name.value,
    );
    if (existing) {
      return Result.ok({
        id: existing.id,
        name: existing.name,
        custom: existing.ownerUserId !== null,
        created: false,
      });
    }

    const subject = Subject.create(input.knowledgeAreaId, input.userId, name.value);
    await this.taxonomy.createSubject(subject);
    return Result.ok({ id: subject.id, name: subject.name, custom: true, created: true });
  }
}
