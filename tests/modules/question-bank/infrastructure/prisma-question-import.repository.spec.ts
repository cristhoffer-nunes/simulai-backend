import { Prisma } from '@prisma/client';
import { Collection } from '@/modules/question-bank/domain/collections/collection.entity';
import { QuestionImport } from '@/modules/question-bank/domain/imports/question-import.entity';
import { CatalogName } from '@/modules/question-bank/domain/shared/catalog-name.vo';
import { Subject } from '@/modules/question-bank/domain/taxonomy/subject.entity';
import { buildQuestion } from '../helpers';
import { PrismaQuestionImportRepository } from '@/modules/question-bank/infrastructure/repositories/prisma-question-import.repository';

const at = new Date('2026-10-27T10:00:00Z');
const row = {
  id: 'i1',
  ownerUserId: 'u1',
  schemaVersion: '1.0',
  status: 'validated',
  totalCount: 3,
  rejectedCount: 1,
  duplicateCount: 0,
  importedCount: 0,
  idempotencyKey: null,
  preview: [{ index: 0, item: {}, duplicateOfBank: false, duplicateOfIndex: null }],
  expiresAt: at,
  createdAt: at,
  committedAt: null,
};

function build(claimed = 1) {
  const tx = {
    questionImport: { updateMany: jest.fn().mockResolvedValue({ count: claimed }) },
    subject: { createMany: jest.fn() },
    topic: { createMany: jest.fn() },
    question: { createMany: jest.fn() },
    questionOption: { createMany: jest.fn() },
    collectionQuestion: { createMany: jest.fn() },
  };
  const prisma = {
    questionImport: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, repo: new PrismaQuestionImportRepository(prisma as never) };
}

function plan(collection = true) {
  const questionImport = QuestionImport.validated('u1', '1.0', 2, []);
  questionImport.markCommitted('key-123456', 1, 0);
  const subject = Subject.create('a1', 'u1', CatalogName.create('Pediatria').value);
  const topic = subject.newTopic('u1', CatalogName.create('Neonatologia').value);
  return {
    questionImport,
    newSubjects: [subject],
    newTopics: [topic],
    questions: [buildQuestion({ sourceImportId: questionImport.id, sourceReference: 'Cap. 1' })],
    collection: collection
      ? Collection.reconstitute({
          id: 'c1',
          ownerUserId: 'u1',
          name: 'C',
          description: null,
          createdAt: at,
        })
      : null,
  };
}

describe('PrismaQuestionImportRepository', () => {
  it('stores the preview and reads it back only for the owner', async () => {
    const { prisma, repo } = build();
    const questionImport = QuestionImport.validated('u1', '1.0', 1, [], at);
    await repo.create(questionImport);
    expect(prisma.questionImport.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        id: questionImport.id,
        status: 'validated',
        preview: [],
        expiresAt: questionImport.expiresAt,
      }),
    );

    prisma.questionImport.findFirst
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, preview: null })
      .mockResolvedValueOnce(null);
    expect((await repo.findOwned('u1', 'i1'))?.preview).toHaveLength(1);
    expect((await repo.findOwned('u1', 'i1'))?.preview).toEqual([]);
    await expect(repo.findOwned('u1', 'x')).resolves.toBeNull();
    expect(prisma.questionImport.findFirst.mock.calls[0][0].where).toEqual({
      id: 'i1',
      ownerUserId: 'u1',
    });
  });

  it('discards only while validated', async () => {
    const { prisma, repo } = build();
    await repo.saveDiscarded(QuestionImport.validated('u1', '1.0', 1, [], at));
    expect(prisma.questionImport.updateMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ status: 'validated' }),
    );
  });

  it('finds by idempotency key', async () => {
    const { prisma, repo } = build();
    prisma.questionImport.findFirst
      .mockResolvedValueOnce({ ...row, status: 'committed', idempotencyKey: 'k' })
      .mockResolvedValueOnce(null);
    expect((await repo.findByIdempotencyKey('u1', 'k'))?.status).toBe('committed');
    await expect(repo.findByIdempotencyKey('u1', 'k')).resolves.toBeNull();
    expect(prisma.questionImport.findFirst.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
      idempotencyKey: 'k',
    });
  });

  it('commits everything in one transaction after claiming the preview', async () => {
    const { tx, repo } = build();
    const p = plan();
    await expect(repo.commit(p)).resolves.toBe(true);
    expect(tx.questionImport.updateMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ id: p.questionImport.id, status: 'validated' }),
    );
    expect(tx.subject.createMany.mock.calls[0][0].data[0]).toEqual(
      expect.objectContaining({ name: 'Pediatria', ownerUserId: 'u1' }),
    );
    expect(tx.topic.createMany.mock.calls[0][0].data[0]).toEqual(
      expect.objectContaining({ name: 'Neonatologia' }),
    );
    const data = tx.question.createMany.mock.calls[0][0].data;
    expect(data[0]).toEqual(
      expect.objectContaining({ sourceImportId: p.questionImport.id, sourceReference: 'Cap. 1' }),
    );
    expect(tx.questionOption.createMany.mock.calls[0][0].data).toEqual([
      { questionId: 'q1', optionKey: 'A', text: 'Mitral', isCorrect: false },
      { questionId: 'q1', optionKey: 'B', text: 'Tricúspide', isCorrect: true },
    ]);
    expect(tx.collectionQuestion.createMany).toHaveBeenCalledWith({
      data: [{ collectionId: 'c1', questionId: 'q1' }],
    });
  });

  it('writes nothing when the preview was already taken, and skips empty creations', async () => {
    const taken = build(0);
    await expect(taken.repo.commit(plan())).resolves.toBe(false);
    expect(taken.tx.question.createMany).not.toHaveBeenCalled();

    const { tx, repo } = build();
    await repo.commit({ ...plan(false), newSubjects: [], newTopics: [] });
    expect(tx.subject.createMany).not.toHaveBeenCalled();
    expect(tx.topic.createMany).not.toHaveBeenCalled();
    expect(tx.collectionQuestion.createMany).not.toHaveBeenCalled();
  });

  it('treats a unique violation on the key as a lost race and rethrows other errors', async () => {
    const { prisma, repo } = build();
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5' }),
    );
    await expect(repo.commit(plan())).resolves.toBe(false);
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(repo.commit(plan())).rejects.toThrow('db down');
  });
});
