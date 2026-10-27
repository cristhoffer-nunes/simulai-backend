import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ImportStatus,
  PreviewItem,
  QuestionImport,
} from '../../domain/imports/question-import.entity';
import {
  ImportCommitPlan,
  IQuestionImportRepository,
} from '../../domain/imports/question-import.repository';

type ImportRow = Prisma.QuestionImportGetPayload<object>;

@Injectable()
export class PrismaQuestionImportRepository implements IQuestionImportRepository {
  constructor(protected readonly prisma: PrismaService) {}

  async create(questionImport: QuestionImport): Promise<void> {
    await this.prisma.questionImport.create({
      data: {
        id: questionImport.id,
        ownerUserId: questionImport.ownerUserId,
        schemaVersion: questionImport.schemaVersion,
        status: questionImport.status,
        totalCount: questionImport.totalCount,
        rejectedCount: questionImport.rejectedCount,
        duplicateCount: questionImport.duplicateCount,
        importedCount: questionImport.importedCount,
        preview: questionImport.preview as unknown as Prisma.InputJsonValue,
        expiresAt: questionImport.expiresAt,
        createdAt: questionImport.createdAt,
      },
    });
  }

  async findOwned(ownerUserId: string, importId: string): Promise<QuestionImport | null> {
    const row = await this.prisma.questionImport.findFirst({
      where: { id: importId, ownerUserId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByIdempotencyKey(ownerUserId: string, key: string): Promise<QuestionImport | null> {
    const row = await this.prisma.questionImport.findFirst({
      where: { ownerUserId, idempotencyKey: key },
    });
    return row ? this.toDomain(row) : null;
  }

  async commit(plan: ImportCommitPlan): Promise<boolean> {
    const { questionImport } = plan;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Claim the preview first: only one request can move it out of "validated" (RN-010).
        const claimed = await tx.questionImport.updateMany({
          where: {
            id: questionImport.id,
            ownerUserId: questionImport.ownerUserId,
            status: 'validated',
            expiresAt: { gt: new Date() },
          },
          data: {
            status: 'committed',
            idempotencyKey: questionImport.idempotencyKey,
            importedCount: questionImport.importedCount,
            duplicateCount: questionImport.duplicateCount,
            committedAt: questionImport.committedAt,
            preview: Prisma.DbNull,
            expiresAt: null,
          },
        });
        if (claimed.count === 0) return false;

        if (plan.newSubjects.length > 0) {
          await tx.subject.createMany({
            data: plan.newSubjects.map((subject) => ({
              id: subject.id,
              knowledgeAreaId: subject.knowledgeAreaId,
              ownerUserId: subject.ownerUserId,
              name: subject.name,
            })),
          });
        }
        if (plan.newTopics.length > 0) {
          await tx.topic.createMany({ data: plan.newTopics.map((topic) => ({ ...topic })) });
        }
        // Bulk inserts: a fixed number of round trips whatever the number of questions, so the
        // transaction stays short even with a remote database (up to 100 questions per import).
        await tx.question.createMany({
          data: plan.questions.map((question) => ({
            id: question.id,
            ownerUserId: question.ownerUserId,
            subjectId: question.subjectId,
            topicId: question.topicId,
            type: 'multiple_choice',
            statement: question.content.statement,
            explanation: question.content.explanation,
            difficulty: question.content.difficulty,
            status: question.status,
            contentHash: question.contentHash,
            sourceImportId: question.sourceImportId,
            sourceReference: question.sourceReference,
            createdAt: question.createdAt,
            updatedAt: question.updatedAt,
          })),
        });
        await tx.questionOption.createMany({
          data: plan.questions.flatMap((question) =>
            question.content.options.map((option) => ({
              questionId: question.id,
              optionKey: option.key,
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          ),
        });
        if (plan.collection) {
          const collectionId = plan.collection.id;
          await tx.collectionQuestion.createMany({
            data: plan.questions.map((question) => ({ collectionId, questionId: question.id })),
          });
        }
        return true;
      });
    } catch (error) {
      // Same idempotency key used concurrently by another import of this student.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async saveDiscarded(questionImport: QuestionImport): Promise<void> {
    await this.prisma.questionImport.updateMany({
      where: { id: questionImport.id, status: 'validated' },
      data: { status: 'discarded', preview: Prisma.DbNull, expiresAt: null },
    });
  }

  protected toDomain(row: ImportRow): QuestionImport {
    return QuestionImport.reconstitute({
      id: row.id,
      ownerUserId: row.ownerUserId,
      schemaVersion: row.schemaVersion,
      status: row.status as ImportStatus,
      totalCount: row.totalCount,
      rejectedCount: row.rejectedCount,
      duplicateCount: row.duplicateCount,
      importedCount: row.importedCount,
      idempotencyKey: row.idempotencyKey,
      preview: (row.preview as unknown as PreviewItem[] | null) ?? [],
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      committedAt: row.committedAt,
    });
  }
}
