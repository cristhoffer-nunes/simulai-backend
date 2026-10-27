import {
  AjvImportSchemaAdapter,
  toPath,
} from '@/modules/question-bank/infrastructure/import-schema/ajv-import-schema.adapter';
import { goodItem } from '../import-fixtures';

describe('AjvImportSchemaAdapter', () => {
  const schema = new AjvImportSchemaAdapter();

  it('accepts the example from the spec', () => {
    expect(schema.checkItem(goodItem())).toEqual([]);
    expect(schema.checkItem(goodItem({ sourceReference: 'Cap. 2' }))).toEqual([]);
  });

  it('maps JSON Schema errors to field paths and codes', () => {
    const errors = schema.checkItem({
      ...goodItem({ statement: 'curta', difficulty: 'facil', type: 'essay', extra: 1 }),
      options: [{ id: 'A', text: '' }],
      correctOptionId: undefined,
      explanation: 'x'.repeat(10_001),
      topic: '',
      subject: 42,
    });
    const codes = errors.map((error) => `${error.path}:${error.code}`).sort();
    expect(codes).toEqual(
      [
        'correctOptionId:REQUIRED',
        'extra:UNKNOWN_FIELD',
        'type:INVALID_VALUE',
        'statement:TOO_SHORT',
        'subject:INVALID_TYPE',
        'topic:REQUIRED',
        'difficulty:INVALID_VALUE',
        'options:OPTIONS_COUNT',
        'options[0].text:REQUIRED',
        'explanation:TOO_LONG',
      ].sort(),
    );
  });

  it('handles non-objects and odd keywords', () => {
    expect(schema.checkItem('texto')[0]).toEqual(
      expect.objectContaining({ path: '', code: 'INVALID_TYPE' }),
    );
    expect(toPath('/options/10/text')).toBe('options[10].text');
    expect(toPath('', 'statement')).toBe('statement');
    const tooMany = schema.checkItem(
      goodItem({ options: Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, text: `t${i}` })) }),
    );
    expect(tooMany).toEqual([expect.objectContaining({ path: 'options', code: 'OPTIONS_COUNT' })]);
  });
});
