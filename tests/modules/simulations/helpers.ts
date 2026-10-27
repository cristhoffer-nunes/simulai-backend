import {
  IQuestionPoolPort,
  SubjectPool,
} from '@/modules/simulations/application/ports/question-pool.port';
import { Simulation } from '@/modules/simulations/domain/simulation.entity';
import { ISimulationRepository } from '@/modules/simulations/domain/simulation.repository';
import { QuestionSnapshot } from '@/modules/simulations/domain/snapshot';

export const snapshot = (
  subjectId: string,
  overrides: Partial<QuestionSnapshot> = {},
): QuestionSnapshot => ({
  statement: `Pergunta de ${subjectId}?`,
  options: [
    { id: 'A', text: 'um' },
    { id: 'B', text: 'dois' },
  ],
  correctOptionId: 'B',
  explanation: 'Porque sim.',
  subjectId,
  subjectName: subjectId === 's1' ? 'Anatomia' : 'Cardiologia',
  topicId: null,
  topicName: null,
  difficulty: 'easy',
  ...overrides,
});

/** s1: q1..q12, s2: q101..q107 (ids encode the subject). */
export function fakePool(
  available: SubjectPool[] = [
    { subjectId: 's1', subjectName: 'Anatomia', available: 12 },
    { subjectId: 's2', subjectName: 'Cardiologia', available: 7 },
  ],
) {
  return {
    availability: jest.fn().mockResolvedValue(available),
    eligibleIds: jest.fn(async (_f: unknown, subjectId: string) => {
      const pool = available.find((item) => item.subjectId === subjectId);
      const base = subjectId === 's1' ? 0 : 100;
      return Array.from({ length: pool?.available ?? 0 }, (_, i) => `q${base + i + 1}`);
    }),
    snapshots: jest.fn(
      async (_u: string, ids: string[]) =>
        new Map(ids.map((id) => [id, snapshot(Number(id.slice(1)) > 100 ? 's2' : 's1')])),
    ),
    ownsCollection: jest.fn(async (_u: string, id: string) => id === 'c1'),
  } as jest.Mocked<IQuestionPoolPort>;
}

export function fakeSimulations(simulation: Simulation | null = null) {
  return {
    create: jest.fn(),
    findOwned: jest.fn().mockResolvedValue(simulation),
    saveStatus: jest.fn(),
    list: jest.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
  } as jest.Mocked<ISimulationRepository>;
}

export function buildSimulation(
  count = 3,
  overrides: Partial<Parameters<typeof Simulation.create>[0]> = {},
) {
  return Simulation.create({
    ownerUserId: 'u1',
    title: 'Anatomia',
    difficulty: 'all',
    timed: true,
    durationSeconds: 600,
    configuration: {
      subjectIds: ['s1'],
      distribution: 'balanced',
      collectionId: null,
      perSubject: { s1: count },
      subjectNames: { s1: 'Anatomia' },
    },
    picked: Array.from({ length: count }, (_, i) => ({
      sourceQuestionId: `q${i + 1}`,
      snapshot: snapshot('s1', { correctOptionId: i % 2 === 0 ? 'A' : 'B' }),
    })),
    ...overrides,
  });
}

import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import { IAttemptRepository } from '@/modules/simulations/domain/attempt.repository';

/** In-memory attempts store with the same contract as the Prisma one (lock = sequential). */
export function memoryAttempts(initial: Attempt[] = []) {
  const rows = new Map(initial.map((attempt) => [attempt.id, attempt]));
  const repo = {
    create: jest.fn(async (attempt: Attempt) => {
      const clash = [...rows.values()].some(
        (other) => other.simulationId === attempt.simulationId && other.isActive,
      );
      if (clash) return false;
      rows.set(attempt.id, attempt);
      return true;
    }),
    findOwned: jest.fn(async (owner: string, id: string) => {
      const found = rows.get(id);
      return found && found.ownerUserId === owner ? found : null;
    }),
    findActive: jest.fn(
      async (owner: string, simulationId: string) =>
        [...rows.values()].find(
          (a) => a.ownerUserId === owner && a.simulationId === simulationId && a.isActive,
        ) ?? null,
    ),
    withLock: jest.fn(async <T>(owner: string, id: string, work: (attempt: Attempt) => T) => {
      const found = rows.get(id);
      if (!found || found.ownerUserId !== owner) return null;
      return { attempt: found, value: work(found) };
    }),
    attemptNumber: jest.fn().mockResolvedValue(1),
    findOverdue: jest.fn(async (now: Date) =>
      [...rows.values()]
        .filter((a) => a.isActive && a.isPastDeadline(now))
        .map((a) => ({ id: a.id, ownerUserId: a.ownerUserId, simulationId: a.simulationId })),
    ),
  };
  return { rows, repo: repo as unknown as jest.Mocked<IAttemptRepository> };
}
