import { Result } from '../../../../shared/result/result';

const MAX_LENGTH = 120;

/** Name of a subject, topic or collection: trimmed, single spaces, 1–120 characters. */
export class CatalogName {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<CatalogName, string> {
    const normalized = (raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) return Result.fail('Name cannot be empty.');
    if (normalized.length > MAX_LENGTH) {
      return Result.fail(`Name must have at most ${MAX_LENGTH} characters.`);
    }
    return Result.ok(new CatalogName(normalized));
  }

  /** Case- and accent-insensitive key used to detect "the same name". */
  matchKey(): string {
    return CatalogName.keyOf(this.value);
  }

  static keyOf(name: string): string {
    return name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  toString(): string {
    return this.value;
  }
}
