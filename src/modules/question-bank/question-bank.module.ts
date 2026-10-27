import { Module } from '@nestjs/common';
import { IMPORT_SCHEMA } from './application/ports/import-schema.port';
import {
  COMMIT_IMPORT_USE_CASE,
  CommitImportUseCase,
} from './application/use-cases/commit-import.use-case';
import { GET_IMPORT_USE_CASE, GetImportUseCase } from './application/use-cases/get-import.use-case';
import {
  DISCARD_IMPORT_USE_CASE,
  DiscardImportUseCase,
} from './application/use-cases/discard-import.use-case';
import {
  VALIDATE_IMPORT_USE_CASE,
  ValidateImportUseCase,
} from './application/use-cases/validate-import.use-case';
import { QUESTION_IMPORT_REPOSITORY } from './domain/imports/question-import.repository';
import { AjvImportSchemaAdapter } from './infrastructure/import-schema/ajv-import-schema.adapter';
import { PrismaQuestionImportRepository } from './infrastructure/repositories/prisma-question-import.repository';
import { ImportsController } from './presentation/controllers/imports.controller';
import {
  ADD_QUESTIONS_TO_COLLECTION_USE_CASE,
  AddQuestionsToCollectionUseCase,
} from './application/use-cases/add-questions-to-collection.use-case';
import {
  CREATE_COLLECTION_USE_CASE,
  CreateCollectionUseCase,
} from './application/use-cases/create-collection.use-case';
import {
  DELETE_COLLECTION_USE_CASE,
  DeleteCollectionUseCase,
} from './application/use-cases/delete-collection.use-case';
import {
  GET_COLLECTION_USE_CASE,
  GetCollectionUseCase,
} from './application/use-cases/get-collection.use-case';
import {
  LIST_COLLECTIONS_USE_CASE,
  ListCollectionsUseCase,
} from './application/use-cases/list-collections.use-case';
import {
  REMOVE_QUESTION_FROM_COLLECTION_USE_CASE,
  RemoveQuestionFromCollectionUseCase,
} from './application/use-cases/remove-question-from-collection.use-case';
import {
  UPDATE_COLLECTION_USE_CASE,
  UpdateCollectionUseCase,
} from './application/use-cases/update-collection.use-case';
import { COLLECTION_REPOSITORY } from './domain/collections/collection.repository';
import { PrismaCollectionRepository } from './infrastructure/repositories/prisma-collection.repository';
import { CollectionsController } from './presentation/controllers/collections.controller';
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
  controllers: [TaxonomyController, QuestionsController, CollectionsController, ImportsController],
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
    { provide: COLLECTION_REPOSITORY, useClass: PrismaCollectionRepository },
    { provide: LIST_COLLECTIONS_USE_CASE, useClass: ListCollectionsUseCase },
    { provide: GET_COLLECTION_USE_CASE, useClass: GetCollectionUseCase },
    { provide: CREATE_COLLECTION_USE_CASE, useClass: CreateCollectionUseCase },
    { provide: UPDATE_COLLECTION_USE_CASE, useClass: UpdateCollectionUseCase },
    { provide: DELETE_COLLECTION_USE_CASE, useClass: DeleteCollectionUseCase },
    { provide: ADD_QUESTIONS_TO_COLLECTION_USE_CASE, useClass: AddQuestionsToCollectionUseCase },
    { provide: IMPORT_SCHEMA, useClass: AjvImportSchemaAdapter },
    { provide: QUESTION_IMPORT_REPOSITORY, useClass: PrismaQuestionImportRepository },
    { provide: VALIDATE_IMPORT_USE_CASE, useClass: ValidateImportUseCase },
    { provide: DISCARD_IMPORT_USE_CASE, useClass: DiscardImportUseCase },
    { provide: COMMIT_IMPORT_USE_CASE, useClass: CommitImportUseCase },
    { provide: GET_IMPORT_USE_CASE, useClass: GetImportUseCase },
    {
      provide: REMOVE_QUESTION_FROM_COLLECTION_USE_CASE,
      useClass: RemoveQuestionFromCollectionUseCase,
    },
  ],
})
export class QuestionBankModule {}
