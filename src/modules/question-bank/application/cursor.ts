/** Opaque keyset cursor: position (createdAt, id) of the last item of the previous page. */
export interface CursorPosition {
  createdAt: Date;
  id: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify([position.createdAt.toISOString(), position.id])).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): CursorPosition | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [iso, id] = parsed as unknown[];
    if (typeof iso !== 'string' || typeof id !== 'string') return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
