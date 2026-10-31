import { Simulation, SimulationMode } from '../../domain/simulation.entity';
import { SimulationListItem } from '../../domain/simulation.repository';

/** Simulation metadata — never the answer key (RN-019). */
export interface SimulationView {
  id: string;
  title: string;
  mode: SimulationMode;
  status: string;
  difficulty: string;
  questionCount: number;
  timed: boolean;
  durationSeconds: number | null;
  distribution: { subjectId: string; subjectName: string; questionCount: number }[];
  collectionId: string | null;
  createdAt: Date;
}

export function toSimulationView(simulation: Simulation): SimulationView {
  return {
    id: simulation.id,
    title: simulation.title,
    mode: simulation.mode,
    status: simulation.status,
    difficulty: simulation.difficulty,
    questionCount: simulation.questionCount,
    timed: simulation.timed,
    durationSeconds: simulation.durationSeconds,
    distribution: simulation.configuration.subjectIds.map((subjectId) => ({
      subjectId,
      subjectName: simulation.configuration.subjectNames[subjectId] ?? '',
      questionCount: simulation.configuration.perSubject[subjectId] ?? 0,
    })),
    collectionId: simulation.configuration.collectionId,
    createdAt: simulation.createdAt,
  };
}

export interface SimulationListResponse {
  items: SimulationListItem[];
  total: number;
  nextCursor: string | null;
}
