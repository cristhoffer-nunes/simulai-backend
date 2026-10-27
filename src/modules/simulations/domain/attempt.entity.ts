import { randomUUID } from 'node:crypto';
import { Result } from '../../../shared/result/result';
import { Simulation } from './simulation.entity';
import { SimulationQuestion } from './snapshot';

export type AttemptStatus = 'in_progress' | 'completed' | 'expired';
export type FinishReason = 'manual' | 'timeout';

export interface AttemptAnswer {
  simulationQuestionId: string;
  /** null = the student cleared the mark (counts as blank). */
  selectedOptionId: string | null;
  /** "Revisar depois": a reminder for the student; never affects the score. */
  flagged: boolean;
  answeredAt: Date;
}

export interface AttemptScore {
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  scorePercentage: number;
}

export interface AttemptProps {
  id: string;
  simulationId: string;
  ownerUserId: string;
  status: AttemptStatus;
  startedAt: Date;
  expiresAt: Date | null;
  finishedAt: Date | null;
  finishReason: FinishReason | null;
  score: AttemptScore | null;
  answers: Map<string, AttemptAnswer>;
  createdAt: Date;
}

export type AnswerRejection =
  'FINISHED' | 'DEADLINE_PASSED' | 'UNKNOWN_QUESTION' | 'UNKNOWN_OPTION';

/** RN-024: correct / total × 100 with two decimals; blanks count in the total, no penalty. */
export function scoreOf(
  questions: readonly SimulationQuestion[],
  answers: ReadonlyMap<string, AttemptAnswer>,
): AttemptScore {
  let correct = 0;
  let unanswered = 0;
  for (const question of questions) {
    const selected = answers.get(question.id)?.selectedOptionId ?? null;
    if (selected === null) unanswered += 1;
    else if (selected === question.snapshot.correctOptionId) correct += 1;
  }
  const total = questions.length;
  return {
    correctCount: correct,
    incorrectCount: total - correct - unanswered,
    unansweredCount: unanswered,
    scorePercentage: total === 0 ? 0 : Math.round((correct / total) * 10_000) / 100,
  };
}

/**
 * Aggregate root: one sitting of a simulation (RN-020..025). The server owns the clock:
 * startedAt and expiresAt are set here and every answer is checked against them.
 */
export class Attempt {
  private readonly changed = new Set<string>();

  private constructor(private props: AttemptProps) {}

  static start(simulation: Simulation, now = new Date()): Attempt {
    return new Attempt({
      id: randomUUID(),
      simulationId: simulation.id,
      ownerUserId: simulation.ownerUserId,
      status: 'in_progress',
      startedAt: now,
      expiresAt:
        simulation.timed && simulation.durationSeconds
          ? new Date(now.getTime() + simulation.durationSeconds * 1000)
          : null,
      finishedAt: null,
      finishReason: null,
      score: null,
      answers: new Map(),
      createdAt: now,
    });
  }

  static reconstitute(props: AttemptProps): Attempt {
    return new Attempt({ ...props, answers: new Map(props.answers) });
  }

  get id(): string {
    return this.props.id;
  }
  get simulationId(): string {
    return this.props.simulationId;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get status(): AttemptStatus {
    return this.props.status;
  }
  get startedAt(): Date {
    return this.props.startedAt;
  }
  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }
  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }
  get finishReason(): FinishReason | null {
    return this.props.finishReason;
  }
  get score(): AttemptScore | null {
    return this.props.score;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get answers(): ReadonlyMap<string, AttemptAnswer> {
    return this.props.answers;
  }
  /** Answers changed since loading (what the repository must write). */
  get changedAnswers(): AttemptAnswer[] {
    return [...this.changed].map((id) => this.props.answers.get(id)!);
  }

  get isActive(): boolean {
    return this.props.status === 'in_progress';
  }

  isPastDeadline(now = new Date()): boolean {
    return this.props.expiresAt !== null && now.getTime() >= this.props.expiresAt.getTime();
  }

  /** RN-021: save, change or clear (null) while active and before the deadline. */
  answer(
    questions: readonly SimulationQuestion[],
    simulationQuestionId: string,
    selectedOptionId: string | null,
    now = new Date(),
  ): Result<AttemptAnswer, AnswerRejection> {
    if (!this.isActive) return Result.fail('FINISHED');
    if (this.isPastDeadline(now)) return Result.fail('DEADLINE_PASSED');
    const question = questions.find((item) => item.id === simulationQuestionId);
    if (!question) return Result.fail('UNKNOWN_QUESTION');
    if (
      selectedOptionId !== null &&
      !question.snapshot.options.some((option) => option.id === selectedOptionId)
    ) {
      return Result.fail('UNKNOWN_OPTION');
    }
    const flagged = this.props.answers.get(simulationQuestionId)?.flagged ?? false;
    const answer = { simulationQuestionId, selectedOptionId, flagged, answeredAt: now };
    this.props.answers.set(simulationQuestionId, answer);
    this.changed.add(simulationQuestionId);
    return Result.ok(answer);
  }

  /** Marks or unmarks a question to review later, with the same rules as answering. */
  flag(
    questions: readonly SimulationQuestion[],
    simulationQuestionId: string,
    flagged: boolean,
    now = new Date(),
  ): Result<AttemptAnswer, AnswerRejection> {
    if (!this.isActive) return Result.fail('FINISHED');
    if (this.isPastDeadline(now)) return Result.fail('DEADLINE_PASSED');
    if (!questions.some((item) => item.id === simulationQuestionId)) {
      return Result.fail('UNKNOWN_QUESTION');
    }
    const current = this.props.answers.get(simulationQuestionId);
    const answer = {
      simulationQuestionId,
      selectedOptionId: current?.selectedOptionId ?? null,
      flagged,
      answeredAt: current?.answeredAt ?? now,
    };
    this.props.answers.set(simulationQuestionId, answer);
    this.changed.add(simulationQuestionId);
    return Result.ok(answer);
  }

  /**
   * RN-022: ends the attempt once and scores it. A timeout ends at expiresAt, not at the moment
   * someone noticed. Returns false when it was already finished (idempotent).
   */
  finish(
    questions: readonly SimulationQuestion[],
    reason: FinishReason,
    now = new Date(),
  ): boolean {
    if (!this.isActive) return false;
    this.props.status = reason === 'manual' ? 'completed' : 'expired';
    this.props.finishReason = reason;
    this.props.finishedAt =
      reason === 'timeout' && this.props.expiresAt ? this.props.expiresAt : now;
    this.props.score = scoreOf(questions, this.props.answers);
    return true;
  }
}
