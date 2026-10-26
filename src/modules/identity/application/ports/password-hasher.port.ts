export interface IPasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
  /** Hash of a random secret nobody knows — the provisional password of an invited account. */
  unusableHash(): Promise<string>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
