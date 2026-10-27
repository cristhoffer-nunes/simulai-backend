export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Frozen copy of a question as it was when the simulation was created (RN-013, RN-018).
 * Editing or archiving the original never changes it.
 */
export interface QuestionSnapshot {
  statement: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  difficulty: QuestionDifficulty;
}

export interface SimulationQuestion {
  /** simulation_questions.id: what attempts answer to. */
  id: string;
  position: number;
  sourceQuestionId: string | null;
  snapshot: QuestionSnapshot;
}
