import { CursorPosition } from '../../../../shared/pagination/cursor';

/** Read side of the student's attempts: history lists and the home dashboard (RES-02). */

export type HistoryStatus = 'completed' | 'expired' | 'in_progress' | 'finished';

export interface AttemptHistoryItem {
  attemptId: string;
  simulationId: string;
  title: string;
  mode: 'exam' | 'study';
  subjectNames: string[];
  attemptNumber: number;
  status: string;
  finishReason: string | null;
  startedAt: Date;
  expiresAt: Date | null;
  finishedAt: Date | null;
  durationSeconds: number | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number | null;
  scorePercentage: number | null;
  createdAt: Date;
}

export interface HistoryFilter {
  status?: HistoryStatus;
  simulationId?: string;
  after?: CursorPosition;
  limit: number;
  /** Oldest first (charts); the default is newest first. */
  oldestFirst?: boolean;
}

export interface HistoryPage {
  items: AttemptHistoryItem[];
  total: number;
  hasMore: boolean;
}

export interface BankSummary {
  totalQuestions: number;
  totalTopics: number;
  subjects: { subjectId: string; subjectName: string; questionCount: number }[];
}

export interface AttemptTotals {
  totalSimulations: number;
  finishedAttempts: number;
  timeoutAttempts: number;
  inProgressAttempts: number;
  /** Questions in finished attempts (blanks included) and how many were right. */
  answeredQuestions: number;
  correctAnswers: number;
}

export interface TopicPerformance {
  topicId: string | null;
  topicName: string | null;
  total: number;
  correct: number;
}

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  total: number;
  correct: number;
  topics: TopicPerformance[];
}

export interface IPerformanceQuery {
  history(ownerUserId: string, filter: HistoryFilter): Promise<HistoryPage>;
  bank(ownerUserId: string): Promise<BankSummary>;
  attemptTotals(ownerUserId: string): Promise<AttemptTotals>;
  /** Every question of every finished attempt, grouped by subject and topic of its snapshot. */
  performance(ownerUserId: string): Promise<SubjectPerformance[]>;
}

export const PERFORMANCE_QUERY = Symbol('PERFORMANCE_QUERY');
