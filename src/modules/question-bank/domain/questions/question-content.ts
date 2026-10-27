import { createHash } from 'node:crypto';
import { Result } from '../../../../shared/result/result';
import { FieldError } from '../shared/field-error';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = OPTION_KEYS.length;
const MAX_STATEMENT = 10_000;
const MAX_EXPLANATION = 10_000;
const MAX_OPTION_TEXT = 2_000;

export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuestionContentInput {
  statement: string;
  explanation: string;
  difficulty: string;
  options: QuestionOptionInput[];
}

export interface QuestionOption {
  key: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionContent {
  statement: string;
  explanation: string;
  difficulty: Difficulty;
  options: QuestionOption[];
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

/** Lowercase, no accents, single spaces: what "the same text" means for duplicates. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tidy(text: unknown): string {
  return typeof text === 'string' ? text.normalize('NFC').trim() : '';
}

function required(path: string, value: string, max: number, label: string): FieldError | null {
  if (value.length === 0) return { path, code: 'REQUIRED', message: `${label} is required.` };
  if (value.length > max) {
    return { path, code: 'TOO_LONG', message: `${label} must have at most ${max} characters.` };
  }
  return null;
}

/**
 * Validates and normalizes a multiple-choice question (RN-005): statement and explanation filled,
 * 2–6 options with distinct texts and exactly one correct. Keys A–F follow the given order.
 */
export function validateQuestionContent(
  input: QuestionContentInput,
): Result<QuestionContent, FieldError[]> {
  const errors: FieldError[] = [];
  const statement = tidy(input.statement);
  const explanation = tidy(input.explanation);

  const statementError = required('statement', statement, MAX_STATEMENT, 'Statement');
  if (statementError) errors.push(statementError);
  const explanationError = required('explanation', explanation, MAX_EXPLANATION, 'Explanation');
  if (explanationError) errors.push(explanationError);

  if (!isDifficulty(input.difficulty)) {
    errors.push({
      path: 'difficulty',
      code: 'INVALID_DIFFICULTY',
      message: `Difficulty must be one of ${DIFFICULTIES.join(', ')}.`,
    });
  }

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  if (rawOptions.length < MIN_OPTIONS || rawOptions.length > MAX_OPTIONS) {
    errors.push({
      path: 'options',
      code: 'OPTIONS_COUNT',
      message: `A question needs between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.`,
    });
  }

  const seen = new Map<string, number>();
  const options: QuestionOption[] = rawOptions.slice(0, MAX_OPTIONS).map((option, index) => {
    const text = tidy(option?.text);
    const error = required(`options[${index}].text`, text, MAX_OPTION_TEXT, 'Option text');
    if (error) errors.push(error);
    const key = normalizeText(text);
    if (text && seen.has(key)) {
      errors.push({
        path: `options[${index}].text`,
        code: 'DUPLICATE_OPTION',
        message: `Option ${OPTION_KEYS[index]} repeats option ${OPTION_KEYS[seen.get(key)!]}.`,
      });
    } else if (text) {
      seen.set(key, index);
    }
    return { key: OPTION_KEYS[index]!, text, isCorrect: option?.isCorrect === true };
  });

  const correct = options.filter((option) => option.isCorrect).length;
  if (rawOptions.length > 0 && correct !== 1) {
    errors.push({
      path: 'options',
      code: 'CORRECT_OPTION_COUNT',
      message: 'Exactly one option must be marked as correct.',
    });
  }

  if (errors.length > 0) return Result.fail(errors);
  return Result.ok({ statement, explanation, difficulty: input.difficulty as Difficulty, options });
}

/**
 * Hash of the normalized content, per student (RN-009): same statement, same options in the same
 * order and same correct key → same hash. Not a semantic duplicate detector.
 */
export function contentHashOf(content: Pick<QuestionContent, 'statement' | 'options'>): string {
  const parts = [
    normalizeText(content.statement),
    ...content.options.map((option) => `${option.key}:${normalizeText(option.text)}`),
    `correct:${content.options.find((option) => option.isCorrect)?.key ?? ''}`,
  ];
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}
