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
import { TAXONOMY_REPOSITORY } from './domain/taxonomy/taxonomy.repository';
import { PrismaTaxonomyRepository } from './infrastructure/repositories/prisma-taxonomy.repository';
import { TaxonomyController } from './presentation/controllers/taxonomy.controller';

/** Student's private question bank: taxonomy, questions and collections (Sprint 2). */
@Module({
  imports: [IdentityModule],
  controllers: [TaxonomyController],
  providers: [
    { provide: TAXONOMY_REPOSITORY, useClass: PrismaTaxonomyRepository },
    { provide: GET_TAXONOMY_USE_CASE, useClass: GetTaxonomyUseCase },
    { provide: CREATE_SUBJECT_USE_CASE, useClass: CreateSubjectUseCase },
    { provide: CREATE_TOPIC_USE_CASE, useClass: CreateTopicUseCase },
  ],
})
export class QuestionBankModule {}
