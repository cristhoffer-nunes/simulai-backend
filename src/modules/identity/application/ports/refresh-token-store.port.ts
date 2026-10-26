export interface IssuedRefreshToken {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

export interface IRefreshTokenStorePort {
  issue(userId: string): Promise<IssuedRefreshToken>;
  rotate(token: string): Promise<RotatedRefreshToken | null>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');
