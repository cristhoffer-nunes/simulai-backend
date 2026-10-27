import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cached: string | undefined;

/**
 * Version of the running service: APP_VERSION when set (image build arg), otherwise the version in
 * package.json (copied into the image). Lets the deploy check that the new release is live.
 */
export function appVersion(
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (cached) return cached;
  try {
    const parsed = JSON.parse(read(join(process.cwd(), 'package.json'))) as { version?: unknown };
    cached = typeof parsed.version === 'string' ? parsed.version : 'unknown';
  } catch {
    cached = 'unknown';
  }
  return cached;
}

/** Tests only. */
export function resetAppVersionCache(): void {
  cached = undefined;
}
