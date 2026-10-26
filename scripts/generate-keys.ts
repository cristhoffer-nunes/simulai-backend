import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Generates the RS256 keypair used to sign Simulai tokens. Run once per environment; the files
// are gitignored. Pass --force to overwrite (this logs everybody out).
const dir = resolve(process.cwd(), 'keys');
const privatePath = resolve(dir, 'private.pem');
const publicPath = resolve(dir, 'public.pem');
const force = process.argv.includes('--force');

if (existsSync(privatePath) && !force) {
  console.error(`${privatePath} already exists. Use --force to overwrite.`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

mkdirSync(dir, { recursive: true });
writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey, { mode: 0o644 });
console.log(`Wrote ${privatePath} and ${publicPath}.`);
