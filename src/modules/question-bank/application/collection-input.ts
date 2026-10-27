import { Result } from '../../../shared/result/result';
import { normalizeDescription } from '../domain/collections/collection.entity';
import { ICollectionRepository } from '../domain/collections/collection.repository';
import { CatalogName } from '../domain/shared/catalog-name.vo';
import { FieldError } from '../domain/shared/field-error';

export function parseCollectionName(raw: string): Result<CatalogName, FieldError[]> {
  const name = CatalogName.create(raw);
  return name.isFailure
    ? Result.fail([{ path: 'name', code: 'INVALID_NAME', message: name.error }])
    : Result.ok(name.value);
}

export function parseDescription(
  raw: string | null | undefined,
): Result<string | null, FieldError[]> {
  const description = normalizeDescription(raw);
  return description.isFailure
    ? Result.fail([{ path: 'description', code: 'TOO_LONG', message: description.error }])
    : Result.ok(description.value);
}

/** Two collections of the same student cannot share a name (ignoring case and accents). */
export async function nameTaken(
  collections: ICollectionRepository,
  ownerUserId: string,
  name: CatalogName,
  exceptId?: string,
): Promise<boolean> {
  const key = name.matchKey();
  const all = await collections.listByOwner(ownerUserId);
  return all.some(
    (collection) => collection.id !== exceptId && CatalogName.keyOf(collection.name) === key,
  );
}

/** Rejects collection ids that are not the student's (same answer as for missing ones). */
export async function checkCollectionIds(
  collections: ICollectionRepository,
  ownerUserId: string,
  collectionIds: string[] | undefined,
): Promise<Result<string[] | undefined, FieldError[]>> {
  if (collectionIds === undefined) return Result.ok(undefined);
  const unique = [...new Set(collectionIds)];
  const owned = new Set(await collections.ownedIds(ownerUserId, unique));
  const unknown = unique.filter((id) => !owned.has(id));
  if (unknown.length > 0) {
    return Result.fail([
      {
        path: 'collectionIds',
        code: 'UNKNOWN_COLLECTION',
        message: `Collection not found: ${unknown.join(', ')}.`,
      },
    ]);
  }
  return Result.ok(unique);
}
