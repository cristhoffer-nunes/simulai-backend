import { Prisma } from '@prisma/client';
import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { encodeCursor } from '@/shared/pagination/cursor';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import {
  AttemptHistoryItem,
  IPerformanceQuery,
} from '@/modules/simulations/application/ports/performance-query.port';
import { GetDashboardUseCase } from '@/modules/simulations/application/use-cases/get-dashboard.use-case';
import { ListAttemptsUseCase } from '@/modules/simulations/application/use-cases/list-attempts.use-case';
import { PrismaPerformanceQuery } from '@/modules/simulations/infrastructure/prisma-performance.query';
import { HistoryController } from '@/modules/simulations/presentation/controllers/history.controller';
import { buildSimulation, fakeSimulations } from './helpers';

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`);

const item = (id: string, overrides: Partial<AttemptHistoryItem> = {}): AttemptHistoryItem => ({
  attemptId: id,
  simulationId: 'sim',
  title: 'Anatomia',
  subjectNames: ['Anatomia'],
  attemptNumber: 1,
  status: 'completed',
  finishReason: 'manual',
  startedAt: at(1),
  expiresAt: null,
  finishedAt: at(1),
  durationSeconds: null,
  totalQuestions: 10,
  answeredCount: 8,
  correctCount: 6,
  scorePercentage: 60,
  createdAt: at(1),
  ...overrides,
});

function fakePerformance(): jest.Mocked<IPerformanceQuery> {
  return {
    history: jest.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
    bank: jest.fn().mockResolvedValue({ totalQuestions: 0, totalTopics: 0, subjects: [] }),
    attemptTotals: jest.fn().mockResolvedValue({
      totalSimulations: 0,
      finishedAttempts: 0,
      timeoutAttempts: 0,
      inProgressAttempts: 0,
      answeredQuestions: 0,
      correctAnswers: 0,
    }),
    performance: jest.fn().mockResolvedValue([]),
  };
}

describe('ListAttemptsUseCase', () => {
  it('pages the history with a cursor', async () => {
    const performance = fakePerformance();
    performance.history.mockResolvedValue({
      items: [item('a2'), item('a1')],
      total: 3,
      hasMore: true,
    });
    const useCase = new ListAttemptsUseCase(performance, fakeSimulations(null));
    const page = (await useCase.execute({ userId: 'u1', status: 'finished', limit: 2 })).value;
    expect(page.total).toBe(3);
    expect(page.nextCursor).toBe(encodeCursor({ createdAt: at(1), id: 'a1' }));
    const next = await useCase.execute({ userId: 'u1', cursor: page.nextCursor!, limit: 500 });
    expect(next.isSuccess).toBe(true);
    expect(performance.history).toHaveBeenLastCalledWith('u1', {
      status: undefined,
      simulationId: undefined,
      after: { createdAt: at(1), id: 'a1' },
      limit: 100,
    });
  });

  it('rejects bad cursors and other students’ simulations', async () => {
    const performance = fakePerformance();
    const useCase = new ListAttemptsUseCase(performance, fakeSimulations(null));
    expect((await useCase.execute({ userId: 'u1', cursor: 'nope' })).error.kind).toBe(
      'VALIDATION_ERROR',
    );
    expect((await useCase.execute({ userId: 'u2', simulationId: 'sim' })).error.kind).toBe(
      'NOT_FOUND',
    );
    const own = new ListAttemptsUseCase(performance, fakeSimulations(buildSimulation(1)));
    const page = (await own.execute({ userId: 'u1', simulationId: 'sim' })).value;
    expect(page).toEqual({ items: [], total: 0, nextCursor: null });
    expect(performance.history).toHaveBeenLastCalledWith(
      'u1',
      expect.objectContaining({ simulationId: 'sim', limit: 20 }),
    );
  });
});

describe('GetDashboardUseCase', () => {
  it('derives every indicator from the attempts (RES-02)', async () => {
    const performance = fakePerformance();
    performance.bank.mockResolvedValue({
      totalQuestions: 40,
      totalTopics: 5,
      subjects: [
        { subjectId: 's1', subjectName: 'Anatomia', questionCount: 30 },
        { subjectId: 's3', subjectName: 'Ginecologia', questionCount: 10 },
      ],
    });
    performance.attemptTotals.mockResolvedValue({
      totalSimulations: 3,
      finishedAttempts: 2,
      timeoutAttempts: 1,
      inProgressAttempts: 1,
      answeredQuestions: 20,
      correctAnswers: 13,
    });
    performance.performance.mockResolvedValue([
      {
        subjectId: 's1',
        subjectName: 'Anatomia',
        total: 12,
        correct: 9,
        topics: [{ topicId: 't1', topicName: 'Tórax', total: 12, correct: 9 }],
      },
      {
        subjectId: 's2',
        subjectName: 'Cardiologia',
        total: 8,
        correct: 4,
        topics: [{ topicId: null, topicName: null, total: 8, correct: 4 }],
      },
    ]);
    performance.history
      .mockResolvedValueOnce({
        items: [item('run', { status: 'in_progress' })],
        total: 1,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        items: [item('a2', { scorePercentage: 70 }), item('a1', { scorePercentage: null })],
        total: 2,
        hasMore: false,
      });
    const view = (await new GetDashboardUseCase(performance).execute('u1')).value;
    expect(view).toEqual(
      expect.objectContaining({
        totalQuestions: 40,
        totalTopics: 5,
        totalSimulations: 3,
        totalAttempts: 2,
        timeoutAttempts: 1,
        inProgressAttempts: 1,
        answeredQuestions: 20,
        correctAnswers: 13,
        accuracyPercent: 65,
      }),
    );
    expect(
      view.bySubject.map((subject) => [
        subject.subjectName,
        subject.bankQuestions,
        subject.accuracyPercent,
      ]),
    ).toEqual([
      ['Anatomia', 30, 75],
      ['Cardiologia', 0, 50],
      ['Ginecologia', 10, null],
    ]);
    expect(view.bySubject[0]!.topics[0]!.accuracyPercent).toBe(75);
    expect(view.inProgress.map((entry) => entry.attemptId)).toEqual(['run']);
    expect(view.recent.map((entry) => entry.attemptId)).toEqual(['a2', 'a1']);
    expect(view.trend.map((point) => [point.attemptId, point.scorePercentage])).toEqual([
      ['a1', 0],
      ['a2', 70],
    ]);
    expect(performance.history).toHaveBeenCalledWith('u1', { status: 'finished', limit: 20 });
  });

  it('has no accuracy before the first finished attempt', async () => {
    const view = (await new GetDashboardUseCase(fakePerformance()).execute('u1')).value;
    expect(view.accuracyPercent).toBeNull();
    expect(view.trend).toEqual([]);
  });
});

describe('PrismaPerformanceQuery', () => {
  function build() {
    const prisma = {
      simulationAttempt: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      simulation: { count: jest.fn().mockResolvedValue(4) },
      question: { groupBy: jest.fn() },
      subject: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((calls: Promise<unknown>[]) => Promise.all(calls)),
    };
    return { prisma, query: new PrismaPerformanceQuery(prisma as never) };
  }

  const row = (id: string, simulationId: string, overrides = {}) => ({
    id,
    simulationId,
    status: 'completed',
    finishReason: 'manual',
    startedAt: at(2),
    expiresAt: null,
    finishedAt: at(2),
    correctCount: 3,
    scorePercentage: new Prisma.Decimal('75'),
    createdAt: at(2),
    simulation: {
      title: 'Anatomia',
      questionCount: 4,
      durationSeconds: 480,
      configuration: { subjectIds: ['s1', 's9'], subjectNames: { s1: 'Anatomia' } },
    },
    _count: { answers: 4 },
    ...overrides,
  });

  it('lists the owner’s attempts with numbers, answered counts and scores', async () => {
    const { prisma, query } = build();
    prisma.simulationAttempt.findMany
      .mockResolvedValueOnce([
        row('a2', 'sim'),
        row('b1', 'other', { scorePercentage: null, correctCount: null }),
        row('extra', 'sim'),
      ])
      .mockResolvedValueOnce([
        { id: 'a1', simulationId: 'sim' },
        { id: 'b1', simulationId: 'other' },
        { id: 'a2', simulationId: 'sim' },
      ]);
    const page = await query.history('u1', { status: 'finished', simulationId: 'sim', limit: 2 });
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(2);
    expect(
      page.items.map((entry) => [entry.attemptId, entry.attemptNumber, entry.scorePercentage]),
    ).toEqual(
      [
        ['a2', 2],
        ['b1', 1],
      ].map(([id, n], index) => [id, n, index === 0 ? 75 : null]),
    );
    expect(page.items[0]!.subjectNames).toEqual(['Anatomia', '']);
    const where = prisma.simulationAttempt.findMany.mock.calls[0][0].where.AND[0];
    expect(where).toEqual({
      ownerUserId: 'u1',
      status: { not: 'in_progress' },
      simulationId: 'sim',
    });
  });

  it('applies cursors in both directions and plain statuses', async () => {
    const { prisma, query } = build();
    prisma.simulationAttempt.findMany.mockResolvedValue([]);
    const after = { createdAt: at(3), id: 'x' };
    await query.history('u1', { status: 'expired', after, limit: 5 });
    let call = prisma.simulationAttempt.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual([
      { ownerUserId: 'u1', status: 'expired' },
      { OR: [{ createdAt: { lt: at(3) } }, { createdAt: at(3), id: { lt: 'x' } }] },
    ]);
    await query.history('u1', { after, limit: 5, oldestFirst: true });
    call = prisma.simulationAttempt.findMany.mock.calls[1][0];
    expect(call.where.AND[1]).toEqual({
      OR: [{ createdAt: { gt: at(3) } }, { createdAt: at(3), id: { gt: 'x' } }],
    });
    expect(call.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(prisma.simulationAttempt.findMany).toHaveBeenCalledTimes(2);
  });

  it('summarises the bank', async () => {
    const { prisma, query } = build();
    prisma.question.groupBy
      .mockResolvedValueOnce([
        { subjectId: 's2', _count: { _all: 3 } },
        { subjectId: 's1', _count: { _all: 5 } },
        { subjectId: 'gone', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ topicId: 't1' }, { topicId: 't2' }]);
    prisma.subject.findMany.mockResolvedValue([
      { id: 's1', name: 'Anatomia' },
      { id: 's2', name: 'Cardiologia' },
    ]);
    const bank = await query.bank('u1');
    expect(bank.totalQuestions).toBe(9);
    expect(bank.totalTopics).toBe(2);
    expect(bank.subjects.map((subject) => subject.subjectName)).toEqual([
      '',
      'Anatomia',
      'Cardiologia',
    ]);
    expect(prisma.question.groupBy.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
      status: 'active',
    });

    prisma.question.groupBy.mockResolvedValue([]);
    expect(await query.bank('u1')).toEqual({ totalQuestions: 0, totalTopics: 0, subjects: [] });
  });

  it('adds up attempts by status and score sums', async () => {
    const { prisma, query } = build();
    prisma.simulationAttempt.groupBy.mockResolvedValue([
      { status: 'completed', _count: { _all: 3 } },
      { status: 'expired', _count: { _all: 1 } },
      { status: 'in_progress', _count: { _all: 1 } },
    ]);
    prisma.simulationAttempt.aggregate
      .mockResolvedValueOnce({ _sum: { correctCount: 20, incorrectCount: 8, unansweredCount: 2 } })
      .mockResolvedValueOnce({
        _sum: { correctCount: null, incorrectCount: null, unansweredCount: null },
      });
    expect(await query.attemptTotals('u1')).toEqual({
      totalSimulations: 4,
      finishedAttempts: 4,
      timeoutAttempts: 1,
      inProgressAttempts: 1,
      answeredQuestions: 30,
      correctAnswers: 20,
    });
    prisma.simulationAttempt.groupBy.mockResolvedValue([]);
    expect((await query.attemptTotals('u1')).answeredQuestions).toBe(0);
  });

  it('groups performance by subject and topic from the snapshots', async () => {
    const { prisma, query } = build();
    prisma.$queryRaw.mockResolvedValue([
      {
        subject_id: 's2',
        subject_name: 'Cardiologia',
        topic_id: null,
        topic_name: null,
        total: 4,
        correct: 1,
      },
      {
        subject_id: 's1',
        subject_name: 'Anatomia',
        topic_id: 't2',
        topic_name: 'Tórax',
        total: 6,
        correct: 5,
      },
      {
        subject_id: 's1',
        subject_name: 'Anatomia',
        topic_id: 't1',
        topic_name: 'Coronárias',
        total: 2,
        correct: 1,
      },
      {
        subject_id: 's1',
        subject_name: 'Anatomia',
        topic_id: 't3',
        topic_name: null,
        total: 1,
        correct: 0,
      },
    ]);
    const result = await query.performance('u1');
    expect(result.map((subject) => [subject.subjectName, subject.total, subject.correct])).toEqual([
      ['Anatomia', 9, 6],
      ['Cardiologia', 4, 1],
    ]);
    expect(result[0]!.topics.map((topic) => topic.topicName)).toEqual([
      null,
      'Coronárias',
      'Tórax',
    ]);
    const sql = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain("status <> 'in_progress'");
    expect(sql.values).toEqual(['u1']);
  });
});

describe('HistoryController', () => {
  const user = { sub: 'u1' } as never;
  it('serves the signed-in student only', async () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, HistoryController)).toEqual(['study.access']);
    const list = { execute: jest.fn().mockResolvedValue(Result.ok({ items: [] })) };
    const dashboard = { execute: jest.fn().mockResolvedValue(Result.ok({ totalQuestions: 1 })) };
    const controller = new HistoryController(list as never, dashboard as never);
    await controller.list(user, { status: 'finished' });
    expect(list.execute).toHaveBeenLastCalledWith({ userId: 'u1', status: 'finished' });
    await controller.ofSimulation(user, 'sim', { simulationId: 'other' } as never);
    expect(list.execute).toHaveBeenLastCalledWith({ userId: 'u1', simulationId: 'sim' });
    expect(await controller.overview(user)).toEqual({ totalQuestions: 1 });
    expect(dashboard.execute).toHaveBeenCalledWith('u1');
  });

  it('maps failures', async () => {
    const failing = { execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))) };
    const controller = new HistoryController(failing as never, failing as never);
    await expect(controller.list(user, {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.ofSimulation(user, 'sim', {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.overview(user)).rejects.toBeInstanceOf(DomainException);
  });
});
