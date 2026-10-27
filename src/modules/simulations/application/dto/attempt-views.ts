import { Attempt, AttemptScore } from '../../domain/attempt.entity';
import { Simulation } from '../../domain/simulation.entity';

/** A question as shown during the exam: no answer key, no explanation (RN-019). */
export interface ExamQuestionView {
  id: string;
  position: number;
  statement: string;
  options: { id: string; text: string }[];
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
}

export interface AttemptView {
  id: string;
  simulationId: string;
  title: string;
  attemptNumber: number;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  finishedAt: Date | null;
  finishReason: string | null;
  /** The server clock, so the browser only displays the countdown (RN-020). */
  serverNow: Date;
  totalQuestions: number;
  questions: ExamQuestionView[];
  answers: {
    questionId: string;
    selectedOptionId: string | null;
    flagged: boolean;
    answeredAt: Date;
  }[];
  result: AttemptScore | null;
}

export interface AttemptSummary extends AttemptScore {
  attemptId: string;
  status: string;
  finishReason: string | null;
  finishedAt: Date | null;
}

export function toAttemptView(
  attempt: Attempt,
  simulation: Simulation,
  attemptNumber: number,
  now = new Date(),
): AttemptView {
  return {
    id: attempt.id,
    simulationId: simulation.id,
    title: simulation.title,
    attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    finishedAt: attempt.finishedAt,
    finishReason: attempt.finishReason,
    serverNow: now,
    totalQuestions: simulation.questionCount,
    questions: simulation.questions.map((question) => ({
      id: question.id,
      position: question.position,
      statement: question.snapshot.statement,
      options: question.snapshot.options.map((option) => ({ id: option.id, text: option.text })),
      subjectId: question.snapshot.subjectId,
      subjectName: question.snapshot.subjectName,
      topicId: question.snapshot.topicId,
      topicName: question.snapshot.topicName,
    })),
    answers: [...attempt.answers.values()].map((answer) => ({
      questionId: answer.simulationQuestionId,
      selectedOptionId: answer.selectedOptionId,
      flagged: answer.flagged,
      answeredAt: answer.answeredAt,
    })),
    result: attempt.score,
  };
}

export function toAttemptSummary(attempt: Attempt): AttemptSummary {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    finishReason: attempt.finishReason,
    finishedAt: attempt.finishedAt,
    ...attempt.score!,
  };
}
