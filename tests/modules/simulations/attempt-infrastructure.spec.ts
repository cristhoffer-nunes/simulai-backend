import { Prisma } from '@prisma/client';
import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import { PrismaAttemptRepository } from '@/modules/simulations/infrastructure/prisma-attempt.repository';
import { buildSimulation } from './helpers';

const at = new Date('2026-10-27T10:00:00Z');
const row = (overrides = {}) => ({
  id: 'a1',
  simulationId: 'sim1',
  ownerUserId: 'u1',
  status: 'in_progress',
  startedAt: at,
  expiresAt: null,
  finishedAt: null,
  finishReason: null,
  correctCount: null,
  incorrectCount: null,
  unansweredCount: null,
  scorePercentage: null,
  createdAt: at,
  answers: [{ simulationQuestionId: 'sq1', selectedOptionKey: 'A', answeredAt: at }],
  ...overrides,
});

function build() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    simulationAttempt: { findUniqueOrThrow: jest.fn().mockResolvedValue(row()), update: jest.fn() },
    attemptAnswer: { upsert: jest.fn() },
  };
  const prisma = {
    simulationAttempt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, repo: new PrismaAttemptRepository(prisma as never) };
}

describe('PrismaAttemptRepository', () => {
  it('creates and reports the one-active-attempt conflict', async () => {
    const { prisma, repo } = build();
    const attempt = Attempt.start(buildSimulation(1));
    await expect(repo.create(attempt)).resolves.toBe(true);
    expect(prisma.simulationAttempt.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ id: attempt.id, status: 'in_progress' }),
    );
    prisma.simulationAttempt.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' }),
    );
    await expect(repo.create(attempt)).resolves.toBe(false);
    prisma.simulationAttempt.create.mockRejectedValueOnce(new Error('down'));
    await expect(repo.create(attempt)).rejects.toThrow('down');
  });

  it('finds owned and active attempts with answers and scores', async () => {
    const { prisma, repo } = build();
    prisma.simulationAttempt.findFirst
      .mockResolvedValueOnce(
        row({
          status: 'completed',
          finishedAt: at,
          finishReason: 'manual',
          correctCount: 1,
          incorrectCount: 0,
          unansweredCount: 1,
          scorePercentage: new Prisma.Decimal('50.00'),
        }),
      )
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row({ correctCount: null, scorePercentage: new Prisma.Decimal('0') }))
      .mockResolvedValueOnce(null);
    const done = await repo.findOwned('u1', 'a1');
    expect(done?.score).toEqual({
      correctCount: 1,
      incorrectCount: 0,
      unansweredCount: 1,
      scorePercentage: 50,
    });
    expect(done?.answers.get('sq1')?.selectedOptionId).toBe('A');
    await expect(repo.findOwned('u1', 'x')).resolves.toBeNull();
    expect((await repo.findActive('u1', 'sim1'))?.score).toEqual({
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 0,
      scorePercentage: 0,
    });
    await expect(repo.findActive('u1', 'sim1')).resolves.toBeNull();
    expect(prisma.simulationAttempt.findFirst.mock.calls[3][0].where).toEqual({
      ownerUserId: 'u1',
      simulationId: 'sim1',
      status: 'in_progress',
    });
  });

  it('locks the row, runs the work and persists answers and the finish', async () => {
    const { tx, repo } = build();
    const simulation = buildSimulation(2);
    const result = await repo.withLock('u1', 'a1', (attempt) => {
      attempt.answer(simulation.questions, simulation.questions[0]!.id, 'A');
      return attempt.finish(simulation.questions, 'manual');
    });
    expect(result?.value).toBe(true);
    expect(String(tx.$queryRaw.mock.calls[0][0].join('?'))).toContain('FOR UPDATE');
    expect(tx.attemptAnswer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          attemptId_simulationQuestionId: {
            attemptId: 'a1',
            simulationQuestionId: simulation.questions[0]!.id,
          },
        },
        update: expect.objectContaining({ selectedOptionKey: 'A' }),
      }),
    );
    expect(tx.simulationAttempt.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ status: 'completed', finishReason: 'manual', scorePercentage: 50 }),
    );
  });

  it('writes nothing when nothing changed, and null for foreign attempts', async () => {
    const { tx, repo } = build();
    await repo.withLock('u1', 'a1', () => 'noop');
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
    expect(tx.simulationAttempt.update).not.toHaveBeenCalled();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(repo.withLock('u2', 'a1', () => 1)).resolves.toBeNull();
  });

  it('numbers attempts and finds overdue ones', async () => {
    const { prisma, repo } = build();
    prisma.simulationAttempt.count.mockResolvedValue(3);
    const attempt = Attempt.start(buildSimulation(1));
    await expect(repo.attemptNumber(attempt)).resolves.toBe(3);
    expect(prisma.simulationAttempt.count.mock.calls[0][0].where).toEqual({
      simulationId: attempt.simulationId,
      createdAt: { lte: attempt.createdAt },
    });
    prisma.simulationAttempt.findMany.mockResolvedValue([{ id: 'a1' }]);
    await expect(repo.findOverdue(at, 10)).resolves.toEqual([{ id: 'a1' }]);
    expect(prisma.simulationAttempt.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: { status: 'in_progress', expiresAt: { lte: at } },
        take: 10,
      }),
    );
  });
});
