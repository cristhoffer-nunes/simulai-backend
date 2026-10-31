import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  IQuestionPoolPort,
  PoolFilter,
  SubjectPool,
} from '../application/ports/question-pool.port';
import { QuestionDifficulty, QuestionSnapshot } from '../domain/snapshot';

/** Reads the question bank's tables (same database) with the exam's eligibility rules. */
@Injectable()
export class PrismaQuestionPoolAdapter implements IQuestionPoolPort {
  constructor(private readonly prisma: PrismaService) {}

  private where(filter: PoolFilter): Prisma.QuestionWhereInput {
    return {
      ownerUserId: filter.ownerUserId,
      status: 'active',
      ...(filter.difficulty === 'all' ? {} : { difficulty: filter.difficulty }),
      ...(filter.collectionId
        ? { collections: { some: { collectionId: filter.collectionId } } }
        : {}),
    };
  }

  async availability(filter: PoolFilter): Promise<SubjectPool[]> {
    const groups = await this.prisma.question.groupBy({
      by: ['subjectId'],
      where: this.where(filter),
      _count: { _all: true },
    });
    if (groups.length === 0) return [];
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: groups.map((group) => group.subjectId) } },
      select: { id: true, name: true },
    });
    const names = new Map(subjects.map((subject) => [subject.id, subject.name]));
    return groups
      .map((group) => ({
        subjectId: group.subjectId,
        subjectName: names.get(group.subjectId) ?? '',
        available: group._count._all,
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pt-BR'));
  }

  async eligibleIds(filter: PoolFilter, subjectId: string): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: { ...this.where(filter), subjectId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async snapshots(
    ownerUserId: string,
    questionIds: string[],
  ): Promise<Map<string, QuestionSnapshot>> {
    if (questionIds.length === 0) return new Map();
    const rows = await this.prisma.question.findMany({
      where: { ownerUserId, status: 'active', id: { in: questionIds } },
      include: {
        options: { orderBy: { optionKey: 'asc' } },
        subject: { select: { name: true } },
        topic: { select: { name: true } },
      },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        {
          statement: row.statement,
          options: row.options.map((option) => ({ id: option.optionKey, text: option.text })),
          correctOptionId: row.options.find((option) => option.isCorrect)?.optionKey ?? '',
          explanation: row.explanation,
          sourceReference: row.sourceReference,
          subjectId: row.subjectId,
          subjectName: row.subject.name,
          topicId: row.topicId,
          topicName: row.topic?.name ?? null,
          difficulty: row.difficulty as QuestionDifficulty,
        },
      ]),
    );
  }

  async ownsCollection(ownerUserId: string, collectionId: string): Promise<boolean> {
    return (
      (await this.prisma.questionCollection.count({ where: { id: collectionId, ownerUserId } })) > 0
    );
  }
}
