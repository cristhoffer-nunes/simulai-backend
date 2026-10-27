import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../../domain/simulation.repository';
import { SimulationView, toSimulationView } from '../dto/simulation-views';

export interface IGetSimulationUseCase {
  execute(userId: string, simulationId: string): Promise<Result<SimulationView, AppError>>;
}

export const GET_SIMULATION_USE_CASE = Symbol('GET_SIMULATION_USE_CASE');

@Injectable()
export class GetSimulationUseCase implements IGetSimulationUseCase {
  constructor(@Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository) {}

  async execute(userId: string, simulationId: string): Promise<Result<SimulationView, AppError>> {
    const simulation = await this.simulations.findOwned(userId, simulationId);
    return simulation
      ? Result.ok(toSimulationView(simulation))
      : Result.fail(ResourceErrors.notFound('Simulation'));
  }
}
