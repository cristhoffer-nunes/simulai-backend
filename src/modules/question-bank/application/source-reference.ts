import { FieldError } from '../domain/shared/field-error';

export const MAX_SOURCE_REFERENCE = 500;

export function sourceReferenceErrors(value: string | null | undefined): FieldError[] {
  if (value && value.trim().length > MAX_SOURCE_REFERENCE) {
    return [
      {
        path: 'sourceReference',
        code: 'TOO_LONG',
        message: `Source reference must have at most ${MAX_SOURCE_REFERENCE} characters.`,
      },
    ];
  }
  return [];
}
