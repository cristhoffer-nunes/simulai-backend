import { CreateReviewSimulationUseCase } from '@/modules/simulations/application/use-cases/create-review-simulation.use-case';
import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import { reviewSimulationFrom } from '@/modules/simulations/domain/review';
import { Simulation } from '@/modules/simulations/domain/simulation.entity';
import { buildSimulation, fakeSimulations, memoryAttempts, snapshot } from './helpers';

const past = (seconds: number) => new Date(Date.now() - seconds * 1000);

/** 4 questions, 2 subjects; keys A, B, A, B; 600 s. */
function mixed(timed = true) {
  return Simulation.create({
    ownerUserId: 'u1',
    title: 'Anatomia e Cardiologia',
    difficulty: 'medium',
    timed,
    durationSeconds: 600,
    configuration: {
      subjectIds: ['s1', 's2'],
      distribution: 'balanced',
      collectionId: null,
      perSubject: { s1: 2, s2: 2 },
      subjectNames: { s1: 'Anatomia', s2: 'Cardiologia' },
    },
    picked: [
      { sourceQuestionId: 'q1', snapshot: snapshot('s1', { correctOptionId: 'A' }) },
      { sourceQuestionId: 'q2', snapshot: snapshot('s2', { correctOptionId: 'B' }) },
      { sourceQuestionId: null, snapshot: snapshot('s1', { correctOptionId: 'A' }) },
      { sourceQuestionId: 'q4', snapshot: snapshot('s2', { correctOptionId: 'B' }) },
    ],
  });
}

describe('reviewSimulationFrom', () => {
  it('keeps wrong and blank questions, in exam order, at the same pace', () => {
    const simulation = mixed();
    const attempt = Attempt.start(simulation);
    const [q1, q2, q3] = simulation.questions;
    attempt.answer(simulation.questions, q1!.id, 'A'); // right
    attempt.answer(simulation.questions, q2!.id, 'A'); // wrong
    attempt.answer(simulation.questions, q3!.id, null); // blank (cleared)
    attempt.finish(simulation.questions, 'manual');
    const plan = reviewSimulationFrom(simulation, attempt).value;
    expect(plan.picked.map((item) => item.sourceQuestionId)).toEqual(['q2', null, 'q4']);
    expect(plan.picked[0]!.snapshot).toBe(q2!.snapshot);
    expect(plan.title).toBe('Revisão: Anatomia e Cardiologia');
    expect(plan.durationSeconds).toBe(450);
    expect(plan.timed).toBe(true);
    expect(plan.difficulty).toBe('medium');
    expect(plan.configuration).toEqual({
      subjectIds: ['s2', 's1'],
      distribution: 'balanced',
      collectionId: null,
      perSubject: { s2: 2, s1: 1 },
      subjectNames: { s2: 'Cardiologia', s1: 'Anatomia' },
    });
  });

  it('keeps at least one minute, stays untimed, and refuses when everything was right', () => {
    const one = buildSimulation(20, { durationSeconds: 600 });
    const attempt = Attempt.start(one);
    one.questions
      .slice(1)
      .forEach((question) =>
        attempt.answer(one.questions, question.id, question.snapshot.correctOptionId),
      );
    expect(reviewSimulationFrom(one, attempt).value.durationSeconds).toBe(60);

    const untimed = mixed(false);
    const free = Attempt.start(untimed);
    expect(reviewSimulationFrom(untimed, free).value).toEqual(
      expect.objectContaining({ timed: false, durationSeconds: null }),
    );

    const perfect = Attempt.start(untimed);
    untimed.questions.forEach((question) =>
      perfect.answer(untimed.questions, question.id, question.snapshot.correctOptionId),
    );
    expect(reviewSimulationFrom(untimed, perfect).error).toBe('NOTHING_TO_REVIEW');
  });
});

describe('CreateReviewSimulationUseCase', () => {
  function setup(started = new Date()) {
    const simulation = mixed();
    const attempt = Attempt.start(simulation, started);
    const { repo } = memoryAttempts([attempt]);
    const simulations = fakeSimulations(simulation);
    return {
      simulation,
      attempt,
      repo,
      simulations,
      useCase: new CreateReviewSimulationUseCase(simulations, repo),
    };
  }

  it('creates the review simulation once the attempt is over', async () => {
    const { simulation, attempt, simulations, useCase } = setup();
    expect((await useCase.execute('u1', attempt.id)).error.kind).toBe('ATTEMPT_IN_PROGRESS');
    attempt.finish(simulation.questions, 'manual');
    const view = (await useCase.execute('u1', attempt.id)).value;
    expect(view).toEqual(
      expect.objectContaining({ title: 'Revisão: Anatomia e Cardiologia', questionCount: 4 }),
    );
    expect(simulations.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(view)).not.toContain('correctOptionId');
  });

  it('closes an overdue attempt first; 404 for others; 409 when nothing is wrong', async () => {
    const overdue = setup(past(601));
    expect((await overdue.useCase.execute('u1', overdue.attempt.id)).isSuccess).toBe(true);
    expect(overdue.attempt.status).toBe('expired');

    const locked = setup(past(601));
    locked.repo.withLock.mockResolvedValueOnce(null);
    expect((await locked.useCase.execute('u1', locked.attempt.id)).error.kind).toBe(
      'ATTEMPT_IN_PROGRESS',
    );

    const other = setup();
    expect((await other.useCase.execute('u2', other.attempt.id)).error.kind).toBe('NOT_FOUND');
    const orphan = new CreateReviewSimulationUseCase(fakeSimulations(null), other.repo);
    expect((await orphan.execute('u1', other.attempt.id)).error.kind).toBe('NOT_FOUND');

    const perfect = setup();
    perfect.simulation.questions.forEach((question) =>
      perfect.attempt.answer(
        perfect.simulation.questions,
        question.id,
        question.snapshot.correctOptionId,
      ),
    );
    perfect.attempt.finish(perfect.simulation.questions, 'manual');
    expect((await perfect.useCase.execute('u1', perfect.attempt.id)).error.kind).toBe('CONFLICT');
  });
});
