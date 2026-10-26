import { Result } from '../../../../shared/result/result';

const MAX_LENGTH = 80;

export class DisplayName {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<DisplayName, string> {
    const normalized = raw.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) {
      return Result.fail('Display name cannot be empty.');
    }
    if (normalized.length > MAX_LENGTH) {
      return Result.fail(`Display name must have at most ${MAX_LENGTH} characters.`);
    }
    return Result.ok(new DisplayName(normalized));
  }

  /** Two letters for the avatar: first letter of the first and of the last word. */
  initials(): string {
    const words = this.value.split(' ');
    const first = words[0]?.[0] ?? '';
    const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase();
  }

  toString(): string {
    return this.value;
  }
}
