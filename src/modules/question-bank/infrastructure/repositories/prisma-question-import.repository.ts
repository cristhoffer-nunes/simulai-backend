import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ImportStatus,
  PreviewItem,
  QuestionImport,
} from '../../domain/imports/question-import.entity';
import { IQuestionImportRepository } from '../../domain/imports/question-import.repository';

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
