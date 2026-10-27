import { CatalogName } from '@/modules/question-bank/domain/shared/catalog-name.vo';
import { Subject } from '@/modules/question-bank/domain/taxonomy/subject.entity';
import { PrismaTaxonomyRepository } from '@/modules/question-bank/infrastructure/repositories/prisma-taxonomy.repository';

function build() {
  const prisma = {
    knowledgeArea: { findMany: jest.fn(), count: jest.fn() },
    subject: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    topic: { create: jest.fn() },
    question: { groupBy: jest.fn() },
  };
  return { prisma, repo: new PrismaTaxonomyRepository(prisma as never) };
}

const subjectRow = (id: string, name: string, ownerUserId: string | null) => ({
  id,
  knowledgeAreaId: 'a1',
  ownerUserId,
  name,
  topics: [{ id: `${id}-t`, subjectId: id, ownerUserId: null, name: 'Geral' }],
});

describe('PrismaTaxonomyRepository', () => {
  it('builds the tree with active-question counts, scoped to the student', async () => {
    const { prisma, repo } = build();
    prisma.knowledgeArea.findMany.mockResolvedValue([
      {
        id: 'a1',
        name: 'Medicina',
        subjects: [subjectRow('s1', 'Anatomia', null), subjectRow('s2', 'Minha', 'u1')],
      },
    ]);
    prisma.question.groupBy
      .mockResolvedValueOnce([{ subjectId: 's1', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ topicId: 's1-t', _count: { _all: 2 } }]);

    const tree = await repo.treeFor('u1');

    expect(tree[0]?.subjects).toEqual([
      expect.objectContaining({
        id: 's1',
        custom: false,
        questionCount: 3,
        topics: [expect.objectContaining({ questionCount: 2 })],
      }),
      expect.objectContaining({
        id: 's2',
        custom: true,
        questionCount: 0,
        topics: [expect.objectContaining({ questionCount: 0 })],
      }),
    ]);
    const where = prisma.knowledgeArea.findMany.mock.calls[0][0].include.subjects.where;
    expect(where).toEqual({ OR: [{ ownerUserId: null }, { ownerUserId: 'u1' }] });
    expect(prisma.question.groupBy.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
      status: 'active',
    });
  });

  it('checks areas and finds visible subjects', async () => {
    const { prisma, repo } = build();
    prisma.knowledgeArea.count.mockResolvedValue(1);
    await expect(repo.areaExists('a1')).resolves.toBe(true);

    prisma.subject.findFirst
      .mockResolvedValueOnce(subjectRow('s1', 'Anatomia', null))
      .mockResolvedValueOnce(null);
    expect((await repo.findVisibleSubject('u1', 's1'))?.topics).toHaveLength(1);
    await expect(repo.findVisibleSubject('u1', 'x')).resolves.toBeNull();
  });

  it('prefers the catalog entry when matching by name', async () => {
    const { prisma, repo } = build();
    prisma.subject.findMany.mockResolvedValue([
      subjectRow('own', 'anatomia', 'u1'),
      subjectRow('cat', 'Anatomia', null),
      subjectRow('other', 'Cardio', null),
    ]);
    const found = await repo.findVisibleSubjectByName(
      'u1',
      'a1',
      CatalogName.create('ANATOMIA').value,
    );
    expect(found?.id).toBe('cat');

    prisma.subject.findMany.mockResolvedValue([]);
    await expect(
      repo.findVisibleSubjectByName('u1', 'a1', CatalogName.create('x').value),
    ).resolves.toBeNull();
  });

  it('persists subjects and topics', async () => {
    const { prisma, repo } = build();
    const subject = Subject.create('a1', 'u1', CatalogName.create('Pediatria').value);
    await repo.createSubject(subject);
    expect(prisma.subject.create).toHaveBeenCalledWith({
      data: { id: subject.id, knowledgeAreaId: 'a1', ownerUserId: 'u1', name: 'Pediatria' },
    });
    const topic = subject.newTopic('u1', CatalogName.create('Neonatologia').value);
    await repo.addTopic(topic);
    expect(prisma.topic.create).toHaveBeenCalledWith({ data: topic });
  });
});
