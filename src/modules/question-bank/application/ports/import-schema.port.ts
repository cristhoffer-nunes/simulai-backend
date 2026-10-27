import { FieldError } from '../../domain/shared/field-error';

/** Structural check of one import item against the published JSON Schema (v1.0). */
export interface IImportSchemaPort {
  /** Errors with paths relative to the item (e.g. `options[1].text`); empty when it fits. */
  checkItem(item: unknown): FieldError[];
}

export const IMPORT_SCHEMA = Symbol('IMPORT_SCHEMA');
