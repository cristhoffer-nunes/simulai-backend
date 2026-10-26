import { Result } from '../../../../shared/result/result';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 254;

export class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<Email, string> {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length > MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      return Result.fail(`"${raw}" is not a valid email address.`);
    }
    return Result.ok(new Email(normalized));
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
