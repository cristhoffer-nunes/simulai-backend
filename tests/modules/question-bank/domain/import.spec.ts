import {
  normalizeImportItem,
  RawImportItem,
} from '@/modules/question-bank/domain/imports/import-item';
import {
  PREVIEW_TTL_MS,
  QuestionImport,
} from '@/modules/question-bank/domain/imports/question-import.entity';
import { goodItem } from '../import-fixtures';

const normalize = (overrides: Record<string, unknown> = {}) =>
  normalizeImportItem(goodItem(overrides) as unknown as RawImportItem);

describe('normalizeImportItem', () => {
  it('re-keys options A–F in order and marks the correct one', () => {
    const result = normalize({
      options: [
        { id: 'x1', text: 'Átrio direito' },
        { id: 'x2', text: 'Átrio esquerdo' },
      ],
      correctOptionId: 'x2',
      sourceReference: '  Netter, p. 3 ',
    });
    expect(result.value.content.options).toEqual([
      { key: 'A', text: 'Átrio direito', isCorrect: false },
      { key: 'B', text: 'Átrio esquerdo', isCorrect: true },
    ]);
    expect(result.value.sourceReference).toBe('Netter, p. 3');
    expect(result.value.subjectName).toBe('Anatomia');
    expect(result.value.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(normalize({ sourceReference: '  ' }).value.sourceReference).toBeNull();
  });

  it('rejects unknown correct ids and repeated or blank option ids', () => {
    const result = normalize({
      options: [
        { id: 'A', text: 'um' },
        { id: 'A', text: 'dois' },
        { id: ' ', text: 'três' },
      ],
      correctOptionId: 'Z',
    });
    expect(result.error.map((error) => `${error.path}:${error.code}`)).toEqual([
      'options[1].id:DUPLICATE_OPTION_ID',
      'options[2].id:REQUIRED',
      'correctOptionId:UNKNOWN_OPTION_ID',
    ]);
  });

  it('refuses executable HTML and reuses the question rules', () => {
    const result = normalize({
      statement: 'Veja <script>alert(1)</script> isso',
      explanation: '<img src=x onerror=alert(1)>',
      options: [
        { id: 'A', text: 'javascript:void(0)' },
        { id: 'B', text: 'mesmo' },
        { id: 'C', text: 'MESMO' },
      ],
      correctOptionId: 'B',
      difficulty: 'impossible',
      subject: '   ',
      topic: 'x'.repeat(121),
    });
    expect(result.error.map((error) => `${error.path}:${error.code}`)).toEqual([
      'statement:UNSAFE_CONTENT',
      'explanation:UNSAFE_CONTENT',
      'options[0].text:UNSAFE_CONTENT',
      'difficulty:INVALID_DIFFICULTY',
      'options[2].text:DUPLICATE_OPTION',
      'subject:INVALID_NAME',
      'topic:INVALID_NAME',
    ]);
  });
});

describe('QuestionImport', () => {
  const now = new Date('2026-10-27T10:00:00Z');
  const preview = [
    { index: 0, item: {} as never, duplicateOfBank: false, duplicateOfIndex: null },
    { index: 2, item: {} as never, duplicateOfBank: true, duplicateOfIndex: null },
    { index: 3, item: {} as never, duplicateOfBank: false, duplicateOfIndex: 0 },
  ];

  it('opens a preview for one hour with its counts', () => {
    const questionImport = QuestionImport.validated('u1', '1.0', 5, preview, now);
    expect(questionImport.status).toBe('validated');
    expect(questionImport.rejectedCount).toBe(2);
    expect(questionImport.duplicateCount).toBe(2);
    expect(questionImport.expiresAt!.getTime() - now.getTime()).toBe(PREVIEW_TTL_MS);
    expect(questionImport.isOpen(now)).toBe(true);
    expect(questionImport.isOpen(new Date(now.getTime() + PREVIEW_TTL_MS))).toBe(false);
    expect([
      questionImport.ownerUserId,
      questionImport.schemaVersion,
      questionImport.totalCount,
    ]).toEqual(['u1', '1.0', 5]);
  });

  it('commits or discards, dropping the preview', () => {
    const committed = QuestionImport.validated('u1', '1.0', 5, preview, now);
    committed.markCommitted('key-1', 2, 1, now);
    expect([
      committed.status,
      committed.importedCount,
      committed.duplicateCount,
      committed.idempotencyKey,
    ]).toEqual(['committed', 2, 1, 'key-1']);
    expect(committed.preview).toEqual([]);
    expect(committed.committedAt).toEqual(now);
    expect(committed.isOpen(now)).toBe(false);

    const discarded = QuestionImport.validated('u1', '1.0', 1, [], now);
    discarded.discard();
    expect([discarded.status, discarded.expiresAt]).toEqual(['discarded', null]);
    expect(discarded.createdAt).toEqual(now);
  });
});
