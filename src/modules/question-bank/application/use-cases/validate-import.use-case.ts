import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  RATE_LIMITER,
  IRateLimiterPort,
} from '../../../identity/application/ports/rate-limiter.port';
import {
  MAX_IMPORT_QUESTIONS,
  normalizeImportItem,
  RawImportItem,
  SUPPORTED_SCHEMA_VERSION,
} from '../../domain/imports/import-item';
import { PreviewItem, QuestionImport } from '../../domain/imports/question-import.entity';
import {
  IQuestionImportRepository,
  QUESTION_IMPORT_REPOSITORY,
} from '../../domain/imports/question-import.repository';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
} from '../../domain/questions/question.repository';
import { CatalogName } from '../../domain/shared/catalog-name.vo';
import { FieldError } from '../../domain/shared/field-error';
import {
  ITaxonomyRepository,
  TAXONOMY_REPOSITORY,
} from '../../domain/taxonomy/taxonomy.repository';
import { ImportPreviewResponse, InvalidImportItem, ValidImportItem } from '../dto/import-views';
import { IImportSchemaPort, IMPORT_SCHEMA } from '../ports/import-schema.port';

export interface IValidateImportUseCase {
  execute(userId: string, body: unknown): Promise<Result<ImportPreviewResponse, AppError>>;
}

export const VALIDATE_IMPORT_USE_CASE = Symbol('VALIDATE_IMPORT_USE_CASE');

const RATE_LIMIT = { maxAttempts: 30, windowSeconds: 600 };
const ROOT_KEYS = new Set(['schemaVersion', 'questions']);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;
}

/**
 * Step 1 of the import (RN-004..009): checks the JSON item by item, normalizes the valid ones,
 * flags exact duplicates and stores a preview for 1 hour. Nothing enters the bank here.
 */
@Injectable()
export class ValidateImportUseCase implements IValidateImportUseCase {
  constructor(
    @Inject(IMPORT_SCHEMA) private readonly schema: IImportSchemaPort,
    @Inject(QUESTION_IMPORT_REPOSITORY) private readonly imports: IQuestionImportRepository,
    @Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository,
    @Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository,
    @Inject(RATE_LIMITER) private readonly rateLimiter: IRateLimiterPort,
  ) {}

  async execute(userId: string, body: unknown): Promise<Result<ImportPreviewResponse, AppError>> {
    const limit = await this.rateLimiter.consume(
      `import:${userId}`,
      RATE_LIMIT.maxAttempts,
      RATE_LIMIT.windowSeconds,
    );
    if (!limit.allowed) return Result.fail(AppError.rateLimited(limit.retryAfterSeconds));

    const root = this.checkRoot(body);
    if (root.isFailure) return Result.fail(root.error);
    const rawItems = root.value;

    const valid: { index: number; item: ReturnType<typeof normalizeImportItem>['value'] }[] = [];
    const invalidItems: InvalidImportItem[] = [];

    rawItems.forEach((raw, index) => {
      const structural = this.schema.checkItem(raw);
      const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
        string,
        unknown
      >;
      const errors: FieldError[] = [...structural];
      if (structural.length === 0) {
        const normalized = normalizeImportItem(raw as RawImportItem);
        if (normalized.isFailure) errors.push(...normalized.error);
        else valid.push({ index, item: normalized.value });
      }
      if (errors.length > 0) {
        invalidItems.push({
          index,
          statement: text(record.statement),
          subject: text(record.subject),
          errors,
        });
      }
    });

    const inBank = await this.questions.existingHashes(
      userId,
      valid.map((entry) => entry.item.contentHash),
    );
    const firstByHash = new Map<string, number>();
    const preview: PreviewItem[] = valid.map(({ index, item }) => {
      const earlier = firstByHash.get(item.contentHash);
      if (earlier === undefined) firstByHash.set(item.contentHash, index);
      return {
        index,
        item,
        duplicateOfBank: inBank.has(item.contentHash),
        duplicateOfIndex: earlier ?? null,
      };
    });

    const questionImport = QuestionImport.validated(
      userId,
      SUPPORTED_SCHEMA_VERSION,
      rawItems.length,
      preview,
    );
    await this.imports.create(questionImport);

    const known = await this.knownNames(userId);
    const validItems: ValidImportItem[] = preview.map((entry) => {
      const subjectKey = CatalogName.keyOf(entry.item.subjectName);
      const topics = known.get(subjectKey);
      const duplicateOf = entry.duplicateOfBank
        ? 'bank'
        : entry.duplicateOfIndex !== null
          ? 'batch'
          : null;
      return {
        index: entry.index,
        normalizedQuestion: {
          ...entry.item.content,
          subject: entry.item.subjectName,
          topic: entry.item.topicName,
          sourceReference: entry.item.sourceReference,
        },
        duplicate: duplicateOf !== null,
        duplicateOf,
        newSubject: topics === undefined,
        newTopic: !topics?.has(CatalogName.keyOf(entry.item.topicName)),
      };
    });

    return Result.ok({
      previewId: questionImport.id,
      expiresAt: questionImport.expiresAt!,
      totalCount: rawItems.length,
      validItems,
      invalidItems,
    });
  }

  private checkRoot(body: unknown): Result<unknown[], AppError> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return Result.fail(
        AppError.validation('The import must be a JSON object.', [
          {
            path: '',
            code: 'INVALID_TYPE',
            message: 'Expected an object with schemaVersion and questions.',
          },
        ]),
      );
    }
    const root = body as Record<string, unknown>;
    if (root.schemaVersion === undefined) {
      return Result.fail(
        AppError.validation('schemaVersion is required.', [
          { path: 'schemaVersion', code: 'REQUIRED', message: 'schemaVersion is required.' },
        ]),
      );
    }
    if (root.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
      return Result.fail(ResourceErrors.unsupportedSchema(root.schemaVersion));
    }
    const errors: FieldError[] = Object.keys(root)
      .filter((key) => !ROOT_KEYS.has(key))
      .map((key) => ({ path: key, code: 'UNKNOWN_FIELD', message: `Unknown field "${key}".` }));
    const questions = root.questions;
    if (!Array.isArray(questions)) {
      errors.push({
        path: 'questions',
        code: 'INVALID_TYPE',
        message: 'questions must be an array.',
      });
    } else if (questions.length === 0 || questions.length > MAX_IMPORT_QUESTIONS) {
      errors.push({
        path: 'questions',
        code: 'QUESTIONS_COUNT',
        message: `Send between 1 and ${MAX_IMPORT_QUESTIONS} questions per import.`,
      });
    }
    if (errors.length > 0) return Result.fail(AppError.validation('Invalid import file.', errors));
    return Result.ok(questions as unknown[]);
  }

  /** subject key → set of topic keys, for everything the student can see. */
  private async knownNames(userId: string): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();
    for (const area of await this.taxonomy.treeFor(userId)) {
      for (const subject of area.subjects) {
        const key = CatalogName.keyOf(subject.name);
        const topics = map.get(key) ?? new Set<string>();
        subject.topics.forEach((topic) => topics.add(CatalogName.keyOf(topic.name)));
        map.set(key, topics);
      }
    }
    return map;
  }
}
