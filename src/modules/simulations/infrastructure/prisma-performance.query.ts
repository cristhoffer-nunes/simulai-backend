import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  AttemptHistoryItem,
  AttemptTotals,
  BankSummary,
  HistoryFilter,
  HistoryPage,
  IPerformanceQuery,
  SubjectPerformance,
} from '../application/ports/performance-query.port';
import { SimulationConfiguration } from '../domain/simulation.entity';

function statusWhere(status: HistoryFilter['status']): Prisma.SimulationAttemptWhereInput {
  if (!status) return {};
  if (status === 'finished') return { status: { not: 'in_progress' } };
  return { status };
}

@Injectable()
export class PrismaPerformanceQuery implements IPerformanceQuery {
  constructor(private readonly prisma: PrismaService) {}

  async history(ownerUserId: string, filter: HistoryFilter): Promise<HistoryPage> {
    const where: Prisma.SimulationAttemptWhereInput = {
      ownerUserId,
      ...statusWhere(filter.status),
      ...(filter.simulationId ? { simulationId: filter.simulationId } : {}),
    };
    const direction = filter.oldestFirst ? 'asc' : 'desc';
    const after: Prisma.SimulationAttemptWhereInput = filter.after
      ? filter.oldestFirst
        ? {
            OR: [
              { createdAt: { gt: filter.after.createdAt } },
              { createdAt: filter.after.createdAt, id: { gt: filter.after.id } },
            ],
          }
        : {
            OR: [
              { createdAt: { lt: filter.after.createdAt } },
              { createdAt: filter.after.createdAt, id: { lt: filter.after.id } },
            ],
          }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.simulationAttempt.findMany({
        where: { AND: [where, after] },
        orderBy: [{ createdAt: direction }, { id: direction }],
        take: filter.limit + 1,
        include: {
          simulation: {
            select: {
              title: true,
              questionCount: true,
              durationSeconds: true,
              configuration: true,
            },
          },
          _count: { select: { answers: { where: { selectedOptionKey: { not: null } } } } },
        },
      }),
      this.prisma.simulationAttempt.count({ where }),
    ]);
    const page = rows.slice(0, filter.limit);

    // Attempt numbers: position of each attempt among all attempts of its simulation.
    const siblings = page.length
      ? await this.prisma.simulationAttempt.findMany({
          where: { simulationId: { in: [...new Set(page.map((row) => row.simulationId))] } },
          select: { id: true, simulationId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      : [];
    const numberOf = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const sibling of siblings) {
      const next = (seen.get(sibling.simulationId) ?? 0) + 1;
      seen.set(sibling.simulationId, next);
      numberOf.set(sibling.id, next);
    }

    const items: AttemptHistoryItem[] = page.map((row) => {
      const configuration = row.simulation.configuration as unknown as SimulationConfiguration;
      return {
        attemptId: row.id,
        simulationId: row.simulationId,
        title: row.simulation.title,
        subjectNames: configuration.subjectIds.map((id) => configuration.subjectNames?.[id] ?? ''),
        attemptNumber: numberOf.get(row.id) ?? 1,
        status: row.status,
        finishReason: row.finishReason,
        startedAt: row.startedAt,
        expiresAt: row.expiresAt,
        finishedAt: row.finishedAt,
        durationSeconds: row.simulation.durationSeconds,
        totalQuestions: row.simulation.questionCount,
        answeredCount: row._count.answers,
        correctCount: row.correctCount,
        scorePercentage: row.scorePercentage === null ? null : Number(row.scorePercentage),
        createdAt: row.createdAt,
      };
    });
    return { items, total, hasMore: rows.length > filter.limit };
  }

  async bank(ownerUserId: string): Promise<BankSummary> {
    const where = { ownerUserId, status: 'active' };
    const [bySubject, byTopic] = await Promise.all([
      this.prisma.question.groupBy({ by: ['subjectId'], where, _count: { _all: true } }),
      this.prisma.question.groupBy({
        by: ['topicId'],
        where: { ...where, topicId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const names = bySubject.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: bySubject.map((row) => row.subjectId) } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(names.map((subject) => [subject.id, subject.name]));
    const subjects = bySubject
      .map((row) => ({
        subjectId: row.subjectId,
        subjectName: nameOf.get(row.subjectId) ?? '',
        questionCount: row._count._all,
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pt-BR'));
    return {
      totalQuestions: subjects.reduce((sum, subject) => sum + subject.questionCount, 0),
      totalTopics: byTopic.length,
      subjects,
    };
  }

  async attemptTotals(ownerUserId: string): Promise<AttemptTotals> {
    const [totalSimulations, byStatus, sums] = await Promise.all([
      this.prisma.simulation.count({ where: { ownerUserId } }),
      this.prisma.simulationAttempt.groupBy({
        by: ['status'],
        where: { ownerUserId },
        _count: { _all: true },
      }),
      this.prisma.simulationAttempt.aggregate({
        where: { ownerUserId, status: { not: 'in_progress' } },
        _sum: { correctCount: true, incorrectCount: true, unansweredCount: true },
      }),
    ]);
    const count = (status: string) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const correct = sums._sum.correctCount ?? 0;
    return {
      totalSimulations,
      finishedAttempts: count('completed') + count('expired'),
      timeoutAttempts: count('expired'),
      inProgressAttempts: count('in_progress'),
      answeredQuestions:
        correct + (sums._sum.incorrectCount ?? 0) + (sums._sum.unansweredCount ?? 0),
      correctAnswers: correct,
    };
  }

  async performance(ownerUserId: string): Promise<SubjectPerformance[]> {
    const rows = await this.prisma.$queryRaw<
      {
        subject_id: string;
        subject_name: string;
        topic_id: string | null;
        topic_name: string | null;
        total: number;
        correct: number;
      }[]
    >(Prisma.sql`
      SELECT sq.snapshot->>'subjectId' AS subject_id,
             MAX(sq.snapshot->>'subjectName') AS subject_name,
             sq.snapshot->>'topicId' AS topic_id,
             MAX(sq.snapshot->>'topicName') AS topic_name,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (
               WHERE aa.selected_option_key = sq.snapshot->>'correctOptionId'
             )::int AS correct
        FROM "simulai_service"."simulation_attempts" sa
        JOIN "simulai_service"."simulation_questions" sq ON sq.simulation_id = sa.simulation_id
        LEFT JOIN "simulai_service"."attempt_answers" aa
               ON aa.attempt_id = sa.id AND aa.simulation_question_id = sq.id
       WHERE sa.owner_user_id = ${ownerUserId}::uuid
         AND sa.status <> 'in_progress'
       GROUP BY sq.snapshot->>'subjectId', sq.snapshot->>'topicId'`);

    const subjects = new Map<string, SubjectPerformance>();
    for (const row of rows) {
      const total = Number(row.total);
      const correct = Number(row.correct);
      const subject = subjects.get(row.subject_id) ?? {
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        total: 0,
        correct: 0,
        topics: [],
      };
      subject.total += total;
      subject.correct += correct;
      subject.topics.push({ topicId: row.topic_id, topicName: row.topic_name, total, correct });
      subjects.set(row.subject_id, subject);
    }
    return [...subjects.values()]
      .map((subject) => ({
        ...subject,
        topics: subject.topics.sort((a, b) =>
          (a.topicName ?? '').localeCompare(b.topicName ?? '', 'pt-BR'),
        ),
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pt-BR'));
  }
}
