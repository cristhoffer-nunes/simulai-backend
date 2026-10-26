import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { IPasswordHasherPort } from '../../application/ports/password-hasher.port';

const SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasherAdapter implements IPasswordHasherPort {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  async unusableHash(): Promise<string> {
    // 32 random bytes, discarded right after hashing: no one can log in with it.
    return bcrypt.hash(randomBytes(32).toString('base64url'), SALT_ROUNDS);
  }
}
