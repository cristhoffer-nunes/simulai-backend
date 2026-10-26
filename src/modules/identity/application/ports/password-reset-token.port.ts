export type PasswordResetTokenType = 'first_access' | 'recovery';

export interface PasswordResetTokenClaims {
  sub: string;
  email: string;
  type: PasswordResetTokenType;
  // Unique per issuance — single use and "reissuing invalidates the previous link" live in
  // IPasswordResetTokenStorePort, keyed by this id.
  jti: string;
  iat: number;
  exp: number;
}

export interface IssuedResetToken {
  token: string;
  jti: string;
  ttlSeconds: number;
}

// Short-lived signed link tokens behind /redefinir-senha (first access and recovery). Never
// accepted as a session: they carry no roles/permissions.
export interface IPasswordResetTokenPort {
  issue(userId: string, email: string, type: PasswordResetTokenType): Promise<IssuedResetToken>;
  // Returns null (never throws) for a malformed, unsigned or expired token.
  verify(token: string): Promise<PasswordResetTokenClaims | null>;
}

export const PASSWORD_RESET_TOKEN_SERVICE = Symbol('PASSWORD_RESET_TOKEN_SERVICE');
