import { Email } from '@/modules/identity/domain/value-objects/email.vo';

describe('Email', () => {
  it('normalizes case and whitespace', () => {
    const email = Email.create('  Mariana@Exemplo.COM ');
    expect(email.value.toString()).toBe('mariana@exemplo.com');
    expect(email.value.equals(Email.create('mariana@exemplo.com').value)).toBe(true);
  });

  it.each(['', 'no-at', 'a@b', 'a b@c.d', `${'x'.repeat(250)}@a.com`])('rejects "%s"', (raw) => {
    expect(Email.create(raw).isFailure).toBe(true);
  });
});
