import {
  contentHashOf,
  isDifficulty,
  normalizeText,
  validateQuestionContent,
} from '@/modules/question-bank/domain/questions/question-content';
import { Question } from '@/modules/question-bank/domain/questions/question.entity';
import { content, optionsInput } from '../helpers';

const valid = {
  statement: '  Qual valva?  ',
  explanation: 'Tricúspide.',
  difficulty: 'medium',
  options: optionsInput,
};

describe('validateQuestionContent', () => {
  it('normalizes and assigns keys A–F in order', () => {
    const result = validateQuestionContent(valid);
    expect(result.value).toEqual({
      statement: 'Qual valva?',
      explanation: 'Tricúspide.',
      difficulty: 'medium',
      options: [
        { key: 'A', text: 'Mitral', isCorrect: false },
        { key: 'B', text: 'Tricúspide', isCorrect: true },
      ],
    });
  });

  it('reports every problem with its field path', () => {
    const result = validateQuestionContent({
      statement: ' ',
      explanation: '',
      difficulty: 'impossible',
      options: [
        { text: 'Igual', isCorrect: true },
        { text: ' igual ', isCorrect: true },
        { text: '', isCorrect: false },
      ],
    });
    const codes = result.error.map((error) => `${error.path}:${error.code}`);
    expect(codes).toEqual([
      'statement:REQUIRED',
      'explanation:REQUIRED',
      'difficulty:INVALID_DIFFICULTY',
      'options[1].text:DUPLICATE_OPTION',
      'options[2].text:REQUIRED',
      'options:CORRECT_OPTION_COUNT',
    ]);
  });

  it('enforces 2–6 options, one correct, and length limits', () => {
    const one = validateQuestionContent({ ...valid, options: [{ text: 'A', isCorrect: true }] });
    expect(one.error.map((error) => error.code)).toContain('OPTIONS_COUNT');

    const seven = validateQuestionContent({
      ...valid,
      options: Array.from({ length: 7 }, (_, index) => ({
        text: `op ${index}`,
        isCorrect: index === 0,
      })),
    });
    expect(seven.error.map((error) => error.code)).toEqual(['OPTIONS_COUNT']);

    const none = validateQuestionContent({
      ...valid,
      options: optionsInput.map((o) => ({ ...o, isCorrect: false })),
    });
    expect(none.error.map((error) => error.code)).toEqual(['CORRECT_OPTION_COUNT']);

    const long = validateQuestionContent({ ...valid, statement: 'x'.repeat(10_001) });
    expect(long.error[0]).toEqual(expect.objectContaining({ path: 'statement', code: 'TOO_LONG' }));

    const missing = validateQuestionContent({ ...valid, options: undefined as never });
    expect(missing.error.map((error) => error.code)).toEqual(['OPTIONS_COUNT']);

    const garbage = validateQuestionContent({
      ...valid,
      statement: 42 as never,
      options: [null as never, { text: 'b', isCorrect: true }],
    });
    expect(garbage.error.map((error) => error.path)).toEqual(['statement', 'options[0].text']);
  });

  it('knows the difficulties', () => {
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('all')).toBe(false);
  });
});

describe('contentHashOf', () => {
  it('ignores case, accents and spacing but not the correct answer', () => {
    const base = content();
    const same = content({
      statement: 'QUAL valva   separa o atrio direito do ventriculo direito?',
      options: [
        { key: 'A', text: 'mitral', isCorrect: false },
        { key: 'B', text: 'TRICUSPIDE', isCorrect: true },
      ],
    });
    const otherAnswer = content({
      options: [
        { key: 'A', text: 'Mitral', isCorrect: true },
        { key: 'B', text: 'Tricúspide', isCorrect: false },
      ],
    });
    expect(contentHashOf(same)).toBe(contentHashOf(base));
    expect(contentHashOf(otherAnswer)).not.toBe(contentHashOf(base));
    expect(normalizeText('  Ação\nRápida ')).toBe('acao rapida');
    expect(contentHashOf({ statement: 'x', options: [] })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Question', () => {
  it('is created active with its content hash', () => {
    const question = Question.create('u1', { subjectId: 's1', topicId: null }, content());
    expect(question.status).toBe('active');
    expect(question.contentHash).toBe(contentHashOf(content()));
    expect(question.sourceImportId).toBeNull();
    expect(question.ownerUserId).toBe('u1');
    expect(question.createdAt).toEqual(question.updatedAt);
  });

  it('changes content, classification and status', () => {
    const question = Question.create('u1', { subjectId: 's1', topicId: null }, content(), {
      sourceImportId: 'imp-1',
      sourceReference: ' Netter, p. 3 ',
    });
    const before = question.contentHash;
    question.changeContent(content({ statement: 'Outra pergunta?' }));
    expect(question.contentHash).not.toBe(before);
    question.reclassify({ subjectId: 's2', topicId: 't9' });
    expect([question.subjectId, question.topicId]).toEqual(['s2', 't9']);
    question.archive();
    question.archive();
    expect(question.status).toBe('archived');
    question.restore();
    question.restore();
    expect(question.status).toBe('active');
    expect(question.sourceImportId).toBe('imp-1');
    expect(question.sourceReference).toBe(' Netter, p. 3 ');
    question.changeSourceReference('  ');
    question.changeSourceReference(null);
    expect(question.sourceReference).toBeNull();
  });
});
