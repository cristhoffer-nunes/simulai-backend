import { Result } from '../../../shared/result/result';

export interface SubjectAvailability {
  subjectId: string;
  available: number;
}

export interface Shortage {
  subjectId: string;
  required: number;
  available: number;
}

/**
 * Balanced distribution (RN-016): floor(N / subjects) each, the remainder going one by one to the
 * subjects in the order they were chosen (20 over 2 → 10/10; 10 over 3 → 4/3/3).
 * Never redistributes silently (RN-017): every subject short of questions is reported.
 */
export function balancedDistribution(
  subjects: SubjectAvailability[],
  questionCount: number,
): Result<Map<string, number>, Shortage[]> {
  const base = Math.floor(questionCount / subjects.length);
  const remainder = questionCount % subjects.length;
  const plan = new Map<string, number>();
  const shortages: Shortage[] = [];

  subjects.forEach((subject, order) => {
    const required = base + (order < remainder ? 1 : 0);
    plan.set(subject.subjectId, required);
    if (subject.available < required) {
      shortages.push({ subjectId: subject.subjectId, required, available: subject.available });
    }
  });

  return shortages.length > 0 ? Result.fail(shortages) : Result.ok(plan);
}

/** Fisher–Yates shuffle with an injectable random source (tests pass a fixed one). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}
