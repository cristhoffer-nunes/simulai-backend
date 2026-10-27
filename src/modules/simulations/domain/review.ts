import { Result } from '../../../shared/result/result';
import { Attempt } from './attempt.entity';
import { NewSimulation, Simulation } from './simulation.entity';

export const MIN_REVIEW_SECONDS = 60;

/**
 * "Treinar só as erradas": a new simulation with the questions of a finished attempt that were
 * wrong or left blank, from the same frozen copies (what the student saw, even if the bank
 * question changed since). Same order as the exam; the timer keeps the same pace per question.
 */
export function reviewSimulationFrom(
  simulation: Simulation,
  attempt: Attempt,
): Result<NewSimulation, 'NOTHING_TO_REVIEW'> {
  const misses = [...simulation.questions]
    .sort((a, b) => a.position - b.position)
    .filter(
      (question) =>
        attempt.answers.get(question.id)?.selectedOptionId !== question.snapshot.correctOptionId,
    );
  if (misses.length === 0) return Result.fail('NOTHING_TO_REVIEW');

  const subjectIds: string[] = [];
  const perSubject: Record<string, number> = {};
  const subjectNames: Record<string, string> = {};
  for (const question of misses) {
    const { subjectId, subjectName } = question.snapshot;
    if (!(subjectId in perSubject)) subjectIds.push(subjectId);
    perSubject[subjectId] = (perSubject[subjectId] ?? 0) + 1;
    subjectNames[subjectId] = subjectName;
  }

  const duration =
    simulation.timed && simulation.durationSeconds
      ? Math.max(
          MIN_REVIEW_SECONDS,
          Math.round((simulation.durationSeconds * misses.length) / simulation.questionCount),
        )
      : null;

  return Result.ok({
    ownerUserId: simulation.ownerUserId,
    title: `Revisão: ${simulation.title}`.slice(0, 120),
    difficulty: simulation.difficulty,
    timed: duration !== null,
    durationSeconds: duration,
    configuration: {
      subjectIds,
      distribution: 'balanced',
      collectionId: null,
      perSubject,
      subjectNames,
    },
    picked: misses.map((question) => ({
      sourceQuestionId: question.sourceQuestionId,
      snapshot: question.snapshot,
    })),
  });
}
