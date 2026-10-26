export interface RateLimitCheck {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface IRateLimiterPort {
  consume(key: string, maxAttempts: number, windowSeconds: number): Promise<RateLimitCheck>;
  reset(key: string): Promise<void>;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');
