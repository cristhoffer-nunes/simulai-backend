import { toAnswerView } from '@/modules/simulations/application/dto/attempt-views';
import { ConfirmAnswerUseCase } from '@/modules/simulations/application/use-cases/confirm-answer.use-case';
import { CreateReviewSimulationUseCase } from '@/modules/simulations/application/use-cases/create-review-simulation.use-case';
import { CreateSimulationUseCase } from '@/modules/simulations/application/use-cases/create-simulation.use-case';
import { GetAttemptResultUseCase } from '@/modules/simulations/application/use-cases/get-attempt-result.use-case';
import { GetAttemptUseCase } from '@/modules/simulations/application/use-cases/get-attempt.use-case';
import { SaveAnswerUseCase } from '@/modules/simulations/application/use-cases/save-answer.use-case';
import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import { gradeQuestions } from '@/modules/simulations/domain/grading';
import { reviewSimulationFrom } from '@/modules/simulations/domain/review';
import { buildSimulation, fakePool, fakeSimulations, memoryAttempts, snapshot } from './helpers';

/** 4 questions with keys A, B, A, B; the first one has a source reference. */
function study() {
  const simulation = buildSimulation(4, { mode: 'study', timed: false, durationSeconds: null });
  return simulation;
}

function setup(simulation = study()) {
  const { rows, repo } = memoryAttempts();
  const attempt = Attempt.start(simulation);
  rows.set(attempt.id, attempt);
  return { simulation, simulations: fakeSimulations(simulation), attempts: repo, attempt };
}

describe('Study mode: domain', () => {
  it('a study session is never timed, even if asked', () => {
    const simulation = buildSimulation(2, { mode: 'study', timed: true, durationSeconds: 600 });
    expect(simulation.mode).toBe('study');
    expect(simulation.timed).toBe(false);
    expect(simulation.durationSeconds).toBeNull();
    expect(Attempt.start(simulation).expiresAt).toBeNull();
    expect(buildSimulation(2).mode).toBe('exam');
  });

  it('confirming locks the answer; the same option again is a no-op', () => {
    const simulation = study();
    const attempt = Attempt.start(simulation);
    const [q1, q2] = simulation.questions;
    const t = new Date('2026-10-30T12:00:00Z');

    const first = attempt.confirm(simulation.questions, q1!.id, 'B', t);
    expect(first.value).toEqual(expect.objectContaining({ selectedOptionId: 'B', confirmedAt: t }));
    expect(attempt.confirm(simulation.questions, q1!.id, 'B').value.confirmedAt).toBe(t);
    expect(attempt.confirm(simulation.questions, q1!.id, 'A').error).toBe('CONFIRMED');
    expect(attempt.answer(simulation.questions, q1!.id, 'A').error).toBe('CONFIRMED');
    expect(attempt.answer(simulation.questions, q1!.id, null).error).toBe('CONFIRMED');

    // Flagging keeps the lock; an unconfirmed mark can still be confirmed later.
    expect(attempt.flag(simulation.questions, q1!.id, true).value.confirmedAt).toBe(t);
    attempt.answer(simulation.questions, q2!.id, 'A');
    expect(attempt.answers.get(q2!.id)!.confirmedAt).toBeNull();
    expect(attempt.confirm(simulation.questions, q2!.id, 'B').value.selectedOptionId).toBe('B');

    expect(attempt.confirm(simulation.questions, 'nope', 'A').error).toBe('UNKNOWN_QUESTION');
    expect(attempt.confirm(simulation.questions, q2!.id, 'F').error).toBe('UNKNOWN_OPTION');
    attempt.finish(simulation.questions, 'manual');
    expect(attempt.confirm(simulation.questions, q2!.id, 'B').error).toBe('FINISHED');
    // q1: B (key A) wrong; q2: B (key B) right.
    expect(attempt.score).toEqual(
      expect.objectContaining({ correctCount: 1, incorrectCount: 1, unansweredCount: 2 }),
    );
  });

  it('feedback only for confirmed answers, with the source reference', () => {
    const question = {
      id: 'sq1',
      position: 1,
      sourceQuestionId: 'q1',
      snapshot: snapshot('s1', { correctOptionId: 'A', sourceReference: 'Capítulo 3' }),
    };
    const base = { simulationQuestionId: 'sq1', flagged: false, answeredAt: new Date() };
    expect(
      toAnswerView({ ...base, selectedOptionId: 'B', confirmedAt: null }, question).feedback,
    ).toBeNull();
    expect(
      toAnswerView({ ...base, selectedOptionId: 'B', confirmedAt: new Date() }, question),
    ).toEqual(
      expect.objectContaining({
        confirmed: true,
        feedback: {
          correct: false,
          correctOptionId: 'A',
          explanation: 'Porque sim.',
          sourceReference: 'Capítulo 3',
        },
      }),
    );
    // Copies made before sourceReference existed.
    expect(
      toAnswerView(
        { ...base, selectedOptionId: 'A', confirmedAt: new Date() },
        { ...question, snapshot: snapshot('s1', { correctOptionId: 'A' }) },
      ).feedback,
    ).toEqual(expect.objectContaining({ correct: true, sourceReference: null }));
    expect(
      toAnswerView({ ...base, selectedOptionId: 'A', confirmedAt: new Date() }, undefined),
    ).toEqual(expect.objectContaining({ confirmed: false, feedback: null }));
    expect(
      gradeQuestions(
        [{ ...question, snapshot: snapshot('s1', { sourceReference: 'p. 4' }) }],
        new Map(),
      )[0]!.sourceReference,
    ).toBe('p. 4');
  });

  it('review: all questions or only the misses, in either mode', () => {
    const simulation = buildSimulation(4); // exam, 600 s, keys A, B, A, B
    const attempt = Attempt.start(simulation);
    const [q1, q2] = simulation.questions;
    attempt.answer(simulation.questions, q1!.id, 'A'); // right
    attempt.answer(simulation.questions, q2!.id, 'A'); // wrong
    attempt.finish(simulation.questions, 'manual');

    const studyMisses = reviewSimulationFrom(simulation, attempt, {
      mode: 'study',
      questions: 'missed',
    }).value;
    expect(studyMisses).toEqual(
      expect.objectContaining({ mode: 'study', timed: false, durationSeconds: null }),
    );
    expect(studyMisses.picked).toHaveLength(3);
    expect(studyMisses.title).toBe('Revisão: Anatomia');

    const examAll = reviewSimulationFrom(simulation, attempt, {
      mode: 'exam',
      questions: 'all',
    }).value;
    expect(examAll).toEqual(
      expect.objectContaining({
        mode: 'exam',
        timed: true,
        durationSeconds: 600,
        title: 'Anatomia',
      }),
    );
    expect(examAll.picked).toHaveLength(4);
  });
});

describe('ConfirmAnswerUseCase', () => {
  it('locks the answer and returns its grading', async () => {
    const { simulation, simulations, attempts, attempt } = setup();
    const useCase = new ConfirmAnswerUseCase(simulations, attempts);
    const q1 = simulation.questions[0]!;
    const input = { userId: 'u1', attemptId: attempt.id, questionId: q1.id, selectedOptionId: 'B' };

    const result = await useCase.execute(input);
    expect(result.value).toEqual(
      expect.objectContaining({
        questionId: q1.id,
        selectedOptionId: 'B',
        confirmed: true,
        feedback: expect.objectContaining({ correct: false, correctOptionId: 'A' }),
      }),
    );
    // Retried request: same answer, same result.
    expect((await useCase.execute(input)).value.feedback!.correct).toBe(false);
    expect((await useCase.execute({ ...input, selectedOptionId: 'A' })).error.kind).toBe(
      'ANSWER_CONFIRMED',
    );
    expect((await useCase.execute({ ...input, questionId: 'nope' })).error.kind).toBe('NOT_FOUND');
    expect((await useCase.execute({ ...input, selectedOptionId: 'F' })).error.kind).toBe(
      'VALIDATION_ERROR',
    );

    // The plain save also refuses to change it.
    const save = new SaveAnswerUseCase(simulations, attempts);
    expect((await save.execute({ ...input, selectedOptionId: 'A' })).error.kind).toBe(
      'ANSWER_CONFIRMED',
    );

    attempt.finish(simulation.questions, 'manual');
    expect(
      (await useCase.execute({ ...input, questionId: simulation.questions[1]!.id })).error.kind,
    ).toBe('ATTEMPT_FINISHED');
  });

  it('only in study mode, only for the owner', async () => {
    const exam = setup(buildSimulation(2));
    const input = {
      userId: 'u1',
      attemptId: exam.attempt.id,
      questionId: exam.simulation.questions[0]!.id,
      selectedOptionId: 'A',
    };
    expect(
      (await new ConfirmAnswerUseCase(exam.simulations, exam.attempts).execute(input)).error.kind,
    ).toBe('NOT_STUDY_MODE');

    const { simulations, attempts, attempt } = setup();
    const useCase = new ConfirmAnswerUseCase(simulations, attempts);
    expect(
      (await useCase.execute({ ...input, userId: 'u2', attemptId: attempt.id })).error.kind,
    ).toBe('NOT_FOUND');
    expect(
      (
        await new ConfirmAnswerUseCase(fakeSimulations(null), attempts).execute({
          ...input,
          attemptId: attempt.id,
        })
      ).error.kind,
    ).toBe('NOT_FOUND');
    attempts.withLock.mockResolvedValueOnce(null);
    expect((await useCase.execute({ ...input, attemptId: attempt.id })).error.kind).toBe(
      'NOT_FOUND',
    );
  });

  it('reopening the session brings the feedback of confirmed answers only', async () => {
    const { simulation, simulations, attempts, attempt } = setup();
    const [q1, q2] = simulation.questions;
    attempt.confirm(simulation.questions, q1!.id, 'A');
    attempt.answer(simulation.questions, q2!.id, 'A');
    const view = (await new GetAttemptUseCase(simulations, attempts).execute('u1', attempt.id))
      .value;
    expect(view.mode).toBe('study');
    const byId = new Map(view.answers.map((answer) => [answer.questionId, answer]));
    expect(byId.get(q1!.id)).toEqual(
      expect.objectContaining({
        confirmed: true,
        feedback: expect.objectContaining({ correct: true }),
      }),
    );
    expect(byId.get(q2!.id)).toEqual(expect.objectContaining({ confirmed: false, feedback: null }));
    // The key of the unconfirmed question (B) is not in the payload.
    expect(view.questions.some((question) => 'correctOptionId' in question)).toBe(false);
  });

  it('the result says which mode it was', async () => {
    const { simulation, simulations, attempts, attempt } = setup();
    attempt.confirm(simulation.questions, simulation.questions[0]!.id, 'A');
    attempt.finish(simulation.questions, 'manual');
    const stats = {
      attemptCount: jest.fn().mockResolvedValue(1),
      previousFinished: jest.fn().mockResolvedValue(null),
      subjectTotals: jest.fn().mockResolvedValue(new Map()),
    };
    const result = await new GetAttemptResultUseCase(simulations, attempts, stats as never).execute(
      'u1',
      attempt.id,
    );
    expect(result.value.mode).toBe('study');
  });
});

describe('Creating study sessions', () => {
  it('stores the mode and refuses a timer', async () => {
    const simulations = fakeSimulations();
    const useCase = new CreateSimulationUseCase(fakePool(), simulations);
    const base = {
      userId: 'u1',
      questionCount: 4,
      subjectIds: ['s1'],
      difficulty: 'all' as const,
      distribution: 'balanced' as const,
    };
    const created = await useCase.execute({ ...base, mode: 'study', timed: false });
    expect(created.value).toEqual(expect.objectContaining({ mode: 'study', timed: false }));
    const refused = await useCase.execute({
      ...base,
      mode: 'study',
      timed: true,
      durationSeconds: 600,
    });
    expect(refused.error.details).toEqual([
      expect.objectContaining({ path: 'timed', code: 'NOT_ALLOWED' }),
    ]);
    expect((await useCase.execute({ ...base, timed: false })).value.mode).toBe('exam');
  });

  it('"Estudar só as erradas" keeps the study mode; "Fazer em modo prova" takes all of them', async () => {
    const { simulation, simulations, attempts, attempt } = setup();
    attempt.confirm(simulation.questions, simulation.questions[0]!.id, 'A');
    attempt.finish(simulation.questions, 'manual');
    const useCase = new CreateReviewSimulationUseCase(simulations, attempts);
    const misses = await useCase.execute('u1', attempt.id);
    expect(misses.value).toEqual(expect.objectContaining({ mode: 'study', questionCount: 3 }));
    const exam = await useCase.execute('u1', attempt.id, { mode: 'exam', questions: 'all' });
    expect(exam.value).toEqual(
      expect.objectContaining({ mode: 'exam', questionCount: 4, timed: false }),
    );
  });
});
