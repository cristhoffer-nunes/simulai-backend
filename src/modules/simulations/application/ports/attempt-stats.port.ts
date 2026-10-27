/** Read-only numbers about a student's past attempts, for the result page. */
export interface SubjectTotals {
  total: number;
  correct: number;
}

export interface PreviousAttempt {
  attemptId: string;
  attemptNumber: number;
  scorePercentage: number;
}

export interface IAttemptStatsQuery {
  /** Questions answered and correct per subject over every finished attempt of the student. */
  subjectTotals(ownerUserId: string, subjectIds: string[]): Promise<Map<string, SubjectTotals>>;
  /** The finished attempt of the same simulation started right before this one. */
  previousFinished(
    ownerUserId: string,
    simulationId: string,
    before: Date,
  ): Promise<PreviousAttempt | null>;
  /** How many attempts this simulation has (any status). */
  attemptCount(simulationId: string): Promise<number>;
}

export const ATTEMPT_STATS_QUERY = Symbol('ATTEMPT_STATS_QUERY');
