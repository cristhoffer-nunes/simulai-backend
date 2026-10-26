import {
  buildAccessUrl,
  humanizeTtl,
  linkTypeFor,
} from '@/modules/identity/application/access-link';

describe('access-link helpers', () => {
  it('builds the frontend URL with an encoded token', () => {
    expect(buildAccessUrl('https://app.x', 'a.b+c')).toBe(
      'https://app.x/redefinir-senha?token=a.b%2Bc',
    );
  });

  it.each([
    [1800, '1 hora'],
    [3600, '1 hora'],
    [7200, '2 horas'],
    [86_400, '1 dia'],
    [259_200, '3 dias'],
  ])('humanizes %i seconds as "%s"', (seconds, label) => {
    expect(humanizeTtl(seconds)).toBe(label);
  });

  it('picks the link type from the provisional-password flag', () => {
    expect(linkTypeFor(true)).toBe('first_access');
    expect(linkTypeFor(false)).toBe('recovery');
  });
});
