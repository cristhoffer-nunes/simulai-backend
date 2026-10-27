import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  QuestionContentInput,
  validateQuestionContent,
} from '../../domain/questions/question-content';
import { Question } from '../../domain/questions/question.entity';
import {
  IQuestionRepository,
  QUESTION_REPOSITORY,
  QuestionDetail,
} from '../../domain/questions/question.repository';
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
import { sourceReferenceErrors } from '../source-reference';

export interface CreateQuestionInput extends QuestionContentInput {
  userId: string;
  subjectId: string;
  topicId?: string | null;
  collectionIds?: string[];
  sourceReference?: string | null;
}

export interface ICreateQuestionUseCase {
  execute(input: CreateQuestionInput): Promise<Result<QuestionDetail, AppError>>;
}

export const CREATE_QUESTION_USE_CASE = Symbol('CREATE_QUESTION_USE_CASE');

@Injectable()
export class CreateQuestionUseCase implements ICreateQuestionUseCase {
  constructor(
    @Inject(QUESTION_REPOSITORY) private readonly questions: IQuestionRepository,
    @Inject(TAXONOMY_REPOSITORY) private readonly taxonomy: ITaxonomyRepository,
    @Inject(COLLECTION_REPOSITORY) private readonly collections: ICollectionRepository,
  ) {}

  async execute(input: CreateQuestionInput): Promise<Result<QuestionDetail, AppError>> {
    const content = validateQuestionContent(input);
    const classification = await resolveClassification(
      this.taxonomy,
      input.userId,
      input.subjectId,
      input.topicId ?? null,
    );
    const collectionIds = await checkCollectionIds(
      this.collections,
      input.userId,
      input.collectionIds,
    );

    const errors = [
      ...(content.isFailure ? content.error : []),
      ...(classification.isFailure ? classification.error : []),
      ...(collectionIds.isFailure ? collectionIds.error : []),
      ...sourceReferenceErrors(input.sourceReference),
    ];
    if (errors.length > 0) {
      return Result.fail(AppError.validation('The question has invalid fields.', errors));
    }

    const question = Question.create(input.userId, classification.value, content.value, {
      sourceReference: input.sourceReference?.trim() || null,
    });
    await this.questions.create(question, collectionIds.value);

    const detail = await this.questions.detail(input.userId, question.id);
    return Result.ok(detail!);
  }
}
