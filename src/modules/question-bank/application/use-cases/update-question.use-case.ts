import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  QuestionOptionInput,
  validateQuestionContent,
} from '../../domain/questions/question-content';
import { QuestionStatus } from '../../domain/questions/question.entity';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
  QuestionDetail,
} from '../../domain/questions/question.repository';
import { FieldError } from '../../domain/shared/field-error';
import {
  ITaxonomyRepository,
  TAXONOMY_REPOSITORY,
} from '../../domain/taxonomy/taxonomy.repository';
import {
  COLLECTION_REPOSITORY,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';
import { resolveClassification } from '../classification';
import { checkCollectionIds } from '../collection-input';

export interface UpdateQuestionInput {
  userId: string;
  questionId: string;
  statement?: string;
  explanation?: string;
  difficulty?: string;
  options?: QuestionOptionInput[];
  subjectId?: string;
  /** null removes the topic; undefined keeps it (if it still belongs to the subject). */
  topicId?: string | null;
  status?: QuestionStatus;
  /** Exact set of the student's collections this question should be in; undefined keeps them. */
  collectionIds?: string[];
}

export interface IUpdateQuestionUseCase {
  execute(input: UpdateQuestionInput): Promise<Result<QuestionDetail, AppError>>;
}

export const UPDATE_QUESTION_USE_CASE = Symbol('UPDATE_QUESTION_USE_CASE');

/** Partial update. Content fields are merged with the current ones and revalidated as a whole. */
@Injectable()
export class UpdateQuestionUseCase implements IUpdateQuestionUseCase {
  constructor(
    @Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository,
    @Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository,
    @Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository,
  ) {}

  async execute(input: UpdateQuestionInput): Promise<Result<QuestionDetail, AppError>> {
    const question = await this.questions.findOwned(input.userId, input.questionId);
    if (!question) return Result.fail(ResourceErrors.notFound('Question'));

    const errors: FieldError[] = [];
    const current = question.content;

    const touchesContent = [
      input.statement,
      input.explanation,
      input.difficulty,
      input.options,
    ].some((value) => value !== undefined);
    if (touchesContent) {
      const content = validateQuestionContent({
        statement: input.statement ?? current.statement,
        explanation: input.explanation ?? current.explanation,
        difficulty: input.difficulty ?? current.difficulty,
        options:
          input.options ??
          current.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
      });
      if (content.isFailure) errors.push(...content.error);
      else question.changeContent(content.value);
    }

    if (input.subjectId !== undefined || input.topicId !== undefined) {
      const subjectId = input.subjectId ?? question.subjectId;
      const topicId =
        input.topicId !== undefined
          ? input.topicId
          : subjectId === question.subjectId
            ? question.topicId
            : null;
      const classification = await resolveClassification(
        this.taxonomy,
        input.userId,
        subjectId,
        topicId,
      );
      if (classification.isFailure) errors.push(...classification.error);
      else question.reclassify(classification.value);
    }

    const collectionIds = await checkCollectionIds(
      this.collections,
      input.userId,
      input.collectionIds,
    );
    if (collectionIds.isFailure) errors.push(...collectionIds.error);

    if (errors.length > 0) {
      return Result.fail(AppError.validation('The question has invalid fields.', errors));
    }

    if (input.status === 'archived') question.archive();
    if (input.status === 'active') question.restore();

    await this.questions.save(question, collectionIds.value);
    const detail = await this.questions.detail(input.userId, question.id);
    return Result.ok(detail!);
  }
}
