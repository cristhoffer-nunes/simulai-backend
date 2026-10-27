import { SimulationDifficulty } from '../../domain/simulation.entity';
import { QuestionSnapshot } from '../../domain/snapshot';

export interface PoolFilter {
  ownerUserId: string;
  difficulty: SimulationDifficulty;
  /** Restrict to one of the student's collections. */
  collectionId: string | null;
}

export interface SubjectPool {
  subjectId: string;
  subjectName: string;
  available: number;
}

/** The student's eligible questions (active, own; RN-011, RN-014) seen from the exam side. */
export interface IQuestionPoolPort {
  /** Eligible counts per subject (only subjects with at least one eligible question). */
  availability(filter: PoolFilter): Promise<SubjectPool[]>;
  /** Ids of every eligible question of a subject. */
  eligibleIds(filter: PoolFilter, subjectId: string): Promise<string[]>;
  /** Snapshots of these questions (owner checked again). */
  snapshots(ownerUserId: string, questionIds: string[]): Promise<Map<string, QuestionSnapshot>>;
  ownsCollection(ownerUserId: string, collectionId: string): Promise<boolean>;
}

export const QUESTION_POOL = Symbol('QUESTION_POOL');
