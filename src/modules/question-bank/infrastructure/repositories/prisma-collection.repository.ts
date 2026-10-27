import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { Collection } from '../../domain/collections/collection.entity';
import {
  CollectionSummary,
  ICollectionRepository,
} from '../../domain/collections/collection.repository';

const WITH_COUNT = { _count: { select: { questions: true } } } as const;

@Injectable()
export class PrismaCollectionRepository implements ICollectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(ownerUserId: string): Promise<CollectionSummary[]> {
    const rows = await this.prisma.questionCollection.findMany({
      where: { ownerUserId },
      include: WITH_COUNT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async summary(ownerUserId: string, collectionId: string): Promise<CollectionSummary | null> {
    const row = await this.prisma.questionCollection.findFirst({
      where: { id: collectionId, ownerUserId },
      include: WITH_COUNT,
    });
    return row ? this.toSummary(row) : null;
  }

  async findOwned(ownerUserId: string, collectionId: string): Promise<Collection | null> {
    const row = await this.prisma.questionCollection.findFirst({
      where: { id: collectionId, ownerUserId },
    });
    return row
      ? Collection.reconstitute({
          id: row.id,
          ownerUserId: row.ownerUserId,
          name: row.name,
          description: row.description,
          createdAt: row.createdAt,
        })
      : null;
  }

  async ownedIds(ownerUserId: string, collectionIds: string[]): Promise<string[]> {
    if (collectionIds.length === 0) return [];
    const rows = await this.prisma.questionCollection.findMany({
      where: { ownerUserId, id: { in: collectionIds } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async create(collection: Collection): Promise<void> {
    await this.prisma.questionCollection.create({
      data: {
        id: collection.id,
        ownerUserId: collection.ownerUserId,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt,
      },
    });
  }

  async save(collection: Collection): Promise<void> {
    await this.prisma.questionCollection.update({
      where: { id: collection.id },
      data: { name: collection.name, description: collection.description },
    });
  }

  async delete(collectionId: string): Promise<void> {
    // collection_questions rows go with it (ON DELETE CASCADE); questions are untouched.
    await this.prisma.questionCollection.delete({ where: { id: collectionId } });
  }

  async addQuestions(collectionId: string, questionIds: string[]): Promise<number> {
    if (questionIds.length === 0) return 0;
    const result = await this.prisma.collectionQuestion.createMany({
      data: questionIds.map((questionId) => ({ collectionId, questionId })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async removeQuestion(collectionId: string, questionId: string): Promise<void> {
    await this.prisma.collectionQuestion.deleteMany({ where: { collectionId, questionId } });
  }

  private toSummary(row: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    _count: { questions: number };
  }): CollectionSummary {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      questionCount: row._count.questions,
      createdAt: row.createdAt,
    };
  }
}
