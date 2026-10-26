import { isStrongPassword } from '@/modules/identity/domain/services/password-policy';

describe('isStrongPassword', () => {
  it('accepts 8+ chars with lower, upper, digit and symbol', () => {
    expect(isStrongPassword('Abcdef1!')).toBe(true);
  });

  it.each(['Abc1!', 'abcdefg1!', 'ABCDEFG1!', 'Abcdefgh!', 'Abcdefgh1', `Aa1!${'x'.repeat(125)}`])(
    'rejects "%s"',
    (password) => {
      expect(isStrongPassword(password)).toBe(false);
    },
  );
});
