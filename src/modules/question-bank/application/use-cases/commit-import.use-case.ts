import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { Collection } from '../../domain/collections/collection.entity';
import {
  COLLECTION_REPOSITORY,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';
import { PreviewItem } from '../../domain/imports/question-import.entity';
import {
  IQuestionImportRepository,
  QUESTION_IMPORT_REPOSITORY,
} from '../../domain/imports/question-import.repository';
import { Question } from '../../domain/questions/question.entity';
import { CatalogName } from '../../domain/shared/catalog-name.vo';
import { Subject, TopicProps } from '../../domain/taxonomy/subject.entity';
import {
  ITaxonomyRepository,
  TAXONOMY_REPOSITORY,
} from '../../domain/taxonomy/taxonomy.repository';
import { ImportResultResponse, toImportResult } from '../dto/import-views';

export interface CommitImportInput {
  userId: string;
  previewId: string;
  selectedIndexes: number[];
  collectionId?: string | null;
  idempotencyKey: string;
}

export interface ICommitImportUseCase {
  execute(input: CommitImportInput): Promise<Result<ImportResultResponse, AppError>>;
}

export const COMMIT_IMPORT_USE_CASE = Symbol('COMMIT_IMPORT_USE_CASE');

function validationError(path: string, code: string, message: string): AppError {
  return AppError.validation(message, [{ path, code, message }]);
}

/**
 * Step 2 of the import: saves the selected items of a stored preview, in one transaction and
 * idempotently by idempotencyKey (RN-008, RN-010). Exact duplicates that were not selected are
 * skipped; selecting one imports it anyway (the student reviewed it, RN-009).
 */
@Injectable()
export class CommitImportUseCase implements ICommitImportUseCase {
  constructor(
    @Inject(QUESTION_IMPORT_REPOSITORY) private readonly imports: IQuestionImportRepository,
    @Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository,
    @Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository,
  ) {}

  async execute(input: CommitImportInput): Promise<Result<ImportResultResponse, AppError>> {
    const replay = await this.replay(input);
    if (replay) return replay;

    const questionImport = await this.imports.findOwned(input.userId, input.previewId);
    if (!questionImport) return Result.fail(ResourceErrors.notFound('Import'));
    if (questionImport.status === 'committed') {
      return Result.fail(ResourceErrors.conflict('This import was already confirmed.'));
    }
    if (!questionImport.isOpen()) return Result.fail(ResourceErrors.importPreviewExpired());

    const byIndex = new Map(questionImport.preview.map((entry) => [entry.index, entry]));
    const selected = [...new Set(input.selectedIndexes)];
    const unknown = selected.filter((index) => !byIndex.has(index));
    if (selected.length === 0 || unknown.length > 0) {
      return Result.fail(
        validationError(
          'selectedIndexes',
          'INVALID_SELECTION',
          unknown.length > 0
            ? `Not valid items of this preview: ${unknown.join(', ')}.`
            : 'Select at least one valid question.',
        ),
      );
    }

    let collection: Collection | null = null;
    if (input.collectionId) {
      collection = await this.collections.findOwned(input.userId, input.collectionId);
      if (!collection) {
        return Result.fail(
          validationError('collectionId', 'UNKNOWN_COLLECTION', 'Collection not found.'),
        );
      }
    }

    const entries = selected.sort((a, b) => a - b).map((index) => byIndex.get(index)!);
    const classification = await this.classify(input.userId, entries);
    if (classification.isFailure) return Result.fail(classification.error);
    const { newSubjects, newTopics, refs } = classification.value;

    const questions = entries.map((entry, position) =>
      Question.create(input.userId, refs[position]!, entry.item.content, {
        sourceImportId: questionImport.id,
        sourceReference: entry.item.sourceReference,
      }),
    );
    const skippedDuplicates = questionImport.preview.filter(
      (entry) =>
        !selected.includes(entry.index) &&
        (entry.duplicateOfBank || entry.duplicateOfIndex !== null),
    ).length;
    questionImport.markCommitted(input.idempotencyKey, questions.length, skippedDuplicates);

    const committed = await this.imports.commit({
      questionImport,
      newSubjects,
      newTopics,
      questions,
      collection,
    });
    if (!committed) {
      // Lost a race: a concurrent request with the same key wins and its result is returned.
      return (await this.replay(input)) ?? Result.fail(ResourceErrors.importPreviewExpired());
    }
    return Result.ok(toImportResult(questionImport));
  }

  /** Same idempotency key as an earlier commit → the same result, nothing written again. */
  private async replay(
    input: CommitImportInput,
  ): Promise<Result<ImportResultResponse, AppError> | null> {
    const previous = await this.imports.findByIdempotencyKey(input.userId, input.idempotencyKey);
    if (!previous) return null;
    if (previous.id !== input.previewId) {
      return Result.fail(
        ResourceErrors.conflict('This idempotency key was already used for another import.'),
      );
    }
    return Result.ok(toImportResult(previous));
  }

  /**
   * Maps subject/topic names to the student's taxonomy (catalog first), creating private
   * entries that do not exist yet. New subjects go to the first knowledge area.
   */
  private async classify(userId: string, entries: PreviewItem[]) {
    const tree = await this.taxonomy.treeFor(userId);
    const subjectIdByKey = new Map<string, string>();
    for (const area of tree) {
      for (const subject of area.subjects) {
        const key = CatalogName.keyOf(subject.name);
        // Catalog entries win over a student's twin.
        if (!subjectIdByKey.has(key) || !subject.custom) subjectIdByKey.set(key, subject.id);
      }
    }

    const loaded = new Map<string, Subject>();
    const newSubjects: Subject[] = [];
    const newTopics: TopicProps[] = [];
    const refs: { subjectId: string; topicId: string | null }[] = [];

    for (const entry of entries) {
      const subjectName = CatalogName.create(entry.item.subjectName).value;
      const key = subjectName.matchKey();
      let subject = loaded.get(key);
      if (!subject) {
        const id = subjectIdByKey.get(key);
        subject = id
          ? ((await this.taxonomy.findVisibleSubject(userId, id)) ?? undefined)
          : undefined;
        if (!subject) {
          const area = tree[0];
          if (!area) {
            return Result.fail<
              { newSubjects: Subject[]; newTopics: TopicProps[]; refs: typeof refs },
              AppError
            >(ResourceErrors.notFound('Knowledge area'));
          }
          subject = Subject.create(area.id, userId, subjectName);
          newSubjects.push(subject);
        }
        loaded.set(key, subject);
      }

      const topicName = CatalogName.create(entry.item.topicName).value;
      let topic = subject.findTopicByName(topicName);
      if (!topic) {
        topic = subject.newTopic(userId, topicName);
        newTopics.push(topic);
      }
      refs.push({ subjectId: subject.id, topicId: topic.id });
    }

    return Result.ok<
      { newSubjects: Subject[]; newTopics: TopicProps[]; refs: typeof refs },
      AppError
    >({
      newSubjects,
      newTopics,
      refs,
    });
  }
}
