import { Difficulty, QuestionOption } from '../../domain/questions/question-content';
import { FieldError } from '../../domain/shared/field-error';
import { QuestionImport } from '../../domain/imports/question-import.entity';

export interface ImportPreviewQuestion {
  statement: string;
  explanation: string;
  difficulty: Difficulty;
  options: QuestionOption[];
  subject: string;
  topic: string;
  sourceReference: string | null;
}

export interface ValidImportItem {
  index: number;
  normalizedQuestion: ImportPreviewQuestion;
  /** Exact duplicate (normalized hash) of a bank question or of an earlier item. */
  duplicate: boolean;
  duplicateOf: 'bank' | 'batch' | null;
  /** Subject/topic that do not exist yet and will be created on commit. */
  newSubject: boolean;
  newTopic: boolean;
}

export interface InvalidImportItem {
  index: number;
  /** Whatever could be read, to help the student find the item. */
  statement: string | null;
  subject: string | null;
  errors: FieldError[];
}

export interface ImportPreviewResponse {
  previewId: string;
  expiresAt: Date;
  totalCount: number;
  validItems: ValidImportItem[];
  invalidItems: InvalidImportItem[];
}

export interface ImportResultResponse {
  importId: string;
  status: string;
  importedCount: number;
  skippedDuplicateCount: number;
  rejectedCount: number;
  totalCount: number;
  createdAt: Date;
  committedAt: Date | null;
}

export function toImportResult(questionImport: QuestionImport): ImportResultResponse {
  return {
    importId: questionImport.id,
    status: questionImport.status,
    importedCount: questionImport.importedCount,
    skippedDuplicateCount:
      questionImport.status === 'committed' ? questionImport.duplicateCount : 0,
    rejectedCount: questionImport.rejectedCount,
    totalCount: questionImport.totalCount,
    createdAt: questionImport.createdAt,
    committedAt: questionImport.committedAt,
  };
}
