import { QuestionImport } from './question-import.entity';

export interface IQuestionImportRepository {
  create(questionImport: QuestionImport): Promise<void>;
  findOwned(ownerUserId: string, importId: string): Promise<QuestionImport | null>;
  /** Persists a discard (only while still "validated"). */
  saveDiscarded(questionImport: QuestionImport): Promise<void>;
}

export const QUESTION_IMPORT_REPOSITORY = Symbol('QUESTION_IMPORT_REPOSITORY');
