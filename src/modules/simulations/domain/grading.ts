import { AttemptAnswer } from './attempt.entity';
import { QuestionDifficulty, SimulationQuestion } from './snapshot';

export type Verdict = 'correct' | 'incorrect' | 'blank';

/** A question after the attempt is over: the answer key and explanation are now visible. */
export interface GradedQuestion {
  id: string;
  position: number;
  statement: string;
  options: { id: string; text: string }[];
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  difficulty: QuestionDifficulty;
  selectedOptionId: string | null;
  correctOptionId: string;
  explanation: string;
  verdict: Verdict;
}

export interface SubjectScore {
  subjectId: string;
  subjectName: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  scorePercentage: number;
}

export function percentOf(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 10_000) / 100;
}

export function verdictOf(selected: string | null, correct: string): Verdict {
  if (selected === null) return 'blank';
  return selected === correct ? 'correct' : 'incorrect';
}

/** Grades every question of a finished attempt, in exam order. */
export function gradeQuestions(
  questions: readonly SimulationQuestion[],
  answers: ReadonlyMap<string, AttemptAnswer>,
): GradedQuestion[] {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .map((question) => {
      const { snapshot } = question;
      const selectedOptionId = answers.get(question.id)?.selectedOptionId ?? null;
      return {
        id: question.id,
        position: question.position,
        statement: snapshot.statement,
        options: snapshot.options.map((option) => ({ id: option.id, text: option.text })),
        subjectId: snapshot.subjectId,
        subjectName: snapshot.subjectName,
        topicId: snapshot.topicId,
        topicName: snapshot.topicName,
        difficulty: snapshot.difficulty,
        selectedOptionId,
        correctOptionId: snapshot.correctOptionId,
        explanation: snapshot.explanation,
        verdict: verdictOf(selectedOptionId, snapshot.correctOptionId),
      };
    });
}

/** Score per subject, in the order subjects first appear in the exam. */
export function scoreBySubject(graded: readonly GradedQuestion[]): SubjectScore[] {
  const bySubject = new Map<string, SubjectScore>();
  for (const question of graded) {
    const entry = bySubject.get(question.subjectId) ?? {
      subjectId: question.subjectId,
      subjectName: question.subjectName,
      total: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      scorePercentage: 0,
    };
    entry.total += 1;
    if (question.verdict === 'correct') entry.correct += 1;
    else if (question.verdict === 'incorrect') entry.incorrect += 1;
    else entry.unanswered += 1;
    bySubject.set(question.subjectId, entry);
  }
  return [...bySubject.values()].map((entry) => ({
    ...entry,
    scorePercentage: percentOf(entry.correct, entry.total),
  }));
}
