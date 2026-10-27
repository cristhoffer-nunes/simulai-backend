import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  ITaxonomyRepository,
  TAXONOMY_REPOSITORY,
  TaxonomyAreaView,
} from '../../domain/taxonomy/taxonomy.repository';

export interface IGetTaxonomyUseCase {
  execute(userId: string): Promise<Result<{ areas: TaxonomyAreaView[] }, AppError>>;
}

export const GET_TAXONOMY_USE_CASE = Symbol('GET_TAXONOMY_USE_CASE');

/** Areas → subjects → topics the student can use: the shared catalog plus their own entries. */
@Injectable()
export class GetTaxonomyUseCase implements IGetTaxonomyUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository) {}

  async execute(userId: string): Promise<Result<{ areas: TaxonomyAreaView[] }, AppError>> {
    return Result.ok({ areas: await this.taxonomy.treeFor(userId) });
  }
}
