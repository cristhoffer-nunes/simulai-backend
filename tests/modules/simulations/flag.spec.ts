import { gradeQuestions } from '@/modules/simulations/domain/grading';
import { SaveAnswerUseCase } from '@/modules/simulations/application/use-cases/save-answer.use-case';
import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import { PrismaAttemptRepository } from '@/modules/simulations/infrastructure/prisma-attempt.repository';
import { buildSimulation, fakeSimulations, memoryAttempts } from './helpers';

const past = (seconds: number) => new Date(Date.now() - seconds * 1000);

describe('Attempt.flag ("Revisar depois")', () => {
  const simulation = buildSimulation(3);
  const [q1, q2] = simulation.questions.map((question) => question.id);

  it('flags without a mark and keeps the mark when flagging later', () => {
    const attempt = Attempt.start(simulation);
    expect(attempt.flag(simulation.questions, q1!, true).value).toEqual(
      expect.objectContaining({ selectedOptionId: null, flagged: true }),
    );
    attempt.answer(simulation.questions, q2!, 'B');
    const flagged = attempt.flag(simulation.questions, q2!, true).value;
    expect(flagged).toEqual(expect.objectContaining({ selectedOptionId: 'B', flagged: true }));
    // Changing the mark keeps the flag; unflagging keeps the mark.
    expect(attempt.answer(simulation.questions, q2!, 'A').value.flagged).toBe(true);
    expect(attempt.flag(simulation.questions, q2!, false).value.selectedOptionId).toBe('A');
    expect(attempt.changedAnswers.map((answer) => answer.simulationQuestionId)).toEqual([q1, q2]);
  });

  it('never changes the score', () => {
    const attempt = Attempt.start(simulation);
    attempt.flag(simulation.questions, q1!, true);
    attempt.finish(simulation.questions, 'manual');
    expect(attempt.score).toEqual(expect.objectContaining({ correctCount: 0, unansweredCount: 3 }));
  });

  it('follows the same rules as answering', () => {
    const attempt = Attempt.start(simulation, past(601));
    expect(attempt.flag(simulation.questions, q1!, true).error).toBe('DEADLINE_PASSED');
    const running = Attempt.start(simulation);
    expect(running.flag(simulation.questions, 'nope', true).error).toBe('UNKNOWN_QUESTION');
    running.finish(simulation.questions, 'manual');
    expect(running.flag(simulation.questions, q1!, true).error).toBe('FINISHED');
  });
});

describe('SaveAnswerUseCase with flags', () => {
  function setup(started = new Date()) {
    const simulation = buildSimulation(3);
    const attempt = Attempt.start(simulation, started);
    const { repo } = memoryAttempts([attempt]);
    return {
      simulation,
      attempt,
      useCase: new SaveAnswerUseCase(fakeSimulations(simulation), repo),
    };
  }

  it('saves the flag alone, the mark alone, or both at once', async () => {
    const { simulation, attempt, useCase } = setup();
    const base = { userId: 'u1', attemptId: attempt.id, questionId: simulation.questions[0]!.id };
    expect((await useCase.execute({ ...base, flagged: true })).value).toEqual(
      expect.objectContaining({ selectedOptionId: null, flagged: true }),
    );
    expect((await useCase.execute({ ...base, selectedOptionId: 'A' })).value).toEqual(
      expect.objectContaining({ selectedOptionId: 'A', flagged: true }),
    );
    expect(
      (await useCase.execute({ ...base, selectedOptionId: 'B', flagged: false })).value,
    ).toEqual(expect.objectContaining({ selectedOptionId: 'B', flagged: false }));
  });

  it('needs at least one field, refuses a bad option before flagging, and closes late attempts', async () => {
    const { simulation, attempt, useCase } = setup();
    const base = { userId: 'u1', attemptId: attempt.id, questionId: simulation.questions[0]!.id };
    expect((await useCase.execute(base)).error.kind).toBe('VALIDATION_ERROR');
    expect(
      (await useCase.execute({ ...base, selectedOptionId: 'F', flagged: true })).error.kind,
    ).toBe('VALIDATION_ERROR');
    expect(attempt.answers.size).toBe(0);

    const late = setup(past(601));
    const result = await late.useCase.execute({
      userId: 'u1',
      attemptId: late.attempt.id,
      questionId: late.simulation.questions[0]!.id,
      flagged: true,
    });
    expect(result.error.kind).toBe('ATTEMPT_FINISHED');
    expect(late.attempt.status).toBe('expired');
  });
});

describe('PrismaAttemptRepository flags', () => {
  it('stores and reads the flag', async () => {
    const at = new Date('2026-10-27T10:00:00Z');
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      simulationAttempt: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'a1',
          simulationId: 'sim1',
          ownerUserId: 'u1',
          status: 'in_progress',
          startedAt: at,
          expiresAt: null,
          finishedAt: null,
          finishReason: null,
          correctCount: null,
          incorrectCount: null,
          unansweredCount: null,
          scorePercentage: null,
          createdAt: at,
          answers: [
            { simulationQuestionId: 'sq1', selectedOptionKey: null, flagged: true, answeredAt: at },
          ],
        }),
        update: jest.fn(),
      },
      attemptAnswer: { upsert: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const repo = new PrismaAttemptRepository(prisma as never);
    const simulation = buildSimulation(2);
    const result = await repo.withLock('u1', 'a1', (attempt) => {
      expect(attempt.answers.get('sq1')?.flagged).toBe(true);
      return attempt.flag(simulation.questions, simulation.questions[1]!.id, true).isSuccess;
    });
    expect(result?.value).toBe(true);
    expect(tx.attemptAnswer.upsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        create: expect.objectContaining({ flagged: true, selectedOptionKey: null }),
        update: expect.objectContaining({ flagged: true }),
      }),
    );
  });
});

describe('grading keeps the flag', () => {
  it('shows which questions were marked to review', () => {
    const simulation = buildSimulation(2);
    const attempt = Attempt.start(simulation);
    attempt.flag(simulation.questions, simulation.questions[1]!.id, true);
    const graded = gradeQuestions(simulation.questions, attempt.answers);
    expect(graded.map((question: { flagged: boolean }) => question.flagged)).toEqual([false, true]);
  });
});
