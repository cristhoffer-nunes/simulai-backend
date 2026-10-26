import { Role } from '@/modules/identity/domain/entities/role.entity';

describe('Role', () => {
  it('exposes its data and deduplicates permissions into claims', () => {
    const a = Role.reconstitute({ id: '1', name: 'admin', permissions: ['x', 'y'] });
    const b = Role.reconstitute({ id: '2', name: 'student', permissions: ['y', 'z'] });

    expect(a.id).toBe('1');
    expect(Role.toClaims([a, b])).toEqual({
      roleNames: ['admin', 'student'],
      permissions: ['x', 'y', 'z'],
    });
  });
});
