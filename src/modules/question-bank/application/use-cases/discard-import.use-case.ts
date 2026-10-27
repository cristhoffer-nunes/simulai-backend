import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  IQuestionImportRepository,
  QUESTION_IMPORT_REPOSITORY,
} from '../../domain/imports/question-import.repository';

export interface IDiscardImportUseCase {
  execute(userId: string, importId: string): Promise<Result<void, AppError>>;
}

export const DISCARD_IMPORT_USE_CASE = Symbol('DISCARD_IMPORT_USE_CASE');

/** "Descartar": drops a preview that was not committed. Idempotent. */
@Injectable()
export class DiscardImportUseCase implements IDiscardImportUseCase {
  constructor(
    @Inject(QUESTION_IMPORT_REPOSITORY) private readonly imports: IQuestionImportRepository,
  ) {}

  async execute(userId: string, importId: string): Promise<Result<void, AppError>> {
    const questionImport = await this.imports.findOwned(userId, importId);
    if (!questionImport) return Result.fail(ResourceErrors.notFound('Import'));
    if (questionImport.status === 'committed') {
      return Result.fail(ResourceErrors.conflict('This import was already confirmed.'));
    }
    if (questionImport.status === 'validated') {
      questionImport.discard();
      await this.imports.saveDiscarded(questionImport);
    }
    return Result.ok(undefined);
  }
}
