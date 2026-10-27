import { CreateSimulationUseCase } from '@/modules/simulations/application/use-cases/create-simulation.use-case';
import { GetAvailabilityUseCase } from '@/modules/simulations/application/use-cases/get-availability.use-case';
import { GetSimulationUseCase } from '@/modules/simulations/application/use-cases/get-simulation.use-case';
import { ListSimulationsUseCase } from '@/modules/simulations/application/use-cases/list-simulations.use-case';
import { SetSimulationStatusUseCase } from '@/modules/simulations/application/use-cases/set-simulation-status.use-case';
import { encodeCursor } from '@/shared/pagination/cursor';
import { buildSimulation, fakePool, fakeSimulations } from './helpers';

const input = (overrides = {}) => ({
  userId: 'u1',
  questionCount: 10,
  subjectIds: ['s2', 's1'],
  difficulty: 'all' as const,
  distribution: 'balanced' as const,
  timed: true,
  durationSeconds: 1200,
  ...overrides,
});

describe('CreateSimulationUseCase', () => {
  function build(pool = fakePool()) {
    const simulations = fakeSimulations();
    const useCase = new CreateSimulationUseCase(pool, simulations);
    useCase.random = () => 0.5;
    return { pool, simulations, useCase };
  }

  it('draws exactly N distinct questions with the balanced split (20 over 2 → 10/10)', async () => {
    const pool = fakePool([
      { subjectId: 's1', subjectName: 'Anatomia', available: 30 },
      { subjectId: 's2', subjectName: 'Cardiologia', available: 30 },
    ]);
    const { simulations, useCase } = build(pool);
    const result = await useCase.execute(input({ questionCount: 20 }));

    const simulation = simulations.create.mock.calls[0]![0];
    const ids = simulation.questions.map((q) => q.sourceQuestionId);
    expect(new Set(ids).size).toBe(20);
    expect(ids.filter((id) => Number(id!.slice(1)) > 100)).toHaveLength(10);
    expect(result.value.distribution).toEqual([
      { subjectId: 's2', subjectName: 'Cardiologia', questionCount: 10 },
      { subjectId: 's1', subjectName: 'Anatomia', questionCount: 10 },
    ]);
    expect(result.value.title).toBe('Cardiologia e Anatomia');
    expect(pool.availability).toHaveBeenCalledWith({
      ownerUserId: 'u1',
      difficulty: 'all',
      collectionId: null,
    });
  });

  it('gives the remainder to the first chosen subject and keeps a custom title', async () => {
    const { simulations, useCase } = build();
    await useCase.execute(input({ questionCount: 9, title: '  Revisão  ' }));
    const simulation = simulations.create.mock.calls[0]![0];
    expect(simulation.configuration.perSubject).toEqual({ s2: 5, s1: 4 });
    expect(simulation.title).toBe('Revisão');
  });

  it('answers 422 with what is missing, never redistributing (RN-017)', async () => {
    const { simulations, useCase } = build();
    const result = await useCase.execute(input({ questionCount: 16 }));
    expect(result.error.kind).toBe('INSUFFICIENT_QUESTIONS');
    expect(result.error.details).toEqual([{ subjectId: 's2', required: 8, available: 7 }]);
    expect(simulations.create).not.toHaveBeenCalled();

    const unknown = await useCase.execute(input({ subjectIds: ['s9'], questionCount: 1 }));
    expect(unknown.error.details).toEqual([{ subjectId: 's9', required: 1, available: 0 }]);
  });

  it('validates the configuration', async () => {
    const { useCase } = build();
    const codes = async (overrides: object) => {
      const result = await useCase.execute(input(overrides));
      return (result.error.details as { path: string }[])[0]?.path;
    };
    expect(await codes({ subjectIds: [] })).toBe('subjectIds');
    expect(await codes({ questionCount: 1 })).toBe('questionCount');
    expect(await codes({ questionCount: 201 })).toBe('questionCount');
    expect(await codes({ durationSeconds: 30 })).toBe('durationSeconds');
    expect(await codes({ durationSeconds: null })).toBe('durationSeconds');
    expect((await useCase.execute(input({ collectionId: 'c-other' }))).error.kind).toBe(
      'NOT_FOUND',
    );
  });

  it('untimed exams have no duration; collection filter is passed on', async () => {
    const { pool, simulations, useCase } = build();
    await useCase.execute(
      input({
        timed: false,
        durationSeconds: 999,
        collectionId: 'c1',
        questionCount: 4,
        subjectIds: ['s1', 's2', 's2'],
      }),
    );
    expect(simulations.create.mock.calls[0]![0].durationSeconds).toBeNull();
    expect(pool.eligibleIds).toHaveBeenCalledWith(
      { ownerUserId: 'u1', difficulty: 'all', collectionId: 'c1' },
      's1',
    );
  });

  it('long default titles mention how many more subjects', async () => {
    const pool = fakePool([
      { subjectId: 's1', subjectName: 'Anatomia', available: 5 },
      { subjectId: 's2', subjectName: 'Cardiologia', available: 5 },
      { subjectId: 's3', subjectName: 'Pediatria', available: 5 },
    ]);
    pool.eligibleIds.mockImplementation(async (_f, subjectId) => [
      `${subjectId}-a`,
      `${subjectId}-b`,
    ]);
    pool.snapshots.mockImplementation(
      async (_u, ids) => new Map(ids.map((id) => [id, {} as never])),
    );
    const { useCase } = build(pool);
    const result = await useCase.execute(
      input({ subjectIds: ['s1', 's2', 's3'], questionCount: 3 }),
    );
    expect(result.value.title).toBe('Anatomia, Cardiologia e mais 1');
  });

  it('asks to retry when the bank changed between counting and reading', async () => {
    const pool = fakePool();
    pool.snapshots.mockResolvedValue(new Map());
    const { useCase } = build(pool);
    expect((await useCase.execute(input({ questionCount: 2 }))).error.kind).toBe('CONFLICT');
  });
});

describe('GetAvailabilityUseCase', () => {
  it('returns eligible counts and checks the collection', async () => {
    const pool = fakePool();
    const useCase = new GetAvailabilityUseCase(pool);
    expect(
      (await useCase.execute({ userId: 'u1', difficulty: 'hard' })).value.subjects,
    ).toHaveLength(2);
    expect(pool.availability).toHaveBeenCalledWith({
      ownerUserId: 'u1',
      difficulty: 'hard',
      collectionId: null,
    });
    expect(
      (await useCase.execute({ userId: 'u1', difficulty: 'all', collectionId: 'c1' })).isSuccess,
    ).toBe(true);
    expect(
      (await useCase.execute({ userId: 'u1', difficulty: 'all', collectionId: 'x' })).error.kind,
    ).toBe('NOT_FOUND');
  });
});

describe('list, get and archive', () => {
  it('lists ready simulations by default with a cursor', async () => {
    const simulations = fakeSimulations();
    const item = { id: 's9', createdAt: new Date('2026-10-01T00:00:00Z') };
    simulations.list.mockResolvedValue({ items: [item as never], total: 30, hasMore: true });
    const result = await new ListSimulationsUseCase(simulations).execute({
      userId: 'u1',
      limit: 500,
    });
    expect(simulations.list).toHaveBeenCalledWith('u1', {
      status: 'ready',
      after: undefined,
      limit: 100,
    });
    expect(result.value.nextCursor).toBe(encodeCursor(item));

    simulations.list.mockResolvedValue({ items: [], total: 0, hasMore: false });
    const archived = await new ListSimulationsUseCase(simulations).execute({
      userId: 'u1',
      status: 'archived',
      cursor: encodeCursor(item),
    });
    expect(archived.value.nextCursor).toBeNull();
    expect(
      (await new ListSimulationsUseCase(simulations).execute({ userId: 'u1', cursor: 'bad' })).error
        .kind,
    ).toBe('VALIDATION_ERROR');
  });

  it('gets and archives own simulations, 404 otherwise', async () => {
    const simulation = buildSimulation(2);
    const simulations = fakeSimulations(simulation);
    const view = await new GetSimulationUseCase(simulations).execute('u1', simulation.id);
    expect(view.value).toEqual(expect.objectContaining({ id: simulation.id, questionCount: 2 }));
    expect(JSON.stringify(view.value)).not.toContain('correctOptionId');

    const status = new SetSimulationStatusUseCase(simulations);
    expect((await status.execute('u1', simulation.id, 'archived')).value.status).toBe('archived');
    expect((await status.execute('u1', simulation.id, 'ready')).value.status).toBe('ready');
    expect(simulations.saveStatus).toHaveBeenCalledTimes(2);

    const none = fakeSimulations(null);
    expect((await new GetSimulationUseCase(none).execute('u1', 'x')).error.kind).toBe('NOT_FOUND');
    expect(
      (await new SetSimulationStatusUseCase(none).execute('u1', 'x', 'archived')).error.kind,
    ).toBe('NOT_FOUND');
  });
});
