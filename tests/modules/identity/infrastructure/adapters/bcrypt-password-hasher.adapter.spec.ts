import { BcryptPasswordHasherAdapter } from '@/modules/identity/infrastructure/adapters/bcrypt-password-hasher.adapter';

describe('BcryptPasswordHasherAdapter', () => {
  const hasher = new BcryptPasswordHasherAdapter();

  it('hashes and verifies', async () => {
    const hash = await hasher.hash('Senha#123');
    expect(hash).not.toContain('Senha');
    await expect(hasher.compare('Senha#123', hash)).resolves.toBe(true);
    await expect(hasher.compare('outra', hash)).resolves.toBe(false);
  });

  it('produces a hash no known password matches', async () => {
    const hash = await hasher.unusableHash();
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    await expect(hasher.compare('', hash)).resolves.toBe(false);
  });
});
