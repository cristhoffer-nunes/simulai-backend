export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

export type AccessTokenPayload = Pick<AccessTokenClaims, 'sub' | 'email' | 'roles' | 'permissions'>;

export interface ITokenServicePort {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  getPublicKeyPem(): string;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
