import { Simulation, SimulationDifficulty, SimulationStatus } from './simulation.entity';

export interface SimulationListItem {
  id: string;
  title: string;
  status: SimulationStatus;
  difficulty: SimulationDifficulty;
  questionCount: number;
  timed: boolean;
  durationSeconds: number | null;
  subjectNames: string[];
  createdAt: Date;
  attemptCount: number;
  activeAttemptId: string | null;
  lastScore: number | null;
  lastFinishedAt: Date | null;
}

export interface SimulationPage {
  items: SimulationListItem[];
  total: number;
  hasMore: boolean;
}

export interface ISimulationRepository {
  /** Simulation + all its snapshots in one transaction. */
  create(simulation: Simulation): Promise<void>;
  findOwned(ownerUserId: string, simulationId: string): Promise<Simulation | null>;
  saveStatus(simulation: Simulation): Promise<void>;
  list(
    ownerUserId: string,
    options: { status?: SimulationStatus; after?: { createdAt: Date; id: string }; limit: number },
  ): Promise<SimulationPage>;
}

export const SIMULATION_REPOSITORY = Symbol('SIMULATION_REPOSITORY');
