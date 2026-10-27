import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CatalogName } from '../../domain/shared/catalog-name.vo';
import { Subject, TopicProps } from '../../domain/taxonomy/subject.entity';
import { ITaxonomyRepository, TaxonomyAreaView } from '../../domain/taxonomy/taxonomy.repository';

const visibleTo = (userId: string) => ({ OR: [{ ownerUserId: null }, { ownerUserId: userId }] });

@Injectable()
export class PrismaTaxonomyRepository implements ITaxonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async treeFor(userId: string): Promise<TaxonomyAreaView[]> {
    const [areas, bySubject, byTopic] = await Promise.all([
      this.prisma.knowledgeArea.findMany({
        orderBy: { name: 'asc' },
        include: {
          subjects: {
            where: visibleTo(userId),
            orderBy: { name: 'asc' },
            include: { topics: { where: visibleTo(userId), orderBy: { name: 'asc' } } },
          },
        },
      }),
      this.prisma.question.groupBy({
        by: ['subjectId'],
        where: { ownerUserId: userId, status: 'active' },
        _count: { _all: true },
      }),
      this.prisma.question.groupBy({
        by: ['topicId'],
        where: { ownerUserId: userId, status: 'active', topicId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const subjectCounts = new Map(bySubject.map((row) => [row.subjectId, row._count._all]));
    const topicCounts = new Map(byTopic.map((row) => [row.topicId, row._count._all]));

    return areas.map((area) => ({
      id: area.id,
      name: area.name,
      subjects: area.subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        custom: subject.ownerUserId !== null,
        questionCount: subjectCounts.get(subject.id) ?? 0,
        topics: subject.topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          custom: topic.ownerUserId !== null,
          questionCount: topicCounts.get(topic.id) ?? 0,
        })),
      })),
    }));
  }

  async areaExists(areaId: string): Promise<boolean> {
    return (await this.prisma.knowledgeArea.count({ where: { id: areaId } })) > 0;
  }

  async findVisibleSubject(userId: string, subjectId: string): Promise<Subject | null> {
    const row = await this.prisma.subject.findFirst({
      where: { id: subjectId, ...visibleTo(userId) },
      include: { topics: { where: visibleTo(userId) } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findVisibleSubjectByName(
    userId: string,
    areaId: string,
    name: CatalogName,
  ): Promise<Subject | null> {
    const rows = await this.prisma.subject.findMany({
      where: { knowledgeAreaId: areaId, ...visibleTo(userId) },
      include: { topics: { where: visibleTo(userId) } },
    });
    const key = name.matchKey();
    // Catalog first, so a student's twin never shadows the shared entry.
    const match = rows
      .filter((row) => CatalogName.keyOf(row.name) === key)
      .sort((a, b) => Number(a.ownerUserId !== null) - Number(b.ownerUserId !== null))[0];
    return match ? this.toDomain(match) : null;
  }

  async createSubject(subject: Subject): Promise<void> {
    await this.prisma.subject.create({
      data: {
        id: subject.id,
        knowledgeAreaId: subject.knowledgeAreaId,
        ownerUserId: subject.ownerUserId,
        name: subject.name,
      },
    });
  }

  async addTopic(topic: TopicProps): Promise<void> {
    await this.prisma.topic.create({
      data: {
        id: topic.id,
        subjectId: topic.subjectId,
        ownerUserId: topic.ownerUserId,
        name: topic.name,
      },
    });
  }

  private toDomain(row: {
    id: string;
    knowledgeAreaId: string;
    ownerUserId: string | null;
    name: string;
    topics: { id: string; subjectId: string; ownerUserId: string | null; name: string }[];
  }): Subject {
    return Subject.reconstitute({
      id: row.id,
      knowledgeAreaId: row.knowledgeAreaId,
      ownerUserId: row.ownerUserId,
      name: row.name,
      topics: row.topics.map((topic) => ({
        id: topic.id,
        subjectId: topic.subjectId,
        ownerUserId: topic.ownerUserId,
        name: topic.name,
      })),
    });
  }
}
