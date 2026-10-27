import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { SimulationStatus } from '../../domain/simulation.entity';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { SimulationView, toSimulationView } from '../dto/simulation-views';

export interface ISetSimulationStatusUseCase {
  execute(
    userId: string,
    simulationId: string,
    status: SimulationStatus,
  ): Promise<Result<SimulationView, AppError>>;
}

export const SET_SIMULATION_STATUS_USE_CASE = Symbol('SET_SIMULATION_STATUS_USE_CASE');

/** ready ↔ archived. Archiving keeps every attempt and result. */
@Injectable()
export class SetSimulationStatusUseCase implements ISetSimulationStatusUseCase {
  constructor(@Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository) {}

  async execute(
    userId: string,
    simulationId: string,
    status: SimulationStatus,
  ): Promise<Result<SimulationView, AppError>> {
    const simulation = await this.simulations.findOwned(userId, simulationId);
    if (!simulation) return Result.fail(ResourceErrors.notFound('Simulation'));
    if (status === 'archived') simulation.archive();
    else simulation.restore();
    await this.simulations.saveStatus(simulation);
    return Result.ok(toSimulationView(simulation));
  }
}
