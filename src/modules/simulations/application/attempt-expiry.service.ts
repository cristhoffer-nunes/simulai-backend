import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ATTEMPT_REPOSITORY, IAttemptRepository } from '../domain/attempt.repository';
import { ISimulationRepository, SIMULATION_REPOSITORY } from '../domain/simulation.repository';

const EVERY_MS = 30_000;
const BATCH = 50;

/**
 * SIM-04 worker: closes attempts whose deadline passed even if the student never comes back
 * (closed browser). Reads and answer saves also close them on the spot.
 */
@Injectable()
export class AttemptExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttemptExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: IAttemptRepository,
    @Inject(SIMULATION_REPOSITORY) private readonly simulations: ISimulationRepository,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns how many attempts were closed. Never throws. */
  async run(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let closed = 0;
    try {
      const overdue = await this.attempts.findOverdue(now, BATCH);
      for (const item of overdue) {
        const simulation = await this.simulations.findOwned(item.ownerUserId, item.simulationId);
        if (!simulation) continue;
        const locked = await this.attempts.withLock(item.ownerUserId, item.id, (attempt) =>
          attempt.finish(simulation.questions, 'timeout', now),
        );
        if (locked?.value) closed += 1;
      }
      if (closed > 0) this.logger.log(`Closed ${closed} attempt(s) whose time ran out.`);
    } catch (error) {
      this.logger.warn(`Attempt expiry failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
    return closed;
  }
}
