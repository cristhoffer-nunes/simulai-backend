import { Prisma } from '@prisma/client';
import { ATTEMPT_STATS_QUERY } from '@/modules/simulations/application/ports/attempt-stats.port';
import { GetAttemptResultUseCase } from '@/modules/simulations/application/use-cases/get-attempt-result.use-case';
import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import {
  gradeQuestions,
  percentOf,
  scoreBySubject,
  verdictOf,
} from '@/modules/simulations/domain/grading';
import { Simulation } from '@/modules/simulations/domain/simulation.entity';
import { PrismaAttemptStatsQuery } from '@/modules/simulations/infrastructure/prisma-attempt-stats.query';
import { fakeSimulations, memoryAttempts, snapshot } from './helpers';

const past = (seconds: number) => new Date(Date.now() - seconds * 1000);

/** Two subjects: s1 keys A, B; s2 key B. */
function mixedSimulation() {
  return Simulation.create({
    ownerUserId: 'u1',
    title: 'Anatomia e Cardiologia',
    difficulty: 'all',
    timed: true,
    durationSeconds: 600,
    configuration: {
      subjectIds: ['s1', 's2'],
      distribution: 'balanced',
      collectionId: null,
      perSubject: { s1: 2, s2: 1 },
      subjectNames: { s1: 'Anatomia', s2: 'Cardiologia' },
    },
    picked: [
      {
        sourceQuestionId: 'q1',
        snapshot: snapshot('s1', { correctOptionId: 'A', topicId: 't1', topicName: 'Tórax' }),
      },
      { sourceQuestionId: 'q2', snapshot: snapshot('s1', { correctOptionId: 'B' }) },
      {
        sourceQuestionId: 'q3',
        snapshot: snapshot('s2', { correctOptionId: 'B', explanation: 'Estenose aórtica.' }),
      },
    ],
  });
}

function stats() {
  return {
    subjectTotals: jest.fn().mockResolvedValue(new Map([['s1', { total: 10, correct: 7 }]])),
    previousFinished: jest
      .fn()
      .mockResolvedValue({ attemptId: 'old', attemptNumber: 1, scorePercentage: 50 }),
    attemptCount: jest.fn().mockResolvedValue(2),
  };
}

describe('grading', () => {
  it('marks each question and scores each subject', () => {
    const simulation = mixedSimulation();
    const attempt = Attempt.start(simulation);
    const [q1, q2] = simulation.questions;
    attempt.answer(simulation.questions, q1!.id, 'A');
    attempt.answer(simulation.questions, q2!.id, 'A');
    const graded = gradeQuestions(simulation.questions, attempt.answers);
    expect(graded.map((question) => question.verdict)).toEqual(['correct', 'incorrect', 'blank']);
    expect(graded[0]).toEqual(
      expect.objectContaining({
        topicName: 'Tórax',
        correctOptionId: 'A',
        selectedOptionId: 'A',
        explanation: 'Porque sim.',
      }),
    );
    expect(scoreBySubject(graded)).toEqual([
      {
        subjectId: 's1',
        subjectName: 'Anatomia',
        total: 2,
        correct: 1,
        incorrect: 1,
        unanswered: 0,
        scorePercentage: 50,
      },
      {
        subjectId: 's2',
        subjectName: 'Cardiologia',
        total: 1,
        correct: 0,
        incorrect: 0,
        unanswered: 1,
        scorePercentage: 0,
      },
    ]);
    expect([percentOf(1, 3), percentOf(0, 0)]).toEqual([33.33, 0]);
    expect(verdictOf(null, 'A')).toBe('blank');
  });
});

describe('GetAttemptResultUseCase', () => {
  function setup(started = new Date()) {
    const simulation = mixedSimulation();
    const attempt = Attempt.start(simulation, started);
    const { rows, repo } = memoryAttempts([attempt]);
    const query = stats();
    const useCase = new GetAttemptResultUseCase(fakeSimulations(simulation), repo, query);
    return { simulation, attempt, rows, repo, query, useCase };
  }

  it('refuses the answer key while the attempt is running (RES-01)', async () => {
    const { attempt, useCase } = setup();
    const result = await useCase.execute('u1', attempt.id);
    expect(result.error.kind).toBe('ATTEMPT_IN_PROGRESS');
  });

  it('returns key, explanations, subjects, previous score and time used once finished', async () => {
    const { simulation, attempt, useCase, query } = setup(past(300));
    attempt.answer(simulation.questions, simulation.questions[0]!.id, 'A');
    attempt.finish(simulation.questions, 'manual');
    const view = (await useCase.execute('u1', attempt.id)).value;
    expect(view.score).toEqual({
      correctCount: 1,
      incorrectCount: 0,
      unansweredCount: 2,
      scorePercentage: 33.33,
    });
    expect(view.questions[2]).toEqual(
      expect.objectContaining({
        correctOptionId: 'B',
        explanation: 'Estenose aórtica.',
        verdict: 'blank',
      }),
    );
    expect(view.bySubject.map((subject) => subject.overallPercentage)).toEqual([70, null]);
    expect(view.previous).toEqual({ attemptId: 'old', attemptNumber: 1, scorePercentage: 50 });
    expect([view.attemptNumber, view.attemptCount, view.durationSeconds]).toEqual([1, 2, 600]);
    expect(view.timeUsedSeconds).toBeGreaterThanOrEqual(299);
    expect(query.subjectTotals).toHaveBeenCalledWith('u1', ['s1', 's2']);
    expect(query.previousFinished).toHaveBeenCalledWith('u1', simulation.id, attempt.createdAt);
  });

  it('closes an attempt whose time ran out and shows its result', async () => {
    const { attempt, useCase } = setup(past(601));
    const view = (await useCase.execute('u1', attempt.id)).value;
    expect(view.status).toBe('expired');
    expect(view.finishReason).toBe('timeout');
    expect(view.timeUsedSeconds).toBe(600);
  });

  it('keeps refusing if the expiry lock was lost, and hides other students', async () => {
    const { attempt, repo, useCase } = setup(past(601));
    repo.withLock.mockResolvedValueOnce(null);
    expect((await useCase.execute('u1', attempt.id)).error.kind).toBe('ATTEMPT_IN_PROGRESS');
    expect((await useCase.execute('u2', attempt.id)).error.kind).toBe('NOT_FOUND');
    const orphan = new GetAttemptResultUseCase(fakeSimulations(null), repo, stats());
    expect((await orphan.execute('u1', attempt.id)).error.kind).toBe('NOT_FOUND');
    expect(ATTEMPT_STATS_QUERY).toBeDefined();
  });

  it('reports untimed attempts without a finish time as unknown time used', async () => {
    const { simulation, attempt, useCase } = setup();
    attempt.finish(simulation.questions, 'manual');
    (attempt as unknown as { props: { finishedAt: Date | null } }).props.finishedAt = null;
    expect((await useCase.execute('u1', attempt.id)).value.timeUsedSeconds).toBeNull();
  });
});

describe('PrismaAttemptStatsQuery', () => {
  function build() {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ subject_id: 's1', total: 4, correct: 3 }]),
      simulationAttempt: { findFirst: jest.fn(), count: jest.fn() },
    };
    return { prisma, query: new PrismaAttemptStatsQuery(prisma as never) };
  }

  it('totals finished questions per subject for this student only', async () => {
    const { prisma, query } = build();
    await expect(query.subjectTotals('u1', [])).resolves.toEqual(new Map());
    const totals = await query.subjectTotals('u1', ['s1', 's2']);
    expect(totals.get('s1')).toEqual({ total: 4, correct: 3 });
    const sql = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain('owner_user_id');
    expect(sql.sql).toContain("status <> 'in_progress'");
    expect(sql.values).toEqual(['u1', 's1', 's2']);
  });

  it('finds the previous finished attempt and counts attempts', async () => {
    const { prisma, query } = build();
    const before = new Date('2026-10-27T10:00:00Z');
    prisma.simulationAttempt.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'a0',
        createdAt: new Date('2026-10-26T10:00:00Z'),
        scorePercentage: new Prisma.Decimal('62.5'),
      })
      .mockResolvedValueOnce({ id: 'a0', createdAt: before, scorePercentage: null });
    prisma.simulationAttempt.count.mockResolvedValue(1);
    await expect(query.previousFinished('u1', 'sim', before)).resolves.toBeNull();
    await expect(query.previousFinished('u1', 'sim', before)).resolves.toEqual({
      attemptId: 'a0',
      attemptNumber: 1,
      scorePercentage: 62.5,
    });
    expect(prisma.simulationAttempt.findFirst.mock.calls[1][0].where).toEqual({
      ownerUserId: 'u1',
      simulationId: 'sim',
      status: { not: 'in_progress' },
      createdAt: { lt: before },
    });
    expect((await query.previousFinished('u1', 'sim', before))?.scorePercentage).toBe(0);
    prisma.simulationAttempt.count.mockResolvedValue(3);
    await expect(query.attemptCount('sim')).resolves.toBe(3);
  });
});
