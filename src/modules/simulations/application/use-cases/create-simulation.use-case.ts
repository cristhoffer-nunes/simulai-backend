import { Inject, Injectable } from '@nestjs/common';
import { AppError, ExamErrors, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { balancedDistribution, shuffle } from '../../domain/distribution';
import { Simulation, SimulationDifficulty, SimulationMode } from '../../domain/simulation.entity';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { SimulationView, toSimulationView } from '../dto/simulation-views';
import { IQuestionPoolPort, PoolFilter, QUESTION_POOL } from '../ports/question-pool.port';

export interface CreateSimulationInput {
  userId: string;
  title?: string | null;
  /** Defaults to exam. */
  mode?: SimulationMode;
  questionCount: number;
  /** In the order the student chose them: decides who gets the remainder (RN-016). */
  subjectIds: string[];
  difficulty: SimulationDifficulty;
  distribution: 'balanced';
  timed: boolean;
  durationSeconds?: number | null;
  collectionId?: string | null;
}

/** A simulation with exactly these bank questions, in this order (e.g. flashcards to test). */
export interface CreateFromQuestionsInput {
  userId: string;
  title?: string | null;
  mode?: SimulationMode;
  questionIds: string[];
}

export interface ICreateSimulationUseCase {
  execute(input: CreateSimulationInput): Promise<Result<SimulationView, AppError>>;
  fromQuestions(input: CreateFromQuestionsInput): Promise<Result<SimulationView, AppError>>;
}

export const CREATE_SIMULATION_USE_CASE = Symbol('CREATE_SIMULATION_USE_CASE');

export const MAX_QUESTIONS = 200;
export const MAX_DURATION_SECONDS = 10 * 60 * 60;

function field(path: string, code: string, message: string): AppError {
  return AppError.validation(message, [{ path, code, message }]);
}

/**
 * SIM-01/02: picks exactly N distinct eligible questions with a balanced distribution and stores
 * frozen snapshots of them, all in one transaction.
 */
@Injectable()
export class CreateSimulationUseCase implements ICreateSimulationUseCase {
  constructor(
    @Inject(QUESTION_POOL) private readonly pool: IQuestionPoolPort,
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
  ) {}

  /** Random source for the draw and the question order (replaced in tests). */
  random: () => number = Math.random;

  async execute(input: CreateSimulationInput): Promise<Result<SimulationView, AppError>> {
    const subjectIds = [...new Set(input.subjectIds)];
    if (subjectIds.length === 0) {
      return Result.fail(field('subjectIds', 'REQUIRED', 'Choose at least one subject.'));
    }
    if (input.questionCount < subjectIds.length || input.questionCount > MAX_QUESTIONS) {
      return Result.fail(
        field(
          'questionCount',
          'OUT_OF_RANGE',
          `Choose between ${subjectIds.length} (one per subject) and ${MAX_QUESTIONS} questions.`,
        ),
      );
    }
    const mode = input.mode ?? 'exam';
    if (mode === 'study' && input.timed) {
      return Result.fail(
        field('timed', 'NOT_ALLOWED', 'Study sessions have no timer: send timed false.'),
      );
    }
    const duration = input.timed ? (input.durationSeconds ?? null) : null;
    if (input.timed && (!duration || duration < 60 || duration > MAX_DURATION_SECONDS)) {
      return Result.fail(
        field(
          'durationSeconds',
          'OUT_OF_RANGE',
          'A timed exam lasts between 1 minute and 10 hours.',
        ),
      );
    }

    const collectionId = input.collectionId ?? null;
    if (collectionId && !(await this.pool.ownsCollection(input.userId, collectionId))) {
      return Result.fail(ResourceErrors.notFound('Collection'));
    }
    const filter: PoolFilter = {
      ownerUserId: input.userId,
      difficulty: input.difficulty,
      collectionId,
    };

    const availability = new Map(
      (await this.pool.availability(filter)).map((subject) => [subject.subjectId, subject]),
    );
    const plan = balancedDistribution(
      subjectIds.map((subjectId) => ({
        subjectId,
        available: availability.get(subjectId)?.available ?? 0,
      })),
      input.questionCount,
    );
    if (plan.isFailure) return Result.fail(ExamErrors.insufficientQuestions(plan.error));

    const pickedIds: string[] = [];
    for (const subjectId of subjectIds) {
      const ids = await this.pool.eligibleIds(filter, subjectId);
      pickedIds.push(...shuffle(ids, this.random).slice(0, plan.value.get(subjectId)));
    }
    const snapshots = await this.pool.snapshots(input.userId, pickedIds);
    if (snapshots.size !== pickedIds.length) {
      // A question changed between counting and reading: ask the student to try again.
      return Result.fail(
        ResourceErrors.conflict(
          'Your question bank changed while creating the simulation. Try again.',
        ),
      );
    }

    const order = shuffle(pickedIds, this.random);
    const title =
      input.title?.trim() ||
      this.defaultTitle(subjectIds.map((id) => availability.get(id)?.subjectName ?? ''));
    const simulation = Simulation.create({
      ownerUserId: input.userId,
      title: title.slice(0, 120),
      mode,
      difficulty: input.difficulty,
      timed: input.timed,
      durationSeconds: duration,
      configuration: {
        subjectIds,
        distribution: 'balanced',
        collectionId,
        perSubject: Object.fromEntries(plan.value),
        subjectNames: Object.fromEntries(
          subjectIds.map((id) => [id, availability.get(id)?.subjectName ?? '']),
        ),
      },
      picked: order.map((id) => ({ sourceQuestionId: id, snapshot: snapshots.get(id)! })),
    });
    await this.simulations.create(simulation);
    return Result.ok(toSimulationView(simulation));
  }

  async fromQuestions(input: CreateFromQuestionsInput): Promise<Result<SimulationView, AppError>> {
    const ids = [...new Set(input.questionIds)];
    if (ids.length === 0 || ids.length > MAX_QUESTIONS) {
      return Result.fail(
        field('questionIds', 'OUT_OF_RANGE', `Choose between 1 and ${MAX_QUESTIONS} questions.`),
      );
    }
    const snapshots = await this.pool.snapshots(input.userId, ids);
    if (snapshots.size !== ids.length) {
      // Archived, deleted or someone else's: the list is stale.
      return Result.fail(ResourceErrors.notFound('Question'));
    }
    const subjectIds: string[] = [];
    const perSubject: Record<string, number> = {};
    const subjectNames: Record<string, string> = {};
    for (const id of ids) {
      const { subjectId, subjectName } = snapshots.get(id)!;
      if (!(subjectId in perSubject)) subjectIds.push(subjectId);
      perSubject[subjectId] = (perSubject[subjectId] ?? 0) + 1;
      subjectNames[subjectId] = subjectName;
    }
    const title =
      input.title?.trim() || this.defaultTitle(subjectIds.map((id) => subjectNames[id] ?? ''));
    const simulation = Simulation.create({
      ownerUserId: input.userId,
      title: title.slice(0, 120),
      mode: input.mode ?? 'study',
      difficulty: 'all',
      timed: false,
      durationSeconds: null,
      configuration: {
        subjectIds,
        distribution: 'balanced',
        collectionId: null,
        perSubject,
        subjectNames,
      },
      picked: ids.map((id) => ({ sourceQuestionId: id, snapshot: snapshots.get(id)! })),
    });
    await this.simulations.create(simulation);
    return Result.ok(toSimulationView(simulation));
  }

  private defaultTitle(names: string[]): string {
    return names.length <= 2
      ? names.join(' e ')
      : `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`;
  }
}
