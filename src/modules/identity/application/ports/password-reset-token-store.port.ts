// The single currently-valid link per user (table password_reset_links). Issuing overwrites the previous jti;
// completing a reset consumes it.
export interface IPasswordResetTokenStorePort {
  save(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  isValid(userId: string, jti: string): Promise<boolean>;
  consume(userId: string): Promise<void>;
}

export const PASSWORD_RESET_TOKEN_STORE = Symbol('PASSWORD_RESET_TOKEN_STORE');
