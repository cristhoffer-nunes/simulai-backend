import { Collection } from '@/modules/question-bank/domain/collections/collection.entity';
import { PrismaCollectionRepository } from '@/modules/question-bank/infrastructure/repositories/prisma-collection.repository';

const at = new Date('2026-10-01T00:00:00Z');
const row = {
  id: 'c1',
  ownerUserId: 'u1',
  name: 'Revisão',
  description: null,
  createdAt: at,
  _count: { questions: 4 },
};

function build() {
  const prisma = {
    questionCollection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    collectionQuestion: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: jest.fn(),
    },
  };
  return { prisma, repo: new PrismaCollectionRepository(prisma as never) };
}

describe('PrismaCollectionRepository', () => {
  it('lists and summarizes with question counts, scoped to the owner', async () => {
    const { prisma, repo } = build();
    prisma.questionCollection.findMany.mockResolvedValue([row]);
    expect(await repo.listByOwner('u1')).toEqual([
      { id: 'c1', name: 'Revisão', description: null, questionCount: 4, createdAt: at },
    ]);
    expect(prisma.questionCollection.findMany.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
    });

    prisma.questionCollection.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    expect((await repo.summary('u1', 'c1'))?.questionCount).toBe(4);
    await expect(repo.summary('u1', 'cx')).resolves.toBeNull();
  });

  it('loads the aggregate and filters owned ids', async () => {
    const { prisma, repo } = build();
    prisma.questionCollection.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    expect((await repo.findOwned('u1', 'c1'))?.name).toBe('Revisão');
    await expect(repo.findOwned('u1', 'cx')).resolves.toBeNull();

    await expect(repo.ownedIds('u1', [])).resolves.toEqual([]);
    prisma.questionCollection.findMany.mockResolvedValue([{ id: 'c1' }]);
    await expect(repo.ownedIds('u1', ['c1', 'c9'])).resolves.toEqual(['c1']);
  });

  it('writes collections and memberships', async () => {
    const { prisma, repo } = build();
    const collection = Collection.reconstitute({
      id: 'c1',
      ownerUserId: 'u1',
      name: 'N',
      description: 'D',
      createdAt: at,
    });
    await repo.create(collection);
    expect(prisma.questionCollection.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ id: 'c1', ownerUserId: 'u1', name: 'N', description: 'D' }),
    );
    await repo.save(collection);
    expect(prisma.questionCollection.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'N', description: 'D' },
    });
    await repo.delete('c1');
    expect(prisma.questionCollection.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });

    await expect(repo.addQuestions('c1', [])).resolves.toBe(0);
    await expect(repo.addQuestions('c1', ['q1', 'q2'])).resolves.toBe(2);
    expect(prisma.collectionQuestion.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    await repo.removeQuestion('c1', 'q1');
    expect(prisma.collectionQuestion.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'c1', questionId: 'q1' },
    });
  });
});
