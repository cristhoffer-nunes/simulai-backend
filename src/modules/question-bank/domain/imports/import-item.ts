import { Result } from '../../../../shared/result/result';
import {
  contentHashOf,
  QuestionContent,
  validateQuestionContent,
} from '../questions/question-content';
import { CatalogName } from '../shared/catalog-name.vo';
import { FieldError } from '../shared/field-error';

export const SUPPORTED_SCHEMA_VERSION = '1.0';
export const MAX_IMPORT_QUESTIONS = 100;

/** One item as written by the external AI, already checked against the JSON Schema shape. */
export interface RawImportItem {
  type: 'multiple_choice';
  statement: string;
  subject: string;
  topic: string;
  difficulty: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  sourceReference?: string;
}

/** What the student will import: options re-keyed A–F in the given order. */
export interface NormalizedImportItem {
  content: QuestionContent;
  subjectName: string;
  topicName: string;
  sourceReference: string | null;
  contentHash: string;
}

// Rendering is always text-only, but content with executable HTML is refused outright (spec 05).
const UNSAFE =
  /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|svg|form)\b|\son[a-z]+\s*=|javascript\s*:/i;

function unsafe(path: string, value: string): FieldError | null {
  return UNSAFE.test(value)
    ? { path, code: 'UNSAFE_CONTENT', message: 'Executable HTML or scripts are not allowed.' }
    : null;
}

/** Semantic checks beyond the JSON Schema (spec 05 / RN-005), then normalization. */
export function normalizeImportItem(
  item: RawImportItem,
): Result<NormalizedImportItem, FieldError[]> {
  const errors: FieldError[] = [];

  const ids = item.options.map((option) => option.id.trim());
  ids.forEach((id, index) => {
    if (!id) {
      errors.push({
        path: `options[${index}].id`,
        code: 'REQUIRED',
        message: 'Option id is required.',
      });
    } else if (ids.indexOf(id) !== index) {
      errors.push({
        path: `options[${index}].id`,
        code: 'DUPLICATE_OPTION_ID',
        message: `Option id "${id}" is repeated.`,
      });
    }
  });
  const correctId = item.correctOptionId.trim();
  if (!ids.includes(correctId)) {
    errors.push({
      path: 'correctOptionId',
      code: 'UNKNOWN_OPTION_ID',
      message: `correctOptionId "${correctId}" is not one of the option ids.`,
    });
  }

  const unsafeChecks = [
    unsafe('statement', item.statement),
    unsafe('explanation', item.explanation),
    ...item.options.map((option, index) => unsafe(`options[${index}].text`, option.text)),
  ];
  errors.push(...unsafeChecks.filter((error): error is FieldError => error !== null));

  const content = validateQuestionContent({
    statement: item.statement,
    explanation: item.explanation,
    difficulty: item.difficulty,
    options: item.options.map((option) => ({
      text: option.text,
      isCorrect: option.id.trim() === correctId,
    })),
  });
  if (content.isFailure) {
    // The "exactly one correct" rule is already covered by UNKNOWN_OPTION_ID here.
    errors.push(
      ...content.error.filter(
        (error) => !(error.code === 'CORRECT_OPTION_COUNT' && !ids.includes(correctId)),
      ),
    );
  }

  const subject = CatalogName.create(item.subject);
  if (subject.isFailure)
    errors.push({ path: 'subject', code: 'INVALID_NAME', message: subject.error });
  const topic = CatalogName.create(item.topic);
  if (topic.isFailure) errors.push({ path: 'topic', code: 'INVALID_NAME', message: topic.error });

  if (errors.length > 0) return Result.fail(errors);

  const sourceReference = item.sourceReference?.trim() || null;
  return Result.ok({
    content: content.value,
    subjectName: subject.value.toString(),
    topicName: topic.value.toString(),
    sourceReference,
    contentHash: contentHashOf(content.value),
  });
}
