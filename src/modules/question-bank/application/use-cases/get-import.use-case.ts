import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  IQuestionImportRepository,
  QUESTION_IMPORT_REPOSITORY,
} from '../../domain/imports/question-import.repository';
import { ImportResultResponse, toImportResult } from '../dto/import-views';

export interface IGetImportUseCase {
  execute(userId: string, importId: string): Promise<Result<ImportResultResponse, AppError>>;
}

export const GET_IMPORT_USE_CASE = Symbol('GET_IMPORT_USE_CASE');

@Injectable()
export class GetImportUseCase implements IGetImportUseCase {
  constructor(
    @Inject(QUESTION_IMPORT_REPOSITORY) private readonly imports: IQuestionImportRepository,
  ) {}

  async execute(userId: string, importId: string): Promise<Result<ImportResultResponse, AppError>> {
    const questionImport = await this.imports.findOwned(userId, importId);
    return questionImport
      ? Result.ok(toImportResult(questionImport))
      : Result.fail(ResourceErrors.notFound('Import'));
  }
}
