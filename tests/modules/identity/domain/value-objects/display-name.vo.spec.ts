import { DisplayName } from '@/modules/identity/domain/value-objects/display-name.vo';

describe('DisplayName', () => {
  it('collapses whitespace and builds initials from first and last word', () => {
    const name = DisplayName.create('  ana   clara lima ').value;
    expect(name.toString()).toBe('ana clara lima');
    expect(name.initials()).toBe('AL');
  });

  it('uses a single initial for a one-word name', () => {
    expect(DisplayName.create('Mariana').value.initials()).toBe('M');
  });

  it('rejects empty and too long names', () => {
    expect(DisplayName.create('   ').isFailure).toBe(true);
    expect(DisplayName.create('x'.repeat(81)).isFailure).toBe(true);
  });
});
