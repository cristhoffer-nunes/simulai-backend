import { Inject, Injectable } from '@nestjs/common';
import { AppError, ExamErrors, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../../domain/attempt.repository';
import { gradeQuestions, percentOf, scoreBySubject } from '../../domain/grading';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { AttemptResultView } from '../dto/result-views';
import { ATTEMPT_STATS_QUERY, IAttemptStatsQuery } from '../ports/attempt-stats.port';

export interface IGetAttemptResultUseCase {
  execute(userId: string, attemptId: string): Promise<Result<AttemptResultView, AppError>>;
}

export const GET_ATTEMPT_RESULT_USE_CASE = Symbol('GET_ATTEMPT_RESULT_USE_CASE');

/**
 * RES-01, RN-025: the result with answer key and explanations, only once the attempt is over.
 * An attempt whose time ran out is closed here first, so the result never waits for the job.
 */
@Injectable()
export class GetAttemptResultUseCase implements IGetAttemptResultUseCase {
  constructor(
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
    @Inject(ATTEMPT_STATS_QUERY) private readonly stats: IAttemptStatsQuery,
  ) {}

  async execute(userId: string, attemptId: string): Promise<Result<AttemptResultView, AppError>> {
    let attempt = await this.attempts.findOwned(userId, attemptId);
    if (!attempt) return Result.fail(ResourceErrors.notFound('Attempt'));
    const simulation = await this.simulations.findOwned(userId, attempt.simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Attempt'));

    if (attempt.isActive && attempt.isPastDeadline()) {
      const locked = await this.attempts.withLock(userId, attemptId, (current) =>
        current.finish(simulation.questions, 'timeout'),
      );
      if (locked) attempt = locked.attempt;
    }
    if (attempt.isActive || !attempt.score) return Result.fail(ExamErrors.attemptInProgress());

    const questions = gradeQuestions(simulation.questions, attempt.answers);
    const subjects = scoreBySubject(questions);
    const [attemptNumber, attemptCount, previous, totals] = await Promise.all([
      this.attempts.attemptNumber(attempt),
      this.stats.attemptCount(simulation.id),
      this.stats.previousFinished(userId, simulation.id, attempt.createdAt),
      this.stats.subjectTotals(
        userId,
        subjects.map((subject) => subject.subjectId),
      ),
    ]);

    return Result.ok({
      attemptId: attempt.id,
      simulationId: simulation.id,
      title: simulation.title,
      mode: simulation.mode,
      attemptNumber,
      attemptCount,
      status: attempt.status,
      finishReason: attempt.finishReason,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      durationSeconds: simulation.durationSeconds,
      timeUsedSeconds: attempt.finishedAt
        ? Math.max(
            0,
            Math.round((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 1000),
          )
        : null,
      score: attempt.score,
      previous,
      bySubject: subjects.map((subject) => {
        const overall = totals.get(subject.subjectId);
        return {
          ...subject,
          overallPercentage:
            overall && overall.total > 0 ? percentOf(overall.correct, overall.total) : null,
        };
      }),
      questions,
    });
  }
}
