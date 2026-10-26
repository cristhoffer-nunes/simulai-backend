import { User } from '@/modules/identity/domain/entities/user.entity';
import { DisplayName } from '@/modules/identity/domain/value-objects/display-name.vo';
import { Email } from '@/modules/identity/domain/value-objects/email.vo';

describe('User', () => {
  it('creates an active invited account that must set its password', () => {
    const user = User.create(
      Email.create('a@b.co').value,
      DisplayName.create('Ana').value,
      'unusable',
    );
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.isActive).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(user.passwordHash).toBe('unusable');
    expect(user.createdAt).toEqual(user.updatedAt);
  });

  it('tracks changes and bumps updatedAt', () => {
    const old = new Date('2020-01-01');
    const user = User.reconstitute({
      id: 'u',
      email: Email.create('a@b.co').value,
      passwordHash: 'h',
      displayName: DisplayName.create('Ana').value,
      isActive: true,
      mustChangePassword: true,
      createdAt: old,
      updatedAt: old,
    });

    user.rename(DisplayName.create('Bia').value);
    user.changePasswordHash('h2');
    user.clearMustChangePassword();
    user.deactivate();

    expect(user.displayName.toString()).toBe('Bia');
    expect(user.passwordHash).toBe('h2');
    expect(user.mustChangePassword).toBe(false);
    expect(user.isActive).toBe(false);
    expect(user.updatedAt.getTime()).toBeGreaterThan(old.getTime());

    user.activate();
    expect(user.isActive).toBe(true);
    expect(user.email.toString()).toBe('a@b.co');
  });
});
