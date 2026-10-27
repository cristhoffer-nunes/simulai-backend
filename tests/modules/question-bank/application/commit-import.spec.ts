import { CommitImportUseCase } from '@/modules/question-bank/application/use-cases/commit-import.use-case';
import { GetImportUseCase } from '@/modules/question-bank/application/use-cases/get-import.use-case';
import { Collection } from '@/modules/question-bank/domain/collections/collection.entity';
import {
  normalizeImportItem,
  RawImportItem,
} from '@/modules/question-bank/domain/imports/import-item';
import {
  PreviewItem,
  QuestionImport,
} from '@/modules/question-bank/domain/imports/question-import.entity';
import { IQuestionImportRepository } from '@/modules/question-bank/domain/imports/question-import.repository';
import { Subject } from '@/modules/question-bank/domain/taxonomy/subject.entity';
import { fakeCollections, fakeTaxonomy } from '../helpers';
import { goodItem } from '../import-fixtures';

const item = (overrides: Record<string, unknown> = {}) =>
  normalizeImportItem(goodItem(overrides) as unknown as RawImportItem).value;

function openImport() {
  const preview: PreviewItem[] = [
    { index: 0, item: item(), duplicateOfBank: false, duplicateOfIndex: null },
    {
      index: 1,
      item: item({ statement: 'Já existe no banco do aluno?' }),
      duplicateOfBank: true,
      duplicateOfIndex: null,
    },
    {
      index: 3,
      item: item({
        subject: 'Pediatria',
        topic: 'Neonatologia',
        statement: 'Conduta na icterícia precoce?',
      }),
      duplicateOfBank: false,
      duplicateOfIndex: null,
    },
    {
      index: 4,
      item: item({
        subject: 'pediatria',
        topic: 'NEONATOLOGIA',
        statement: 'Outra de neonatologia aqui?',
      }),
      duplicateOfBank: false,
      duplicateOfIndex: null,
    },
  ];
  return QuestionImport.validated('u1', '1.0', 6, preview);
}

const anatomy = () =>
  Subject.reconstitute({
    id: 's1',
    knowledgeAreaId: 'a1',
    ownerUserId: null,
    name: 'Anatomia',
    topics: [{ id: 't1', subjectId: 's1', ownerUserId: null, name: 'Sistema cardiovascular' }],
  });

function build(
  questionImport: QuestionImport | null = openImport(),
  overrides: Partial<jest.Mocked<IQuestionImportRepository>> = {},
) {
  const imports = {
    create: jest.fn(),
    findOwned: jest.fn().mockResolvedValue(questionImport),
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    saveDiscarded: jest.fn(),
    commit: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as jest.Mocked<IQuestionImportRepository>;
  const taxonomy = fakeTaxonomy({
    treeFor: jest.fn().mockResolvedValue([
      {
        id: 'a1',
        name: 'Medicina',
        subjects: [
          { id: 's-own', name: 'anatomia', custom: true, questionCount: 0, topics: [] },
          { id: 's1', name: 'Anatomia', custom: false, questionCount: 0, topics: [] },
        ],
      },
    ]),
    findVisibleSubject: jest.fn(async (_u: string, id: string) => (id === 's1' ? anatomy() : null)),
  });
  const collection = Collection.reconstitute({
    id: 'c1',
    ownerUserId: 'u1',
    name: 'C',
    description: null,
    createdAt: new Date(),
  });
  const collections = fakeCollections({
    findOwned: jest.fn(async (_u: string, id: string) => (id === 'c1' ? collection : null)),
  });
  return { imports, useCase: new CommitImportUseCase(imports, taxonomy, collections), collection };
}

const input = (overrides = {}) => ({
  userId: 'u1',
  previewId: 'p1',
  selectedIndexes: [0, 3, 4],
  idempotencyKey: 'key-123456',
  ...overrides,
});

describe('CommitImportUseCase', () => {
  it('imports the selected items with taxonomy resolved or created, in one plan', async () => {
    const { imports, useCase, collection } = build();
    const result = await useCase.execute(input({ collectionId: 'c1' }));

    expect(result.value).toEqual(
      expect.objectContaining({
        status: 'committed',
        importedCount: 3,
        skippedDuplicateCount: 1,
        rejectedCount: 2,
        totalCount: 6,
      }),
    );
    const plan = imports.commit.mock.calls[0]![0];
    expect(plan.collection).toBe(collection);
    expect(plan.newSubjects.map((subject) => subject.name)).toEqual(['Pediatria']);
    expect(plan.newTopics.map((topic) => topic.name)).toEqual(['Neonatologia']);
    const [first, second, third] = plan.questions;
    expect([first!.subjectId, first!.topicId]).toEqual(['s1', 't1']);
    expect(second!.subjectId).toBe(plan.newSubjects[0]!.id);
    expect(third!.topicId).toBe(second!.topicId);
    expect(first!.sourceImportId).toBe(plan.questionImport.id);
  });

  it('imports a duplicate when the student selected it', async () => {
    const { imports, useCase } = build();
    const result = await useCase.execute(input({ selectedIndexes: [1] }));
    expect(result.value).toEqual(
      expect.objectContaining({ importedCount: 1, skippedDuplicateCount: 0 }),
    );
    expect(imports.commit.mock.calls[0]![0].questions).toHaveLength(1);
  });

  it('returns the earlier result for a repeated idempotency key', async () => {
    const done = openImport();
    done.markCommitted('key-123456', 3, 1);
    const { imports, useCase } = build(done, {
      findByIdempotencyKey: jest.fn().mockResolvedValue(done),
    });
    const result = await useCase.execute(input({ previewId: done.id }));
    expect(result.value.importId).toBe(done.id);
    expect(imports.commit).not.toHaveBeenCalled();

    const reused = await useCase.execute(input({ previewId: 'another' }));
    expect(reused.error.kind).toBe('CONFLICT');
  });

  it('refuses missing, committed, discarded and expired previews', async () => {
    expect((await build(null).useCase.execute(input())).error.kind).toBe('NOT_FOUND');

    const committed = openImport();
    committed.markCommitted('other-key-1', 1, 0);
    expect((await build(committed).useCase.execute(input())).error.kind).toBe('CONFLICT');

    const discarded = openImport();
    discarded.discard();
    expect((await build(discarded).useCase.execute(input())).error.kind).toBe(
      'IMPORT_PREVIEW_EXPIRED',
    );

    const expired = QuestionImport.validated(
      'u1',
      '1.0',
      1,
      [],
      new Date(Date.now() - 2 * 3600_000),
    );
    expect((await build(expired).useCase.execute(input())).error.kind).toBe(
      'IMPORT_PREVIEW_EXPIRED',
    );
  });

  it('validates the selection and the collection', async () => {
    const { useCase } = build();
    expect((await useCase.execute(input({ selectedIndexes: [2] }))).error.details).toEqual([
      expect.objectContaining({ path: 'selectedIndexes', code: 'INVALID_SELECTION' }),
    ]);
    expect((await useCase.execute(input({ selectedIndexes: [] }))).error.kind).toBe(
      'VALIDATION_ERROR',
    );
    expect((await useCase.execute(input({ collectionId: 'not-mine' }))).error.details).toEqual([
      expect.objectContaining({ path: 'collectionId', code: 'UNKNOWN_COLLECTION' }),
    ]);
  });

  it('when a concurrent request wins, answers with its result or as expired', async () => {
    const winner = openImport();
    winner.markCommitted('key-123456', 3, 1);
    const { useCase } = build(openImport(), {
      commit: jest.fn().mockResolvedValue(false),
      findByIdempotencyKey: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner),
    });
    expect((await useCase.execute(input({ previewId: winner.id }))).value.importId).toBe(winner.id);

    const lost = build(openImport(), { commit: jest.fn().mockResolvedValue(false) });
    expect((await lost.useCase.execute(input())).error.kind).toBe('IMPORT_PREVIEW_EXPIRED');
  });

  it('fails clearly when no knowledge area exists for a new subject', async () => {
    const { imports } = build();
    const taxonomy = fakeTaxonomy({ treeFor: jest.fn().mockResolvedValue([]) });
    const useCase = new CommitImportUseCase(imports, taxonomy, fakeCollections());
    expect((await useCase.execute(input())).error.kind).toBe('NOT_FOUND');
  });
});

describe('GetImportUseCase', () => {
  it('returns own imports only', async () => {
    const questionImport = openImport();
    const { imports } = build(questionImport);
    expect((await new GetImportUseCase(imports).execute('u1', questionImport.id)).value).toEqual(
      expect.objectContaining({
        importId: questionImport.id,
        status: 'validated',
        skippedDuplicateCount: 0,
      }),
    );
    imports.findOwned.mockResolvedValue(null);
    expect((await new GetImportUseCase(imports).execute('u1', 'x')).error.kind).toBe('NOT_FOUND');
  });
});
