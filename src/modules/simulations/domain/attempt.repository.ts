import { Attempt } from './attempt.entity';

export interface IAttemptRepository {
  /** False when another attempt of this simulation is already in progress (unique index). */
  create(attempt: Attempt): Promise<boolean>;
  findOwned(ownerUserId: string, attemptId: string): Promise<Attempt | null>;
  findActive(ownerUserId: string, simulationId: string): Promise<Attempt | null>;
  /**
   * Runs `work` on the attempt while holding a row lock (SELECT … FOR UPDATE), then persists its
   * state and changed answers in the same transaction. Answer saves, finishing and the expiry job
   * cannot interleave (RN-022). Returns null when the attempt is not the owner's.
   */
  withLock<T>(
    ownerUserId: string,
    attemptId: string,
    work: (attempt: Attempt) => T,
  ): Promise<{
    attempt: Attempt;
    value: T;
  } | null>;
  /** 1 for the first attempt of the simulation, 2 for the next… */
  attemptNumber(attempt: Attempt): Promise<number>;
  /** In-progress attempts whose deadline passed (for the expiry job). */
  findOverdue(
    now: Date,
    limit: number,
  ): Promise<{ id: string; ownerUserId: string; simulationId: string }[]>;
}

export const ATTEMPT_REPOSITORY = Symbol('ATTEMPT_REPOSITORY');
