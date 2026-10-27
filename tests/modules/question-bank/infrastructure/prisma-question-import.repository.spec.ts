import { QuestionImport } from '@/modules/question-bank/domain/imports/question-import.entity';
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

function build() {
  const prisma = {
    questionImport: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  };
  return { prisma, repo: new PrismaQuestionImportRepository(prisma as never) };
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
});
