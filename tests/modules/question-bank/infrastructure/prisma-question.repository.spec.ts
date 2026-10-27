import { PrismaQuestionRepository } from '@/modules/question-bank/infrastructure/repositories/prisma-question.repository';
import { buildQuestion } from '../helpers';

const at = new Date('2026-10-01T00:00:00Z');
const row = {
  id: 'q1',
  ownerUserId: 'u1',
  subjectId: 's1',
  topicId: null,
  type: 'multiple_choice',
  statement: 'S',
  explanation: 'E',
  difficulty: 'easy',
  status: 'active',
  contentHash: 'h',
  sourceImportId: null,
  createdAt: at,
  updatedAt: at,
  subject: { id: 's1', name: 'Anatomia' },
  topic: null,
  _count: { collections: 2 },
  options: [
    { optionKey: 'A', text: 'x', isCorrect: false },
    { optionKey: 'B', text: 'y', isCorrect: true },
  ],
  collections: [{ collectionId: 'c1' }, { collectionId: 'c2' }],
};

function build() {
  const tx = {
    question: { update: jest.fn() },
    questionOption: { deleteMany: jest.fn(), createMany: jest.fn() },
    collectionQuestion: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    question: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    ),
  };
  return { prisma, tx, repo: new PrismaQuestionRepository(prisma as never) };
}

describe('PrismaQuestionRepository', () => {
  it("loads only the owner's question as an aggregate", async () => {
    const { prisma, repo } = build();
    prisma.question.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(null);

    const question = await repo.findOwned('u1', 'q1');

    expect(prisma.question.findFirst.mock.calls[0][0].where).toEqual({
      id: 'q1',
      ownerUserId: 'u1',
    });
    expect(question?.content.options[1]).toEqual({ key: 'B', text: 'y', isCorrect: true });
    await expect(repo.findOwned('u1', 'x')).resolves.toBeNull();
  });

  it('maps the detail view', async () => {
    const { prisma, repo } = build();
    prisma.question.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    const result = await repo.detail('u1', 'q1');
    expect(result).toEqual(
      expect.objectContaining({
        collectionCount: 2,
        collectionIds: ['c1', 'c2'],
        explanation: 'E',
        subject: { id: 's1', name: 'Anatomia' },
      }),
    );
    await expect(repo.detail('u1', 'x')).resolves.toBeNull();
  });

  it('lists with filters, keyset cursor and one extra row to detect more pages', async () => {
    const { prisma, repo } = build();
    prisma.question.findMany.mockResolvedValue([row, { ...row, id: 'q0' }]);
    prisma.question.count.mockResolvedValue(7);

    const page = await repo.list({
      ownerUserId: 'u1',
      status: 'active',
      subjectId: 's1',
      topicId: 't1',
      difficulty: 'easy',
      search: 'valva',
      collectionId: 'c1',
      after: { createdAt: at, id: 'q5' },
      limit: 1,
    });

    expect(page).toEqual(expect.objectContaining({ total: 7, hasMore: true }));
    expect(page.items).toHaveLength(1);
    const args = prisma.question.findMany.mock.calls[0][0];
    expect(args.take).toBe(2);
    expect(args.where.AND[0]).toEqual({
      ownerUserId: 'u1',
      status: 'active',
      subjectId: 's1',
      topicId: 't1',
      difficulty: 'easy',
      statement: { contains: 'valva', mode: 'insensitive' },
      collections: { some: { collectionId: 'c1' } },
    });
    expect(args.where.AND[1].OR).toHaveLength(2);
  });

  it('lists without optional filters', async () => {
    const { prisma, repo } = build();
    prisma.question.findMany.mockResolvedValue([]);
    prisma.question.count.mockResolvedValue(0);
    const page = await repo.list({ ownerUserId: 'u1', status: 'archived', limit: 20 });
    expect(page.hasMore).toBe(false);
    expect(prisma.question.findMany.mock.calls[0][0].where.AND).toEqual([
      { ownerUserId: 'u1', status: 'archived' },
      {},
    ]);
  });

  it('creates with options and saves by replacing them in a transaction', async () => {
    const { prisma, tx, repo } = build();
    const question = buildQuestion();
    await repo.create(question);
    expect(prisma.question.create.mock.calls[0][0].data.options.create).toEqual([
      { optionKey: 'A', text: 'Mitral', isCorrect: false },
      { optionKey: 'B', text: 'Tricúspide', isCorrect: true },
    ]);

    await repo.save(question);
    expect(tx.question.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q1' } }),
    );
    expect(tx.questionOption.deleteMany).toHaveBeenCalledWith({ where: { questionId: 'q1' } });
    expect(tx.questionOption.createMany.mock.calls[0][0].data[1]).toEqual({
      optionKey: 'B',
      text: 'Tricúspide',
      isCorrect: true,
      questionId: 'q1',
    });
    expect(tx.collectionQuestion.deleteMany).not.toHaveBeenCalled();
  });

  it('syncs collection memberships on create and save', async () => {
    const { prisma, tx, repo } = build();
    const question = buildQuestion();
    await repo.create(question, ['c1']);
    expect(prisma.question.create.mock.calls[0][0].data.collections).toEqual({
      create: [{ collectionId: 'c1' }],
    });

    await repo.save(question, ['c1', 'c2']);
    expect(tx.collectionQuestion.deleteMany).toHaveBeenCalledWith({
      where: { questionId: 'q1', collectionId: { notIn: ['c1', 'c2'] } },
    });
    expect(tx.collectionQuestion.createMany).toHaveBeenCalledWith({
      data: [
        { collectionId: 'c1', questionId: 'q1' },
        { collectionId: 'c2', questionId: 'q1' },
      ],
      skipDuplicates: true,
    });
  });

  it('filters owned question ids', async () => {
    const { prisma, repo } = build();
    await expect(repo.ownedIds('u1', [])).resolves.toEqual([]);
    prisma.question.findMany.mockResolvedValue([{ id: 'q1' }]);
    await expect(repo.ownedIds('u1', ['q1', 'q9'])).resolves.toEqual(['q1']);
  });
});
