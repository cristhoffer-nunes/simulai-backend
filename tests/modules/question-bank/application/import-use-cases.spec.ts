import { DiscardImportUseCase } from '@/modules/question-bank/application/use-cases/discard-import.use-case';
import { ValidateImportUseCase } from '@/modules/question-bank/application/use-cases/validate-import.use-case';
import { contentHashOf } from '@/modules/question-bank/domain/questions/question-content';
import {
  normalizeImportItem,
  RawImportItem,
} from '@/modules/question-bank/domain/imports/import-item';
import { QuestionImport } from '@/modules/question-bank/domain/imports/question-import.entity';
import { IQuestionImportRepository } from '@/modules/question-bank/domain/imports/question-import.repository';
import { AjvImportSchemaAdapter } from '@/modules/question-bank/infrastructure/import-schema/ajv-import-schema.adapter';
import { fakeQuestions, fakeTaxonomy } from '../helpers';
import { goodItem } from '../import-fixtures';

function fakeImports(overrides: Partial<jest.Mocked<IQuestionImportRepository>> = {}) {
  return {
    create: jest.fn(),
    findOwned: jest.fn().mockResolvedValue(null),
    saveDiscarded: jest.fn(),
    ...overrides,
  } as jest.Mocked<IQuestionImportRepository>;
}

const allowed = () => ({
  consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  reset: jest.fn(),
});

function build(options: { bankHashes?: string[]; limited?: boolean } = {}) {
  const imports = fakeImports();
  const questions = fakeQuestions({
    existingHashes: jest.fn().mockResolvedValue(new Set(options.bankHashes ?? [])),
  });
  const taxonomy = fakeTaxonomy({
    treeFor: jest.fn().mockResolvedValue([
      {
        id: 'a1',
        name: 'Medicina',
        subjects: [
          {
            id: 's1',
            name: 'Anatomia',
            custom: false,
            questionCount: 0,
            topics: [{ id: 't1', name: 'Sistema cardiovascular', custom: false, questionCount: 0 }],
          },
        ],
      },
    ]),
  });
  const limiter = options.limited
    ? {
        consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 90 }),
        reset: jest.fn(),
      }
    : allowed();
  const useCase = new ValidateImportUseCase(
    new AjvImportSchemaAdapter(),
    imports,
    questions,
    taxonomy,
    limiter,
  );
  return { useCase, imports, questions, limiter };
}

describe('ValidateImportUseCase', () => {
  it('splits valid and invalid items, flags duplicates and new taxonomy, and stores the preview', async () => {
    const existing = normalizeImportItem(
      goodItem({ statement: 'Questão que já está no banco do aluno?' }) as unknown as RawImportItem,
    ).value;
    const { useCase, imports, limiter } = build({ bankHashes: [existing.contentHash] });

    const result = await useCase.execute('u1', {
      schemaVersion: '1.0',
      questions: [
        goodItem(),
        goodItem({ statement: 'Questão que já está no banco do aluno?' }),
        goodItem({ correctOptionId: 'Z', subject: 'Cardiologia' }),
        goodItem(),
        goodItem({
          subject: 'Pediatria',
          topic: 'Neonatologia',
          statement: 'Qual a conduta na icterícia precoce?',
        }),
        'não é objeto',
      ],
    });

    expect(limiter.consume).toHaveBeenCalledWith('import:u1', 30, 600);
    const value = result.value;
    expect(value.totalCount).toBe(6);
    expect(
      value.validItems.map((item) => [
        item.index,
        item.duplicateOf,
        item.newSubject,
        item.newTopic,
      ]),
    ).toEqual([
      [0, null, false, false],
      [1, 'bank', false, false],
      [3, 'batch', false, false],
      [4, null, true, true],
    ]);
    expect(
      value.invalidItems.map((item) => [item.index, item.subject, item.errors[0]?.code]),
    ).toEqual([
      [2, 'Cardiologia', 'UNKNOWN_OPTION_ID'],
      [5, null, 'INVALID_TYPE'],
    ]);
    const stored = imports.create.mock.calls[0]![0];
    expect(stored.id).toBe(value.previewId);
    expect(stored.preview).toHaveLength(4);
    expect(value.validItems[0]?.normalizedQuestion.options[1]).toEqual({
      key: 'B',
      text: 'Átrio esquerdo',
      isCorrect: true,
    });
    expect(contentHashOf(value.validItems[0]!.normalizedQuestion)).toBe(
      stored.preview[0]!.item.contentHash,
    );
  });

  it('rejects malformed roots before looking at items', async () => {
    const { useCase, imports } = build();
    const cases: [unknown, string, string][] = [
      [[], 'VALIDATION_ERROR', 'INVALID_TYPE'],
      [null, 'VALIDATION_ERROR', 'INVALID_TYPE'],
      [{ questions: [] }, 'VALIDATION_ERROR', 'REQUIRED'],
      [
        { schemaVersion: '2.0', questions: [goodItem()] },
        'UNSUPPORTED_SCHEMA',
        'UNSUPPORTED_SCHEMA',
      ],
      [{ schemaVersion: '1.0', questions: 'x' }, 'VALIDATION_ERROR', 'INVALID_TYPE'],
      [{ schemaVersion: '1.0', questions: [] }, 'VALIDATION_ERROR', 'QUESTIONS_COUNT'],
      [
        { schemaVersion: '1.0', questions: Array(101).fill(goodItem()) },
        'VALIDATION_ERROR',
        'QUESTIONS_COUNT',
      ],
      [
        { schemaVersion: '1.0', questions: [goodItem()], extra: true },
        'VALIDATION_ERROR',
        'UNKNOWN_FIELD',
      ],
    ];
    for (const [body, kind, code] of cases) {
      const result = await useCase.execute('u1', body);
      expect([result.error.kind, (result.error.details as { code: string }[])[0]?.code]).toEqual([
        kind,
        code,
      ]);
    }
    expect(imports.create).not.toHaveBeenCalled();
  });

  it('is rate limited per student', async () => {
    const result = await build({ limited: true }).useCase.execute('u1', {
      schemaVersion: '1.0',
      questions: [goodItem()],
    });
    expect(result.error.kind).toBe('RATE_LIMITED');
  });
});

describe('DiscardImportUseCase', () => {
  const open = () => QuestionImport.validated('u1', '1.0', 1, []);

  it('discards an open preview and is idempotent', async () => {
    const imports = fakeImports({ findOwned: jest.fn().mockResolvedValue(open()) });
    expect((await new DiscardImportUseCase(imports).execute('u1', 'i1')).isSuccess).toBe(true);
    expect(imports.saveDiscarded).toHaveBeenCalled();

    const discarded = open();
    discarded.discard();
    const again = fakeImports({ findOwned: jest.fn().mockResolvedValue(discarded) });
    expect((await new DiscardImportUseCase(again).execute('u1', 'i1')).isSuccess).toBe(true);
    expect(again.saveDiscarded).not.toHaveBeenCalled();
  });

  it('404 for others, 409 once committed', async () => {
    expect((await new DiscardImportUseCase(fakeImports()).execute('u1', 'x')).error.kind).toBe(
      'NOT_FOUND',
    );
    const committed = open();
    committed.markCommitted('k', 1, 0);
    const imports = fakeImports({ findOwned: jest.fn().mockResolvedValue(committed) });
    expect((await new DiscardImportUseCase(imports).execute('u1', 'i1')).error.kind).toBe(
      'CONFLICT',
    );
  });
});
