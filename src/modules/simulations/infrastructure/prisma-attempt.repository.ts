import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Attempt, AttemptAnswer, AttemptStatus, FinishReason } from '../domain/attempt.entity';
import { IAttemptRepository } from '../domain/attempt.repository';

const WITH_ANSWERS = { answers: true } satisfies Prisma.SimulationAttemptInclude;
type AttemptRow = Prisma.SimulationAttemptGetPayload<{ include: typeof WITH_ANSWERS }>;
type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaAttemptRepository implements IAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(attempt: Attempt): Promise<boolean> {
    try {
      await this.prisma.simulationAttempt.create({
        data: {
          id: attempt.id,
          simulationId: attempt.simulationId,
          ownerUserId: attempt.ownerUserId,
          status: attempt.status,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          createdAt: attempt.createdAt,
        },
      });
      return true;
    } catch (error) {
      // simulation_attempts_one_in_progress: another attempt of this simulation is active.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async findOwned(ownerUserId: string, attemptId: string): Promise<Attempt | null> {
    const row = await this.prisma.simulationAttempt.findFirst({
      where: { id: attemptId, ownerUserId },
      include: WITH_ANSWERS,
    });
    return row ? this.toDomain(row) : null;
  }

  async findActive(ownerUserId: string, simulationId: string): Promise<Attempt | null> {
    const row = await this.prisma.simulationAttempt.findFirst({
      where: { ownerUserId, simulationId, status: 'in_progress' },
      include: WITH_ANSWERS,
    });
    return row ? this.toDomain(row) : null;
  }

  async withLock<T>(
    ownerUserId: string,
    attemptId: string,
    work: (attempt: Attempt) => T,
  ): Promise<{ attempt: Attempt; value: T } | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "simulai_service"."simulation_attempts"
        WHERE "id" = ${attemptId}::uuid AND "owner_user_id" = ${ownerUserId}::uuid
        FOR UPDATE`;
      if (locked.length === 0) return null;

      const row = await tx.simulationAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: WITH_ANSWERS,
      });
      const attempt = this.toDomain(row);
      const wasActive = attempt.isActive;
      const value = work(attempt);
      await this.persist(tx, attempt, wasActive);
      return { attempt, value };
    });
  }

  async attemptNumber(attempt: Attempt): Promise<number> {
    return this.prisma.simulationAttempt.count({
      where: { simulationId: attempt.simulationId, createdAt: { lte: attempt.createdAt } },
    });
  }

  async findOverdue(
    now: Date,
    limit: number,
  ): Promise<{ id: string; ownerUserId: string; simulationId: string }[]> {
    return this.prisma.simulationAttempt.findMany({
      where: { status: 'in_progress', expiresAt: { lte: now } },
      select: { id: true, ownerUserId: true, simulationId: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });
  }

  private async persist(tx: Tx, attempt: Attempt, wasActive: boolean): Promise<void> {
    if (attempt.changedAnswers.length > 0) {
      // A handful of answers per request; upserts keep PUT idempotent.
      for (const answer of attempt.changedAnswers) {
        await tx.attemptAnswer.upsert({
          where: {
            attemptId_simulationQuestionId: {
              attemptId: attempt.id,
              simulationQuestionId: answer.simulationQuestionId,
            },
          },
          create: {
            attemptId: attempt.id,
            simulationId: attempt.simulationId,
            simulationQuestionId: answer.simulationQuestionId,
            selectedOptionKey: answer.selectedOptionId,
            flagged: answer.flagged,
            answeredAt: answer.answeredAt,
          },
          update: {
            selectedOptionKey: answer.selectedOptionId,
            flagged: answer.flagged,
            answeredAt: answer.answeredAt,
          },
        });
      }
    }
    if (wasActive && !attempt.isActive) {
      const score = attempt.score!;
      await tx.simulationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: attempt.status,
          finishedAt: attempt.finishedAt,
          finishReason: attempt.finishReason,
          correctCount: score.correctCount,
          incorrectCount: score.incorrectCount,
          unansweredCount: score.unansweredCount,
          scorePercentage: score.scorePercentage,
        },
      });
    }
  }

  private toDomain(row: AttemptRow): Attempt {
    const answers = new Map<string, AttemptAnswer>(
      row.answers.map((answer) => [
        answer.simulationQuestionId,
        {
          simulationQuestionId: answer.simulationQuestionId,
          selectedOptionId: answer.selectedOptionKey,
          flagged: answer.flagged,
          answeredAt: answer.answeredAt,
        },
      ]),
    );
    return Attempt.reconstitute({
      id: row.id,
      simulationId: row.simulationId,
      ownerUserId: row.ownerUserId,
      status: row.status as AttemptStatus,
      startedAt: row.startedAt,
      expiresAt: row.expiresAt,
      finishedAt: row.finishedAt,
      finishReason: row.finishReason as FinishReason | null,
      score:
        row.scorePercentage === null
          ? null
          : {
              correctCount: row.correctCount ?? 0,
              incorrectCount: row.incorrectCount ?? 0,
              unansweredCount: row.unansweredCount ?? 0,
              scorePercentage: Number(row.scorePercentage),
            },
      answers,
      createdAt: row.createdAt,
    });
  }
}
