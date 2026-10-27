import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  IAttemptStatsQuery,
  PreviousAttempt,
  SubjectTotals,
} from '../application/ports/attempt-stats.port';

@Injectable()
export class PrismaAttemptStatsQuery implements IAttemptStatsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async subjectTotals(
    ownerUserId: string,
    subjectIds: string[],
  ): Promise<Map<string, SubjectTotals>> {
    if (subjectIds.length === 0) return new Map();
    // Every question of every finished attempt counts; blanks are questions answered wrong.
    const rows = await this.prisma.$queryRaw<
      { subject_id: string; total: number; correct: number }[]
    >(Prisma.sql`
      SELECT sq.snapshot->>'subjectId' AS subject_id,
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
         AND sq.snapshot->>'subjectId' IN (${Prisma.join(subjectIds)})
       GROUP BY 1`);
    return new Map(
      rows.map((row) => [
        row.subject_id,
        { total: Number(row.total), correct: Number(row.correct) },
      ]),
    );
  }

  async previousFinished(
    ownerUserId: string,
    simulationId: string,
    before: Date,
  ): Promise<PreviousAttempt | null> {
    const previous = await this.prisma.simulationAttempt.findFirst({
      where: {
        ownerUserId,
        simulationId,
        status: { not: 'in_progress' },
        createdAt: { lt: before },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, scorePercentage: true },
    });
    if (!previous) return null;
    const attemptNumber = await this.prisma.simulationAttempt.count({
      where: { simulationId, createdAt: { lte: previous.createdAt } },
    });
    return {
      attemptId: previous.id,
      attemptNumber,
      scorePercentage: Number(previous.scorePercentage ?? 0),
    };
  }

  attemptCount(simulationId: string): Promise<number> {
    return this.prisma.simulationAttempt.count({ where: { simulationId } });
  }
}
