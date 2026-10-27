import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { Difficulty } from '../../domain/questions/question-content';
import { Question, QuestionStatus } from '../../domain/questions/question.entity';
import {
  IQuestionRepository,
  QuestionDetail,
  QuestionListFilter,
  QuestionListItem,
  QuestionPage,
} from '../../domain/questions/question.repository';

const LIST_INCLUDE = {
  subject: { select: { id: true, name: true } },
  topic: { select: { id: true, name: true } },
  _count: { select: { collections: true } },
} satisfies Prisma.QuestionInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  options: { orderBy: { optionKey: 'asc' } },
  collections: { select: { collectionId: true }, orderBy: { addedAt: 'asc' } },
} satisfies Prisma.QuestionInclude;

type ListRow = Prisma.QuestionGetPayload<{ include: typeof LIST_INCLUDE }>;
type DetailRow = Prisma.QuestionGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class PrismaQuestionRepository implements IQuestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwned(ownerUserId: string, questionId: string): Promise<Question | null> {
    const row = await this.prisma.question.findFirst({
      where: { id: questionId, ownerUserId },
      include: { options: { orderBy: { optionKey: 'asc' } } },
    });
    if (!row) return null;
    return Question.reconstitute({
      id: row.id,
      ownerUserId: row.ownerUserId,
      subjectId: row.subjectId,
      topicId: row.topicId,
      content: {
        statement: row.statement,
        explanation: row.explanation,
        difficulty: row.difficulty as Difficulty,
        options: row.options.map((option) => ({
          key: option.optionKey,
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      },
      status: row.status as QuestionStatus,
      contentHash: row.contentHash,
      sourceImportId: row.sourceImportId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async detail(ownerUserId: string, questionId: string): Promise<QuestionDetail | null> {
    const row = await this.prisma.question.findFirst({
      where: { id: questionId, ownerUserId },
      include: DETAIL_INCLUDE,
    });
    if (!row) return null;
    return {
      ...this.toListItem(row),
      explanation: row.explanation,
      options: row.options.map((option) => ({
        key: option.optionKey,
        text: option.text,
        isCorrect: option.isCorrect,
      })),
      collectionIds: row.collections.map((membership) => membership.collectionId),
    };
  }

  async list(filter: QuestionListFilter): Promise<QuestionPage> {
    const where: Prisma.QuestionWhereInput = {
      ownerUserId: filter.ownerUserId,
      status: filter.status,
      ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
      ...(filter.topicId ? { topicId: filter.topicId } : {}),
      ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
      ...(filter.search ? { statement: { contains: filter.search, mode: 'insensitive' } } : {}),
      ...(filter.collectionId
        ? { collections: { some: { collectionId: filter.collectionId } } }
        : {}),
    };
    const after: Prisma.QuestionWhereInput = filter.after
      ? {
          OR: [
            { createdAt: { lt: filter.after.createdAt } },
            { createdAt: filter.after.createdAt, id: { lt: filter.after.id } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where: { AND: [where, after] },
        include: LIST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: filter.limit + 1,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: rows.slice(0, filter.limit).map((row) => this.toListItem(row)),
      total,
      hasMore: rows.length > filter.limit,
    };
  }

  async create(question: Question): Promise<void> {
    await this.prisma.question.create({
      data: {
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
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        options: { create: this.optionRows(question) },
      },
    });
  }

  async save(question: Question): Promise<void> {
    // Delete-then-insert inside one transaction keeps the "one correct option" index satisfied.
    await this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: question.id },
        data: {
          subjectId: question.subjectId,
          topicId: question.topicId,
          statement: question.content.statement,
          explanation: question.content.explanation,
          difficulty: question.content.difficulty,
          status: question.status,
          contentHash: question.contentHash,
          updatedAt: question.updatedAt,
        },
      });
      await tx.questionOption.deleteMany({ where: { questionId: question.id } });
      await tx.questionOption.createMany({
        data: this.optionRows(question).map((option) => ({ ...option, questionId: question.id })),
      });
    });
  }

  private optionRows(question: Question) {
    return question.content.options.map((option) => ({
      optionKey: option.key,
      text: option.text,
      isCorrect: option.isCorrect,
    }));
  }

  private toListItem(row: ListRow | DetailRow): QuestionListItem {
    return {
      id: row.id,
      statement: row.statement,
      difficulty: row.difficulty as Difficulty,
      status: row.status as QuestionStatus,
      subject: row.subject,
      topic: row.topic,
      collectionCount: row._count.collections,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
