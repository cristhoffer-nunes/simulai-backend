import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Throwaway RS256 keypair on disk, for adapter tests. */
export function writeTestKeys(): { privateKeyPath: string; publicKeyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'simulai-keys-'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const privateKeyPath = join(dir, 'private.pem');
  const publicKeyPath = join(dir, 'public.pem');
  writeFileSync(privateKeyPath, privateKey);
  writeFileSync(publicKeyPath, publicKey);
  return { privateKeyPath, publicKeyPath };
}
