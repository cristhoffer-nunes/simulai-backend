import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  Simulation,
  SimulationConfiguration,
  SimulationDifficulty,
  SimulationMode,
  SimulationStatus,
} from '../domain/simulation.entity';
import {
  ISimulationRepository,
  SimulationListItem,
  SimulationPage,
} from '../domain/simulation.repository';
import { QuestionSnapshot } from '../domain/snapshot';

@Injectable()
export class PrismaSimulationRepository implements ISimulationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(simulation: Simulation): Promise<void> {
    // One statement for the simulation and one for all its snapshots (SIM-02, one transaction).
    await this.prisma.simulation.create({
      data: {
        id: simulation.id,
        ownerUserId: simulation.ownerUserId,
        title: simulation.title,
        mode: simulation.mode,
        status: simulation.status,
        questionCount: simulation.questionCount,
        difficulty: simulation.difficulty,
        timed: simulation.timed,
        durationSeconds: simulation.durationSeconds,
        configuration: simulation.configuration as unknown as Prisma.InputJsonValue,
        createdAt: simulation.createdAt,
        questions: {
          createMany: {
            data: simulation.questions.map((question) => ({
              id: question.id,
              position: question.position,
              sourceQuestionId: question.sourceQuestionId,
              snapshot: question.snapshot as unknown as Prisma.InputJsonValue,
            })),
          },
        },
      },
    });
  }

  async findOwned(ownerUserId: string, simulationId: string): Promise<Simulation | null> {
    const row = await this.prisma.simulation.findFirst({
      where: { id: simulationId, ownerUserId },
      include: { questions: { orderBy: { position: 'asc' } } },
    });
    if (!row) return null;
    return Simulation.reconstitute({
      id: row.id,
      ownerUserId: row.ownerUserId,
      title: row.title,
      mode: row.mode as SimulationMode,
      status: row.status as SimulationStatus,
      difficulty: row.difficulty as SimulationDifficulty,
      timed: row.timed,
      durationSeconds: row.durationSeconds,
      configuration: row.configuration as unknown as SimulationConfiguration,
      questions: row.questions.map((question) => ({
        id: question.id,
        position: question.position,
        sourceQuestionId: question.sourceQuestionId,
        snapshot: question.snapshot as unknown as QuestionSnapshot,
      })),
      createdAt: row.createdAt,
    });
  }

  async saveStatus(simulation: Simulation): Promise<void> {
    await this.prisma.simulation.update({
      where: { id: simulation.id },
      data: { status: simulation.status },
    });
  }

  async list(
    ownerUserId: string,
    options: { status?: SimulationStatus; after?: { createdAt: Date; id: string }; limit: number },
  ): Promise<SimulationPage> {
    const where: Prisma.SimulationWhereInput = {
      ownerUserId,
      ...(options.status ? { status: options.status } : {}),
    };
    const after: Prisma.SimulationWhereInput = options.after
      ? {
          OR: [
            { createdAt: { lt: options.after.createdAt } },
            { createdAt: options.after.createdAt, id: { lt: options.after.id } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.simulation.findMany({
        where: { AND: [where, after] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: options.limit + 1,
      }),
      this.prisma.simulation.count({ where }),
    ]);
    const page = rows.slice(0, options.limit);
    const attempts = page.length
      ? await this.prisma.simulationAttempt.findMany({
          where: { ownerUserId, simulationId: { in: page.map((row) => row.id) } },
          select: {
            id: true,
            simulationId: true,
            status: true,
            finishedAt: true,
            scorePercentage: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const items: SimulationListItem[] = page.map((row) => {
      const own = attempts.filter((attempt) => attempt.simulationId === row.id);
      const lastFinished = own.find((attempt) => attempt.status !== 'in_progress');
      const configuration = row.configuration as unknown as SimulationConfiguration;
      return {
        id: row.id,
        title: row.title,
        mode: row.mode as SimulationMode,
        status: row.status as SimulationStatus,
        difficulty: row.difficulty as SimulationDifficulty,
        questionCount: row.questionCount,
        timed: row.timed,
        durationSeconds: row.durationSeconds,
        subjectNames: configuration.subjectIds.map((id) => configuration.subjectNames?.[id] ?? ''),
        createdAt: row.createdAt,
        attemptCount: own.length,
        activeAttemptId: own.find((attempt) => attempt.status === 'in_progress')?.id ?? null,
        lastScore: lastFinished?.scorePercentage ? Number(lastFinished.scorePercentage) : null,
        lastFinishedAt: lastFinished?.finishedAt ?? null,
      };
    });

    return { items, total, hasMore: rows.length > options.limit };
  }
}
