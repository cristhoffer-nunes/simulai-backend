import { randomUUID } from 'node:crypto';
import { QuestionSnapshot, SimulationQuestion } from './snapshot';

export type SimulationDifficulty = 'all' | 'easy' | 'medium' | 'hard';
export type SimulationStatus = 'ready' | 'archived';

export interface SimulationConfiguration {
  subjectIds: string[];
  distribution: 'balanced';
  collectionId: string | null;
  /** How many questions each subject received. */
  perSubject: Record<string, number>;
  /** Subject names when the simulation was created (for lists, without reading snapshots). */
  subjectNames: Record<string, string>;
}

export interface SimulationProps {
  id: string;
  ownerUserId: string;
  title: string;
  mode: 'exam';
  status: SimulationStatus;
  difficulty: SimulationDifficulty;
  timed: boolean;
  durationSeconds: number | null;
  configuration: SimulationConfiguration;
  questions: SimulationQuestion[];
  createdAt: Date;
}

export interface NewSimulation {
  ownerUserId: string;
  title: string;
  difficulty: SimulationDifficulty;
  timed: boolean;
  durationSeconds: number | null;
  configuration: SimulationConfiguration;
  /** Already in exam order. */
  picked: { sourceQuestionId: string | null; snapshot: QuestionSnapshot }[];
}

/** Aggregate root: an exam definition with its immutable question snapshots (RN-014, RN-018). */
export class Simulation {
  private constructor(private props: SimulationProps) {}

  static create(input: NewSimulation, now = new Date()): Simulation {
    return new Simulation({
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      title: input.title,
      mode: 'exam',
      status: 'ready',
      difficulty: input.difficulty,
      timed: input.timed,
      durationSeconds: input.timed ? input.durationSeconds : null,
      configuration: input.configuration,
      questions: input.picked.map((item, index) => ({
        id: randomUUID(),
        position: index + 1,
        sourceQuestionId: item.sourceQuestionId,
        snapshot: item.snapshot,
      })),
      createdAt: now,
    });
  }

  static reconstitute(props: SimulationProps): Simulation {
    return new Simulation(props);
  }

  get id(): string {
    return this.props.id;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get title(): string {
    return this.props.title;
  }
  get mode(): 'exam' {
    return this.props.mode;
  }
  get status(): SimulationStatus {
    return this.props.status;
  }
  get difficulty(): SimulationDifficulty {
    return this.props.difficulty;
  }
  get timed(): boolean {
    return this.props.timed;
  }
  get durationSeconds(): number | null {
    return this.props.durationSeconds;
  }
  get configuration(): SimulationConfiguration {
    return this.props.configuration;
  }
  get questions(): readonly SimulationQuestion[] {
    return this.props.questions;
  }
  get questionCount(): number {
    return this.props.questions.length;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Archived simulations accept no new attempts; finished ones stay readable. */
  archive(): void {
    this.props.status = 'archived';
  }

  restore(): void {
    this.props.status = 'ready';
  }
}
