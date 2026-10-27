import { AttemptExpiryService } from '@/modules/simulations/application/attempt-expiry.service';
import { FinishAttemptUseCase } from '@/modules/simulations/application/use-cases/finish-attempt.use-case';
import { GetAttemptUseCase } from '@/modules/simulations/application/use-cases/get-attempt.use-case';
import { SaveAnswerUseCase } from '@/modules/simulations/application/use-cases/save-answer.use-case';
import { StartAttemptUseCase } from '@/modules/simulations/application/use-cases/start-attempt.use-case';
import { Attempt } from '@/modules/simulations/domain/attempt.entity';
import { buildSimulation, fakeSimulations, memoryAttempts } from './helpers';

const past = (seconds: number) => new Date(Date.now() - seconds * 1000);

function setup(options: { timed?: boolean; archived?: boolean } = {}) {
  const simulation = buildSimulation(4, { timed: options.timed ?? true, durationSeconds: 600 });
  if (options.archived) simulation.archive();
  const simulations = fakeSimulations(simulation);
  const { rows, repo } = memoryAttempts();
  return { simulation, simulations, rows, attempts: repo };
}

describe('StartAttemptUseCase', () => {
  it('starts a timed attempt with server times', async () => {
    const { simulation, simulations, attempts } = setup();
    const result = await new StartAttemptUseCase(simulations, attempts).execute(
      'u1',
      simulation.id,
    );
    const value = result.value;
    expect(value.status).toBe('in_progress');
    expect(value.totalQuestions).toBe(4);
    expect(value.expiresAt!.getTime() - value.startedAt.getTime()).toBe(600_000);
    expect(value.serverNow).toBeInstanceOf(Date);
  });

  it('refuses a second active attempt (409 with its id) and archived simulations', async () => {
    const { simulation, simulations, attempts } = setup();
    const useCase = new StartAttemptUseCase(simulations, attempts);
    const first = await useCase.execute('u1', simulation.id);
    const second = await useCase.execute('u1', simulation.id);
    expect(second.error.kind).toBe('ATTEMPT_ALREADY_ACTIVE');
    expect(second.error.details).toEqual({ attemptId: first.value.id });

    const archived = setup({ archived: true });
    expect(
      (
        await new StartAttemptUseCase(archived.simulations, archived.attempts).execute(
          'u1',
          archived.simulation.id,
        )
      ).error.kind,
    ).toBe('SIMULATION_ARCHIVED');
    expect(
      (await new StartAttemptUseCase(fakeSimulations(null), attempts).execute('u1', 'x')).error
        .kind,
    ).toBe('NOT_FOUND');
  });

  it('closes an active attempt whose time ran out, then starts a new one', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const old = Attempt.start(simulation, past(700));
    rows.set(old.id, old);
    const result = await new StartAttemptUseCase(simulations, attempts).execute(
      'u1',
      simulation.id,
    );
    expect(result.isSuccess).toBe(true);
    expect(old.status).toBe('expired');
  });

  it('reports the winner when two starts race', async () => {
    const { simulation, simulations, attempts } = setup();
    const winner = Attempt.start(simulation);
    attempts.create.mockResolvedValueOnce(false);
    attempts.findActive.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    const result = await new StartAttemptUseCase(simulations, attempts).execute(
      'u1',
      simulation.id,
    );
    expect(result.error.details).toEqual({ attemptId: winner.id });

    attempts.create.mockResolvedValueOnce(false);
    attempts.findActive.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect(
      (await new StartAttemptUseCase(simulations, attempts).execute('u1', simulation.id)).error
        .details,
    ).toEqual({ attemptId: '' });
  });
});

describe('GetAttemptUseCase', () => {
  it('returns the exam without answer key or explanation', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation);
    attempt.answer(simulation.questions, simulation.questions[0]!.id, 'B');
    rows.set(attempt.id, attempt);
    const view = (await new GetAttemptUseCase(simulations, attempts).execute('u1', attempt.id))
      .value;
    expect(view.questions).toHaveLength(4);
    expect(view.answers).toEqual([
      expect.objectContaining({ questionId: simulation.questions[0]!.id, selectedOptionId: 'B' }),
    ]);
    const json = JSON.stringify(view);
    expect(json).not.toContain('correctOptionId');
    expect(json).not.toContain('Porque sim.');
    expect(view.result).toBeNull();
    expect(view.attemptNumber).toBe(1);
  });

  it('closes an overdue attempt when it is opened', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation, past(601));
    rows.set(attempt.id, attempt);
    const view = (await new GetAttemptUseCase(simulations, attempts).execute('u1', attempt.id))
      .value;
    expect(view.status).toBe('expired');
    expect(view.result).toEqual(
      expect.objectContaining({ unansweredCount: 4, scorePercentage: 0 }),
    );
  });

  it('404 for other students and missing simulations', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation);
    rows.set(attempt.id, attempt);
    expect(
      (await new GetAttemptUseCase(simulations, attempts).execute('u2', attempt.id)).error.kind,
    ).toBe('NOT_FOUND');
    expect(
      (await new GetAttemptUseCase(fakeSimulations(null), attempts).execute('u1', attempt.id)).error
        .kind,
    ).toBe('NOT_FOUND');
    attempts.withLock.mockResolvedValueOnce(null);
    const overdue = Attempt.start(simulation, past(601));
    rows.set(overdue.id, overdue);
    expect(
      (await new GetAttemptUseCase(simulations, attempts).execute('u1', overdue.id)).value.status,
    ).toBe('in_progress');
  });
});

describe('SaveAnswerUseCase', () => {
  it('saves and clears marks', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation);
    rows.set(attempt.id, attempt);
    const useCase = new SaveAnswerUseCase(simulations, attempts);
    const questionId = simulation.questions[1]!.id;
    const saved = await useCase.execute({
      userId: 'u1',
      attemptId: attempt.id,
      questionId,
      selectedOptionId: 'A',
    });
    expect(saved.value).toEqual(expect.objectContaining({ questionId, selectedOptionId: 'A' }));
    const cleared = await useCase.execute({
      userId: 'u1',
      attemptId: attempt.id,
      questionId,
      selectedOptionId: null,
    });
    expect(cleared.value.selectedOptionId).toBeNull();
  });

  it('refuses late answers and closes the attempt as a timeout', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation, past(601));
    rows.set(attempt.id, attempt);
    const result = await new SaveAnswerUseCase(simulations, attempts).execute({
      userId: 'u1',
      attemptId: attempt.id,
      questionId: simulation.questions[0]!.id,
      selectedOptionId: 'A',
    });
    expect(result.error.kind).toBe('ATTEMPT_FINISHED');
    expect(result.error.details).toEqual({ status: 'expired' });
    expect(attempt.status).toBe('expired');
  });

  it('maps unknown question, unknown option, finished and foreign attempts', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation);
    rows.set(attempt.id, attempt);
    const useCase = new SaveAnswerUseCase(simulations, attempts);
    const base = {
      userId: 'u1',
      attemptId: attempt.id,
      questionId: simulation.questions[0]!.id,
      selectedOptionId: 'A',
    };
    expect((await useCase.execute({ ...base, questionId: 'other' })).error.kind).toBe('NOT_FOUND');
    expect((await useCase.execute({ ...base, selectedOptionId: 'E' })).error.kind).toBe(
      'VALIDATION_ERROR',
    );
    attempt.finish(simulation.questions, 'manual');
    expect((await useCase.execute(base)).error.kind).toBe('ATTEMPT_FINISHED');
    expect((await useCase.execute({ ...base, userId: 'u2' })).error.kind).toBe('NOT_FOUND');
    expect(
      (await new SaveAnswerUseCase(fakeSimulations(null), attempts).execute(base)).error.kind,
    ).toBe('NOT_FOUND');
    attempts.withLock.mockResolvedValueOnce(null);
    expect((await useCase.execute(base)).error.kind).toBe('NOT_FOUND');
  });
});

describe('FinishAttemptUseCase', () => {
  it('finishes once and returns the same summary again', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation);
    attempt.answer(simulation.questions, simulation.questions[0]!.id, 'A');
    rows.set(attempt.id, attempt);
    const useCase = new FinishAttemptUseCase(simulations, attempts);
    const first = (await useCase.execute('u1', attempt.id)).value;
    expect(first).toEqual(
      expect.objectContaining({
        status: 'completed',
        finishReason: 'manual',
        correctCount: 1,
        scorePercentage: 25,
      }),
    );
    const again = (await useCase.execute('u1', attempt.id)).value;
    expect(again).toEqual(first);
  });

  it('records a timeout when the time had run out', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation, past(601));
    rows.set(attempt.id, attempt);
    expect(
      (await new FinishAttemptUseCase(simulations, attempts).execute('u1', attempt.id)).value
        .status,
    ).toBe('expired');
  });

  it('404s', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const attempt = Attempt.start(simulation);
    rows.set(attempt.id, attempt);
    const useCase = new FinishAttemptUseCase(simulations, attempts);
    expect((await useCase.execute('u2', attempt.id)).error.kind).toBe('NOT_FOUND');
    expect(
      (await new FinishAttemptUseCase(fakeSimulations(null), attempts).execute('u1', attempt.id))
        .error.kind,
    ).toBe('NOT_FOUND');
    attempts.withLock.mockResolvedValueOnce(null);
    expect((await useCase.execute('u1', attempt.id)).error.kind).toBe('NOT_FOUND');
  });
});

describe('AttemptExpiryService', () => {
  it('closes overdue attempts in the background', async () => {
    const { simulation, simulations, rows, attempts } = setup();
    const overdue = Attempt.start(simulation, past(700));
    const running = Attempt.start(buildSimulation(2));
    rows.set(overdue.id, overdue);
    rows.set(running.id, running);
    const service = new AttemptExpiryService(attempts, simulations);
    expect(await service.run()).toBe(1);
    expect(overdue.status).toBe('expired');
    expect(running.status).toBe('in_progress');
    expect(await service.run()).toBe(0);
  });

  it('skips missing simulations, survives errors and does not overlap', async () => {
    const { attempts } = setup();
    attempts.findOverdue.mockResolvedValueOnce([
      { id: 'a', ownerUserId: 'u1', simulationId: 'gone' },
    ]);
    expect(await new AttemptExpiryService(attempts, fakeSimulations(null)).run()).toBe(0);

    attempts.findOverdue.mockRejectedValueOnce(new Error('db down'));
    const service = new AttemptExpiryService(attempts, fakeSimulations(null));
    expect(await service.run()).toBe(0);

    let release: () => void = () => undefined;
    attempts.findOverdue.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );
    const first = service.run();
    expect(await service.run()).toBe(0);
    release();
    await first;
  });

  it('schedules itself and stops on shutdown', () => {
    jest.useFakeTimers();
    const { attempts, simulations } = setup();
    const service = new AttemptExpiryService(attempts, simulations);
    const run = jest.spyOn(service, 'run').mockResolvedValue(0);
    service.onModuleInit();
    jest.advanceTimersByTime(30_000);
    expect(run).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
    jest.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    new AttemptExpiryService(attempts, simulations).onModuleDestroy();
    jest.useRealTimers();
  });
});
