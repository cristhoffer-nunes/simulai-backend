import { PrismaQuestionPoolAdapter } from '@/modules/simulations/infrastructure/prisma-question-pool.adapter';
import { PrismaSimulationRepository } from '@/modules/simulations/infrastructure/prisma-simulation.repository';
import { buildSimulation } from './helpers';

describe('PrismaQuestionPoolAdapter', () => {
  function build() {
    const prisma = {
      question: { groupBy: jest.fn(), findMany: jest.fn() },
      subject: { findMany: jest.fn() },
      questionCollection: { count: jest.fn() },
    };
    return { prisma, pool: new PrismaQuestionPoolAdapter(prisma as never) };
  }

  it('counts active questions per subject with filters, sorted by name', async () => {
    const { prisma, pool } = build();
    prisma.question.groupBy.mockResolvedValue([
      { subjectId: 's2', _count: { _all: 3 } },
      { subjectId: 's1', _count: { _all: 5 } },
    ]);
    prisma.subject.findMany.mockResolvedValue([
      { id: 's1', name: 'Anatomia' },
      { id: 's2', name: 'Cardiologia' },
    ]);
    const result = await pool.availability({
      ownerUserId: 'u1',
      difficulty: 'hard',
      collectionId: 'c1',
    });
    expect(result).toEqual([
      { subjectId: 's1', subjectName: 'Anatomia', available: 5 },
      { subjectId: 's2', subjectName: 'Cardiologia', available: 3 },
    ]);
    expect(prisma.question.groupBy.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
      status: 'active',
      difficulty: 'hard',
      collections: { some: { collectionId: 'c1' } },
    });

    prisma.question.groupBy.mockResolvedValue([]);
    await expect(
      pool.availability({ ownerUserId: 'u1', difficulty: 'all', collectionId: null }),
    ).resolves.toEqual([]);
    prisma.question.groupBy.mockResolvedValue([{ subjectId: 'gone', _count: { _all: 1 } }]);
    prisma.subject.findMany.mockResolvedValue([]);
    expect(
      (await pool.availability({ ownerUserId: 'u1', difficulty: 'all', collectionId: null }))[0]
        ?.subjectName,
    ).toBe('');
  });

  it('lists eligible ids and builds snapshots with the correct key', async () => {
    const { prisma, pool } = build();
    prisma.question.findMany.mockResolvedValueOnce([{ id: 'q1' }, { id: 'q2' }]);
    await expect(
      pool.eligibleIds({ ownerUserId: 'u1', difficulty: 'all', collectionId: null }, 's1'),
    ).resolves.toEqual(['q1', 'q2']);
    expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
      status: 'active',
      subjectId: 's1',
    });

    prisma.question.findMany.mockResolvedValueOnce([
      {
        id: 'q1',
        statement: 'S',
        explanation: 'E',
        subjectId: 's1',
        topicId: 't1',
        difficulty: 'easy',
        subject: { name: 'Anatomia' },
        topic: { name: 'Tórax' },
        options: [
          { optionKey: 'A', text: 'a', isCorrect: false },
          { optionKey: 'B', text: 'b', isCorrect: true },
        ],
      },
      {
        id: 'q2',
        statement: 'S2',
        explanation: 'E2',
        subjectId: 's1',
        topicId: null,
        difficulty: 'hard',
        subject: { name: 'Anatomia' },
        topic: null,
        options: [],
      },
    ]);
    const snapshots = await pool.snapshots('u1', ['q1', 'q2']);
    expect(snapshots.get('q1')).toEqual({
      statement: 'S',
      options: [
        { id: 'A', text: 'a' },
        { id: 'B', text: 'b' },
      ],
      correctOptionId: 'B',
      explanation: 'E',
      subjectId: 's1',
      subjectName: 'Anatomia',
      topicId: 't1',
      topicName: 'Tórax',
      difficulty: 'easy',
    });
    expect(snapshots.get('q2')).toEqual(
      expect.objectContaining({ correctOptionId: '', topicName: null }),
    );
    await expect(pool.snapshots('u1', [])).resolves.toEqual(new Map());
  });

  it('checks collection ownership', async () => {
    const { prisma, pool } = build();
    prisma.questionCollection.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(pool.ownsCollection('u1', 'c1')).resolves.toBe(true);
    await expect(pool.ownsCollection('u1', 'c2')).resolves.toBe(false);
  });
});

describe('PrismaSimulationRepository', () => {
  function build() {
    const prisma = {
      simulation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      simulationAttempt: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return { prisma, repo: new PrismaSimulationRepository(prisma as never) };
  }

  it('creates the simulation and its snapshots in one statement', async () => {
    const { prisma, repo } = build();
    const simulation = buildSimulation(2);
    await repo.create(simulation);
    const data = prisma.simulation.create.mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({
        id: simulation.id,
        questionCount: 2,
        timed: true,
        durationSeconds: 600,
      }),
    );
    expect(data.questions.createMany.data).toHaveLength(2);
    expect(data.questions.createMany.data[0]).toEqual(
      expect.objectContaining({ position: 1, sourceQuestionId: 'q1' }),
    );
  });

  it('loads an owned simulation with ordered snapshots', async () => {
    const { prisma, repo } = build();
    const simulation = buildSimulation(2);
    prisma.simulation.findFirst.mockResolvedValueOnce({
      id: simulation.id,
      ownerUserId: 'u1',
      title: 'T',
      status: 'archived',
      difficulty: 'easy',
      timed: false,
      durationSeconds: null,
      configuration: simulation.configuration,
      createdAt: simulation.createdAt,
      questions: simulation.questions.map((q) => ({ ...q })),
    });
    const loaded = await repo.findOwned('u1', simulation.id);
    expect(loaded?.status).toBe('archived');
    expect(loaded?.questions[1]?.position).toBe(2);
    expect(prisma.simulation.findFirst.mock.calls[0][0].where).toEqual({
      id: simulation.id,
      ownerUserId: 'u1',
    });
    prisma.simulation.findFirst.mockResolvedValueOnce(null);
    await expect(repo.findOwned('u1', 'x')).resolves.toBeNull();

    await repo.saveStatus(loaded!);
    expect(prisma.simulation.update).toHaveBeenCalledWith({
      where: { id: simulation.id },
      data: { status: 'archived' },
    });
  });

  it('lists with attempt summaries', async () => {
    const { prisma, repo } = build();
    const at = new Date('2026-10-20T10:00:00Z');
    const configuration = { subjectIds: ['s1', 's2'], subjectNames: { s1: 'Anatomia' } };
    prisma.simulation.findMany.mockResolvedValue([
      {
        id: 'sim1',
        title: 'A',
        status: 'ready',
        difficulty: 'all',
        questionCount: 10,
        timed: true,
        durationSeconds: 600,
        configuration,
        createdAt: at,
      },
      {
        id: 'sim2',
        title: 'B',
        status: 'ready',
        difficulty: 'all',
        questionCount: 5,
        timed: false,
        durationSeconds: null,
        configuration,
        createdAt: at,
      },
    ]);
    prisma.simulation.count.mockResolvedValue(2);
    prisma.simulationAttempt.findMany.mockResolvedValue([
      {
        id: 'a3',
        simulationId: 'sim1',
        status: 'in_progress',
        finishedAt: null,
        scorePercentage: null,
      },
      {
        id: 'a2',
        simulationId: 'sim1',
        status: 'completed',
        finishedAt: at,
        scorePercentage: '70.00',
      },
    ]);
    const page = await repo.list('u1', {
      status: 'ready',
      after: { createdAt: at, id: 'sim0' },
      limit: 1,
    });
    expect(page).toEqual(expect.objectContaining({ total: 2, hasMore: true }));
    expect(page.items).toEqual([
      expect.objectContaining({
        id: 'sim1',
        attemptCount: 2,
        activeAttemptId: 'a3',
        lastScore: 70,
        lastFinishedAt: at,
        subjectNames: ['Anatomia', ''],
      }),
    ]);

    prisma.simulation.findMany.mockResolvedValue([]);
    const empty = await repo.list('u1', { limit: 10 });
    expect(empty.items).toEqual([]);
    expect(prisma.simulationAttempt.findMany).toHaveBeenCalledTimes(1);

    prisma.simulation.findMany.mockResolvedValue([
      {
        id: 'sim2',
        title: 'B',
        status: 'ready',
        difficulty: 'all',
        questionCount: 5,
        timed: false,
        durationSeconds: null,
        configuration: { subjectIds: ['s1'] },
        createdAt: at,
      },
    ]);
    prisma.simulationAttempt.findMany.mockResolvedValue([]);
    const noAttempts = await repo.list('u1', { limit: 10 });
    expect(noAttempts.items[0]).toEqual(
      expect.objectContaining({
        attemptCount: 0,
        activeAttemptId: null,
        lastScore: null,
        subjectNames: [''],
      }),
    );
  });
});
