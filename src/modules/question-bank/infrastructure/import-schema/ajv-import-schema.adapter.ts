import { Injectable } from '@nestjs/common';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import { IImportSchemaPort } from '../../application/ports/import-schema.port';
import { FieldError } from '../../domain/shared/field-error';
import { QUESTION_IMPORT_V1_SCHEMA } from './question-import.v1.schema';

/** "/options/1/text" → "options[1].text" */
export function toPath(pointer: string, child?: string): string {
  const parts = pointer.split('/').filter(Boolean);
  if (child) parts.push(child);
  return parts.reduce(
    (path, part) => (/^\d+$/.test(part) ? `${path}[${part}]` : path ? `${path}.${part}` : part),
    '',
  );
}

function toFieldError(error: ErrorObject): FieldError {
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case 'required':
      return {
        path: toPath(error.instancePath, String(params.missingProperty)),
        code: 'REQUIRED',
        message: `Missing required field "${String(params.missingProperty)}".`,
      };
    case 'additionalProperties':
      return {
        path: toPath(error.instancePath, String(params.additionalProperty)),
        code: 'UNKNOWN_FIELD',
        message: `Unknown field "${String(params.additionalProperty)}".`,
      };
    case 'minLength':
      return {
        path: toPath(error.instancePath),
        code: params.limit === 1 ? 'REQUIRED' : 'TOO_SHORT',
        message:
          params.limit === 1
            ? 'Cannot be empty.'
            : `Must have at least ${String(params.limit)} characters.`,
      };
    case 'maxLength':
      return {
        path: toPath(error.instancePath),
        code: 'TOO_LONG',
        message: `Must have at most ${String(params.limit)} characters.`,
      };
    case 'minItems':
    case 'maxItems':
      return {
        path: toPath(error.instancePath),
        code: 'OPTIONS_COUNT',
        message: 'A question needs between 2 and 6 options.',
      };
    case 'enum':
    case 'const':
      return {
        path: toPath(error.instancePath),
        code: 'INVALID_VALUE',
        message: `Must be ${JSON.stringify(params.allowedValues ?? params.allowedValue)}.`,
      };
    case 'type':
      return {
        path: toPath(error.instancePath),
        code: 'INVALID_TYPE',
        message: `Must be of type ${String(params.type)}.`,
      };
    default:
      return {
        path: toPath(error.instancePath),
        code: 'INVALID',
        message: error.message ?? 'Invalid.',
      };
  }
}

@Injectable()
export class AjvImportSchemaAdapter implements IImportSchemaPort {
  private readonly validateItem: ValidateFunction;

  constructor() {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    this.validateItem = ajv.compile(QUESTION_IMPORT_V1_SCHEMA.properties.questions.items);
  }

  checkItem(item: unknown): FieldError[] {
    if (this.validateItem(item)) return [];
    return (this.validateItem.errors ?? []).map(toFieldError);
  }
}
