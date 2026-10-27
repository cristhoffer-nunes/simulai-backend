import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { decodeCursor, encodeCursor } from '../../../../shared/pagination/cursor';
import { Result } from '../../../../shared/result/result';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import {
  AttemptHistoryItem,
  HistoryStatus,
  IPerformanceQuery,
  PERFORMANCE_QUERY,
} from '../ports/performance-query.port';

export interface ListAttemptsInput {
  userId: string;
  status?: HistoryStatus;
  simulationId?: string;
  cursor?: string;
  limit?: number;
}

export interface AttemptHistoryResponse {
  items: AttemptHistoryItem[];
  total: number;
  nextCursor: string | null;
}

export interface IListAttemptsUseCase {
  execute(input: ListAttemptsInput): Promise<Result<AttemptHistoryResponse, AppError>>;
}

export const LIST_ATTEMPTS_USE_CASE = Symbol('LIST_ATTEMPTS_USE_CASE');

/** RES-02: the student's attempts, newest first, optionally of one simulation. */
@Injectable()
export class ListAttemptsUseCase implements IListAttemptsUseCase {
  constructor(
    @Inject(PERFORMANCE_QUERY) private readonly performance: IPerformanceQuery,
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
  ) {}

  async execute(input: ListAttemptsInput): Promise<Result<AttemptHistoryResponse, AppError>> {
    const after = input.cursor ? decodeCursor(input.cursor) : undefined;
    if (after === null) {
      return Result.fail(
        AppError.validation('Invalid cursor.', [
          { path: 'cursor', code: 'INVALID_CURSOR', message: 'Invalid cursor.' },
        ]),
      );
    }
    if (
      input.simulationId &&
      !(await this.simulations.findOwned(input.userId, input.simulationId))
    ) {
      return Result.fail(ResourceErrors.notFound('Simulation'));
    }
    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 20)));
    const page = await this.performance.history(input.userId, {
      status: input.status,
      simulationId: input.simulationId,
      after,
      limit,
    });
    const last = page.items[page.items.length - 1];
    return Result.ok({
      items: page.items,
      total: page.total,
      nextCursor:
        page.hasMore && last
          ? encodeCursor({ createdAt: last.createdAt, id: last.attemptId })
          : null,
    });
  }
}
