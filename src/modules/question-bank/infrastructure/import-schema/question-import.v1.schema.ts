// Published contract for external AIs (specs/question-import.schema.json, v1.0). Kept as code so
// the build ships it without asset copying.
export const QUESTION_IMPORT_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://example.invalid/schemas/question-import-v1.json',
  title: 'Question Import v1',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'questions'],
  properties: {
    schemaVersion: { const: '1.0' },
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'statement',
          'subject',
          'topic',
          'difficulty',
          'options',
          'correctOptionId',
          'explanation',
        ],
        properties: {
          type: { const: 'multiple_choice' },
          statement: { type: 'string', minLength: 10, maxLength: 10000 },
          subject: { type: 'string', minLength: 1, maxLength: 120 },
          topic: { type: 'string', minLength: 1, maxLength: 120 },
          difficulty: { enum: ['easy', 'medium', 'hard'] },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'text'],
              properties: {
                id: { type: 'string', minLength: 1, maxLength: 20 },
                text: { type: 'string', minLength: 1, maxLength: 2000 },
              },
            },
          },
          correctOptionId: { type: 'string', minLength: 1, maxLength: 20 },
          explanation: { type: 'string', minLength: 1, maxLength: 10000 },
          sourceReference: { type: 'string', maxLength: 500 },
        },
      },
    },
  },
} as const;
