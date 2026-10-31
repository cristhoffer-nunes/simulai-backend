import { Attempt, AttemptAnswer, AttemptScore } from '../../domain/attempt.entity';
import { Simulation, SimulationMode } from '../../domain/simulation.entity';
import { SimulationQuestion } from '../../domain/snapshot';

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

/** Study mode: the grading of one confirmed answer (never sent before it is confirmed). */
export interface AnswerFeedbackView {
  correct: boolean;
  correctOptionId: string;
  explanation: string;
  sourceReference: string | null;
}

export interface AttemptAnswerView {
  questionId: string;
  selectedOptionId: string | null;
  flagged: boolean;
  answeredAt: Date;
  /** Study mode: confirmed answers are final and carry their feedback. */
  confirmed: boolean;
  feedback: AnswerFeedbackView | null;
}

export interface AttemptView {
  id: string;
  simulationId: string;
  title: string;
  mode: SimulationMode;
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
  answers: AttemptAnswerView[];
  result: AttemptScore | null;
}

export interface AttemptSummary extends AttemptScore {
  attemptId: string;
  status: string;
  finishReason: string | null;
  finishedAt: Date | null;
}

export function toAnswerView(
  answer: AttemptAnswer,
  question: SimulationQuestion | undefined,
): AttemptAnswerView {
  const confirmed = answer.confirmedAt !== null && question !== undefined;
  return {
    questionId: answer.simulationQuestionId,
    selectedOptionId: answer.selectedOptionId,
    flagged: answer.flagged,
    answeredAt: answer.answeredAt,
    confirmed,
    feedback:
      confirmed && question
        ? {
            correct: answer.selectedOptionId === question.snapshot.correctOptionId,
            correctOptionId: question.snapshot.correctOptionId,
            explanation: question.snapshot.explanation,
            sourceReference: question.snapshot.sourceReference ?? null,
          }
        : null,
  };
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
    mode: simulation.mode,
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
    answers: [...attempt.answers.values()].map((answer) =>
      toAnswerView(
        answer,
        simulation.questions.find((question) => question.id === answer.simulationQuestionId),
      ),
    ),
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
