import { Collection } from '../collections/collection.entity';
import { Question } from '../questions/question.entity';
import { Subject, TopicProps } from '../taxonomy/subject.entity';
import { QuestionImport } from './question-import.entity';

/** Everything a commit writes, applied in one transaction (RN-010). */
export interface ImportCommitPlan {
  questionImport: QuestionImport;
  newSubjects: Subject[];
  newTopics: TopicProps[];
  questions: Question[];
  collection: Collection | null;
}

export interface IQuestionImportRepository {
  create(questionImport: QuestionImport): Promise<void>;
  findOwned(ownerUserId: string, importId: string): Promise<QuestionImport | null>;
  findByIdempotencyKey(ownerUserId: string, key: string): Promise<QuestionImport | null>;
  /** Persists a discard (only while still "validated"). */
  saveDiscarded(questionImport: QuestionImport): Promise<void>;
  /**
   * Applies the plan atomically, but only if the import is still "validated" in storage.
   * Returns false when another request committed or discarded it first.
   */
  commit(plan: ImportCommitPlan): Promise<boolean>;
}

export const QUESTION_IMPORT_REPOSITORY = Symbol('QUESTION_IMPORT_REPOSITORY');
