import { Attempt, scoreOf } from '@/modules/simulations/domain/attempt.entity';
import { buildSimulation } from './helpers';

describe('Attempt', () => {
  const simulation = buildSimulation(4); // keys: A, B, A, B
  const t0 = new Date('2026-10-27T10:00:00Z');
  const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
  const q = (index: number) => simulation.questions[index]!.id;

  it('starts with the server deadline', () => {
    const attempt = Attempt.start(simulation, t0);
    expect(attempt.status).toBe('in_progress');
    expect(attempt.expiresAt).toEqual(at(600));
    expect([attempt.startedAt, attempt.createdAt]).toEqual([t0, t0]);
    expect(Attempt.start(buildSimulation(1, { timed: false }), t0).expiresAt).toBeNull();
    expect(attempt.isPastDeadline(at(599))).toBe(false);
    expect(attempt.isPastDeadline(at(600))).toBe(true);
  });

  it('saves, changes and clears answers until the deadline', () => {
    const attempt = Attempt.start(simulation, t0);
    expect(attempt.answer(simulation.questions, q(0), 'A', at(10)).isSuccess).toBe(true);
    expect(attempt.answer(simulation.questions, q(0), 'B', at(20)).value.selectedOptionId).toBe(
      'B',
    );
    expect(
      attempt.answer(simulation.questions, q(1), null, at(30)).value.selectedOptionId,
    ).toBeNull();
    expect(attempt.changedAnswers.map((answer) => answer.simulationQuestionId)).toEqual([
      q(0),
      q(1),
    ]);
    expect(attempt.answer(simulation.questions, 'nope', 'A', at(40)).error).toBe(
      'UNKNOWN_QUESTION',
    );
    expect(attempt.answer(simulation.questions, q(2), 'F', at(40)).error).toBe('UNKNOWN_OPTION');
    expect(attempt.answer(simulation.questions, q(2), 'A', at(600)).error).toBe('DEADLINE_PASSED');
  });

  it('scores once: correct / total, blanks count, timeout ends at the deadline', () => {
    const attempt = Attempt.start(simulation, t0);
    attempt.answer(simulation.questions, q(0), 'A', at(1)); // correct
    attempt.answer(simulation.questions, q(1), 'A', at(2)); // wrong
    attempt.answer(simulation.questions, q(2), null, at(3)); // blank
    expect(attempt.finish(simulation.questions, 'timeout', at(900))).toBe(true);
    expect(attempt.status).toBe('expired');
    expect(attempt.finishedAt).toEqual(at(600));
    expect(attempt.finishReason).toBe('timeout');
    expect(attempt.score).toEqual({
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 2,
      scorePercentage: 25,
    });
    expect(attempt.finish(simulation.questions, 'manual', at(901))).toBe(false);
    expect(attempt.answer(simulation.questions, q(3), 'B', at(30)).error).toBe('FINISHED');
  });

  it('manual finish uses now; two decimals', () => {
    const three = buildSimulation(3);
    const attempt = Attempt.start(three, t0);
    attempt.answer(three.questions, three.questions[0]!.id, 'A', at(1));
    attempt.finish(three.questions, 'manual', at(100));
    expect([attempt.status, attempt.finishedAt]).toEqual(['completed', at(100)]);
    expect(attempt.score?.scorePercentage).toBe(33.33);
    expect(scoreOf([], new Map()).scorePercentage).toBe(0);
    const untimed = Attempt.start(buildSimulation(1, { timed: false }), t0);
    untimed.finish([], 'timeout', at(5));
    expect(untimed.finishedAt).toEqual(at(5));
  });

  it('reconstitutes with its answers', () => {
    const attempt = Attempt.start(simulation, t0);
    const copy = Attempt.reconstitute({
      id: attempt.id,
      simulationId: attempt.simulationId,
      ownerUserId: 'u1',
      status: 'in_progress',
      startedAt: t0,
      expiresAt: null,
      finishedAt: null,
      finishReason: null,
      score: null,
      answers: new Map([
        [
          q(0),
          { simulationQuestionId: q(0), selectedOptionId: 'A', flagged: false, answeredAt: t0 },
        ],
      ]),
      createdAt: t0,
    });
    expect(copy.answers.get(q(0))?.selectedOptionId).toBe('A');
    expect(copy.changedAnswers).toEqual([]);
    expect(copy.isPastDeadline()).toBe(false);
  });
});
