import { randomUUID } from 'node:crypto';
import { Result } from '../../../../shared/result/result';
import { CatalogName } from '../shared/catalog-name.vo';

const MAX_DESCRIPTION = 500;

export interface CollectionProps {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

/** Empty or blank → null; otherwise trimmed and at most 500 characters. */
export function normalizeDescription(
  raw: string | null | undefined,
): Result<string | null, string> {
  const value = (raw ?? '').trim();
  if (value.length === 0) return Result.ok(null);
  if (value.length > MAX_DESCRIPTION) {
    return Result.fail(`Description must have at most ${MAX_DESCRIPTION} characters.`);
  }
  return Result.ok(value);
}

/**
 * Aggregate root: a student's private group of questions (N:N, RN-012). Deleting it removes only
 * the memberships, never the questions.
 */
export class Collection {
  private constructor(private props: CollectionProps) {}

  static create(ownerUserId: string, name: CatalogName, description: string | null): Collection {
    return new Collection({
      id: randomUUID(),
      ownerUserId,
      name: name.toString(),
      description,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: CollectionProps): Collection {
    return new Collection(props);
  }

  get id(): string {
    return this.props.id;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  rename(name: CatalogName): void {
    this.props.name = name.toString();
  }

  describe(description: string | null): void {
    this.props.description = description;
  }
}
