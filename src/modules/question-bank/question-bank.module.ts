import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  CREATE_SUBJECT_USE_CASE,
  CreateSubjectUseCase,
} from './application/use-cases/create-subject.use-case';
import {
  CREATE_TOPIC_USE_CASE,
  CreateTopicUseCase,
} from './application/use-cases/create-topic.use-case';
import {
  GET_TAXONOMY_USE_CASE,
  GetTaxonomyUseCase,
} from './application/use-cases/get-taxonomy.use-case';
import {
  ARCHIVE_QUESTION_USE_CASE,
  ArchiveQuestionUseCase,
} from './application/use-cases/archive-question.use-case';
import {
  CREATE_QUESTION_USE_CASE,
  CreateQuestionUseCase,
} from './application/use-cases/create-question.use-case';
import {
  GET_QUESTION_USE_CASE,
  GetQuestionUseCase,
} from './application/use-cases/get-question.use-case';
import {
  LIST_QUESTIONS_USE_CASE,
  ListQuestionsUseCase,
} from './application/use-cases/list-questions.use-case';
import {
  UPDATE_QUESTION_USE_CASE,
  UpdateQuestionUseCase,
} from './application/use-cases/update-question.use-case';
import { QUESTION_REPOSITORY } from './domain/questions/question.repository';
import { PrismaQuestionRepository } from './infrastructure/repositories/prisma-question.repository';
import { QuestionsController } from './presentation/controllers/questions.controller';
import { TAXONOMY_REPOSITORY } from './domain/taxonomy/taxonomy.repository';
import { PrismaTaxonomyRepository } from './infrastructure/repositories/prisma-taxonomy.repository';
import { TaxonomyController } from './presentation/controllers/taxonomy.controller';

/** Student's private question bank: taxonomy, questions and collections (Sprint 2). */
@Module({
  imports: [IdentityModule],
  controllers: [TaxonomyController, QuestionsController],
  providers: [
    { provide: TAXONOMY_REPOSITORY, useClass: PrismaTaxonomyRepository },
    { provide: GET_TAXONOMY_USE_CASE, useClass: GetTaxonomyUseCase },
    { provide: CREATE_SUBJECT_USE_CASE, useClass: CreateSubjectUseCase },
    { provide: CREATE_TOPIC_USE_CASE, useClass: CreateTopicUseCase },
    { provide: QUESTION_REPOSITORY, useClass: PrismaQuestionRepository },
    { provide: LIST_QUESTIONS_USE_CASE, useClass: ListQuestionsUseCase },
    { provide: GET_QUESTION_USE_CASE, useClass: GetQuestionUseCase },
    { provide: CREATE_QUESTION_USE_CASE, useClass: CreateQuestionUseCase },
    { provide: UPDATE_QUESTION_USE_CASE, useClass: UpdateQuestionUseCase },
    { provide: ARCHIVE_QUESTION_USE_CASE, useClass: ArchiveQuestionUseCase },
  ],
})
export class QuestionBankModule {}
