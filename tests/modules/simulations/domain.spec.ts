import { balancedDistribution, shuffle } from '@/modules/simulations/domain/distribution';
import { buildSimulation } from './helpers';

describe('balancedDistribution (RN-016/017)', () => {
  const subjects = (...available: number[]) =>
    available.map((count, i) => ({ subjectId: `s${i + 1}`, available: count }));

  it('splits evenly and gives the remainder in the chosen order', () => {
    expect([...balancedDistribution(subjects(50, 50), 20).value]).toEqual([
      ['s1', 10],
      ['s2', 10],
    ]);
    expect([...balancedDistribution(subjects(9, 9, 9), 10).value]).toEqual([
      ['s1', 4],
      ['s2', 3],
      ['s3', 3],
    ]);
    expect([...balancedDistribution(subjects(9, 9, 9), 11).value.values()]).toEqual([4, 4, 3]);
  });

  it('reports every short subject instead of redistributing', () => {
    expect(balancedDistribution(subjects(7, 50, 2), 30).error).toEqual([
      { subjectId: 's1', required: 10, available: 7 },
      { subjectId: 's3', required: 10, available: 2 },
    ]);
  });
});

describe('shuffle', () => {
  it('keeps every item and is driven by the random source', () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, () => 0);
    expect([...result].sort()).toEqual(items);
    expect(result).not.toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle(items).length).toBe(5);
  });
});

describe('Simulation', () => {
  it('numbers questions from 1 and keeps the snapshots', () => {
    const simulation = buildSimulation(3);
    expect(simulation.questions.map((q) => q.position)).toEqual([1, 2, 3]);
    expect(simulation.questionCount).toBe(3);
    expect(simulation.status).toBe('ready');
    expect([simulation.mode, simulation.durationSeconds, simulation.timed]).toEqual([
      'exam',
      600,
      true,
    ]);
    expect([simulation.ownerUserId, simulation.title, simulation.difficulty]).toEqual([
      'u1',
      'Anatomia',
      'all',
    ]);
    expect(simulation.createdAt).toBeInstanceOf(Date);
    simulation.archive();
    expect(simulation.status).toBe('archived');
    simulation.restore();
    expect(simulation.status).toBe('ready');
  });

  it('drops the duration when untimed', () => {
    expect(buildSimulation(1, { timed: false, durationSeconds: 600 }).durationSeconds).toBeNull();
  });
});
