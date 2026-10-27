import { Difficulty, QuestionOption } from './question-content';
import { Question, QuestionStatus } from './question.entity';

export interface NamedRef {
  id: string;
  name: string;
}

export interface QuestionListItem {
  id: string;
  statement: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  subject: NamedRef;
  topic: NamedRef | null;
  collectionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionDetail extends QuestionListItem {
  explanation: string;
  options: QuestionOption[];
  collectionIds: string[];
}

export interface QuestionListFilter {
  ownerUserId: string;
  status: QuestionStatus;
  subjectId?: string;
  topicId?: string;
  difficulty?: Difficulty;
  search?: string;
  collectionId?: string;
  /** Position after which to continue (from the previous page). */
  after?: { createdAt: Date; id: string };
  limit: number;
}

export interface QuestionPage {
  items: QuestionListItem[];
  total: number;
  hasMore: boolean;
}

export interface IQuestionRepository {
  /** The question if it belongs to this student, otherwise null (never someone else's). */
  findOwned(ownerUserId: string, questionId: string): Promise<Question | null>;
  detail(ownerUserId: string, questionId: string): Promise<QuestionDetail | null>;
  list(filter: QuestionListFilter): Promise<QuestionPage>;
  /** Question + options, atomically. */
  create(question: Question): Promise<void>;
  /** Updates fields and replaces the options, atomically. */
  save(question: Question): Promise<void>;
}

export const QUESTION_REPOSITORY = Symbol('QUESTION_REPOSITORY');
