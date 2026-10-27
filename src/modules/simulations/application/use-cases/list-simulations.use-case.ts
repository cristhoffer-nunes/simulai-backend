import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { decodeCursor, encodeCursor } from '../../../../shared/pagination/cursor';
import { SimulationStatus } from '../../domain/simulation.entity';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { SimulationListResponse } from '../dto/simulation-views';

export interface ListSimulationsInput {
  userId: string;
  status?: SimulationStatus;
  cursor?: string;
  limit?: number;
}

export interface IListSimulationsUseCase {
  execute(input: ListSimulationsInput): Promise<Result<SimulationListResponse, AppError>>;
}

export const LIST_SIMULATIONS_USE_CASE = Symbol('LIST_SIMULATIONS_USE_CASE');

@Injectable()
export class ListSimulationsUseCase implements IListSimulationsUseCase {
  constructor(@Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository) {}

  async execute(input: ListSimulationsInput): Promise<Result<SimulationListResponse, AppError>> {
    const after = input.cursor ? decodeCursor(input.cursor) : undefined;
    if (after === null) {
      return Result.fail(
        AppError.validation('Invalid cursor.', [
          { path: 'cursor', code: 'INVALID_CURSOR', message: 'Invalid cursor.' },
        ]),
      );
    }
    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 20)));
    const page = await this.simulations.list(input.userId, {
      status: input.status ?? 'ready',
      after,
      limit,
    });
    const last = page.items[page.items.length - 1];
    return Result.ok({
      items: page.items,
      total: page.total,
      nextCursor: page.hasMore && last ? encodeCursor(last) : null,
    });
  }
}
