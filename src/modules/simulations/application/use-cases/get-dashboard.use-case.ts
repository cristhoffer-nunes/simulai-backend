import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { percentOf } from '../../domain/grading';
import {
  AttemptHistoryItem,
  IPerformanceQuery,
  PERFORMANCE_QUERY,
} from '../ports/performance-query.port';

export interface TopicOverview {
  topicId: string | null;
  topicName: string | null;
  total: number;
  correct: number;
  accuracyPercent: number;
}

export interface SubjectOverview {
  subjectId: string;
  subjectName: string;
  /** Active questions of this subject in the bank. */
  bankQuestions: number;
  total: number;
  correct: number;
  /** null while no finished attempt had a question of this subject. */
  accuracyPercent: number | null;
  topics: TopicOverview[];
}

export interface DashboardOverview {
  totalQuestions: number;
  totalTopics: number;
  totalSimulations: number;
  totalAttempts: number;
  timeoutAttempts: number;
  inProgressAttempts: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracyPercent: number | null;
  bySubject: SubjectOverview[];
  inProgress: AttemptHistoryItem[];
  recent: AttemptHistoryItem[];
  /** Last finished attempts, oldest first, for the score chart. */
  trend: { attemptId: string; title: string; finishedAt: Date | null; scorePercentage: number }[];
}

export interface IGetDashboardUseCase {
  execute(userId: string): Promise<Result<DashboardOverview, AppError>>;
}

export const GET_DASHBOARD_USE_CASE = Symbol('GET_DASHBOARD_USE_CASE');

const TREND_SIZE = 20;

/** RES-02: home indicators. Every number comes from the attempts themselves. */
@Injectable()
export class GetDashboardUseCase implements IGetDashboardUseCase {
  constructor(@Inject(PERFORMANCE_QUERY) private readonly performance: IPerformanceQuery) {}

  async execute(userId: string): Promise<Result<DashboardOverview, AppError>> {
    const [bank, totals, subjects, inProgress, finished] = await Promise.all([
      this.performance.bank(userId),
      this.performance.attemptTotals(userId),
      this.performance.performance(userId),
      this.performance.history(userId, { status: 'in_progress', limit: 3 }),
      this.performance.history(userId, { status: 'finished', limit: TREND_SIZE }),
    ]);

    const answered = new Map(subjects.map((subject) => [subject.subjectId, subject]));
    const bySubject: SubjectOverview[] = subjects.map((subject) => ({
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      bankQuestions:
        bank.subjects.find((item) => item.subjectId === subject.subjectId)?.questionCount ?? 0,
      total: subject.total,
      correct: subject.correct,
      accuracyPercent: percentOf(subject.correct, subject.total),
      topics: subject.topics.map((topic) => ({
        ...topic,
        accuracyPercent: percentOf(topic.correct, topic.total),
      })),
    }));
    for (const subject of bank.subjects) {
      if (answered.has(subject.subjectId)) continue;
      bySubject.push({
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        bankQuestions: subject.questionCount,
        total: 0,
        correct: 0,
        accuracyPercent: null,
        topics: [],
      });
    }
    bySubject.sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pt-BR'));

    return Result.ok({
      totalQuestions: bank.totalQuestions,
      totalTopics: bank.totalTopics,
      totalSimulations: totals.totalSimulations,
      totalAttempts: totals.finishedAttempts,
      timeoutAttempts: totals.timeoutAttempts,
      inProgressAttempts: totals.inProgressAttempts,
      answeredQuestions: totals.answeredQuestions,
      correctAnswers: totals.correctAnswers,
      accuracyPercent:
        totals.answeredQuestions > 0
          ? percentOf(totals.correctAnswers, totals.answeredQuestions)
          : null,
      bySubject,
      inProgress: inProgress.items,
      recent: finished.items.slice(0, 5),
      trend: [...finished.items].reverse().map((item) => ({
        attemptId: item.attemptId,
        title: item.title,
        finishedAt: item.finishedAt,
        scorePercentage: item.scorePercentage ?? 0,
      })),
    });
  }
}
