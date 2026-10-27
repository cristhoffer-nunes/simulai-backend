import { AttemptScore } from '../../domain/attempt.entity';
import { GradedQuestion, SubjectScore } from '../../domain/grading';

export interface ResultSubjectView extends SubjectScore {
  /** Accuracy over every finished attempt of the student, this one included (null = none). */
  overallPercentage: number | null;
}

/** RES-01: everything about a finished attempt, answer key and explanations included. */
export interface AttemptResultView {
  attemptId: string;
  simulationId: string;
  title: string;
  attemptNumber: number;
  attemptCount: number;
  status: string;
  finishReason: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  durationSeconds: number | null;
  timeUsedSeconds: number | null;
  score: AttemptScore;
  previous: { attemptId: string; attemptNumber: number; scorePercentage: number } | null;
  bySubject: ResultSubjectView[];
  questions: GradedQuestion[];
}
