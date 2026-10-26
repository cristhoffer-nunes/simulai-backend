import { PrismaRoleRepository } from '@/modules/identity/infrastructure/repositories/prisma-role.repository';
import { PrismaUserRepository } from '@/modules/identity/infrastructure/repositories/prisma-user.repository';
import { buildUser } from '../../../../helpers/identity-fakes';

describe('Prisma repositories (identity)', () => {
  const row = {
    id: 'user-1',
    email: 'mariana@exemplo.com',
    passwordHash: 'hash',
    displayName: 'Mariana Souza',
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    deletedAt: null,
  };

  describe('PrismaUserRepository', () => {
    function build() {
      const tx = {
        user: { create: jest.fn() },
        userRole: { create: jest.fn(), deleteMany: jest.fn() },
      };
      const prisma = {
        user: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(async (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (t: unknown) => Promise<unknown>)(tx)
            : Promise.all(arg as Promise<unknown>[]),
        ),
      };
      return { repo: new PrismaUserRepository(prisma as never), prisma, tx };
    }

    it('finds by email (lower-cased) and id, ignoring deleted rows', async () => {
      const { repo, prisma } = build();
      prisma.user.findFirst.mockResolvedValue(row);

      const byEmail = await repo.findByEmail('Mariana@Exemplo.com');
      await repo.findById('user-1');

      expect(byEmail?.displayName.toString()).toBe('Mariana Souza');
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { email: 'mariana@exemplo.com', deletedAt: null },
      });
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: 'user-1', deletedAt: null },
      });
    });

    it('returns null when nothing is found', async () => {
      const { repo, prisma } = build();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(repo.findByEmail('x@y.z')).resolves.toBeNull();
      await expect(repo.findById('x')).resolves.toBeNull();
    });

    it('lists with search, role and status filters', async () => {
      const { repo, prisma } = build();
      prisma.user.findMany.mockResolvedValue([
        { ...row, userRoles: [{ role: { name: 'student' } }] },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const page = await repo.list({
        search: 'mar',
        roleName: 'student',
        isActive: true,
        page: 2,
        pageSize: 10,
      });

      expect(page.total).toBe(1);
      expect(page.items[0]?.roleNames).toEqual(['student']);
      const args = prisma.user.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      expect(args.where).toEqual(
        expect.objectContaining({
          deletedAt: null,
          isActive: true,
          userRoles: { some: { role: { name: 'student' } } },
          OR: expect.any(Array),
        }),
      );
    });

    it('lists without optional filters', async () => {
      const { repo, prisma } = build();
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await repo.list({ page: 1, pageSize: 20 });

      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    });

    it('creates user and role in one transaction, and replaces roles atomically', async () => {
      const { repo, tx } = build();
      const user = buildUser();

      await repo.createWithRole(user, 'role-1');
      await repo.replaceRole('user-1', 'role-2');

      expect(tx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'user-1',
          email: 'mariana@exemplo.com',
          displayName: 'Mariana Souza',
        }),
      });
      expect(tx.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', roleId: 'role-1' },
      });
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(tx.userRole.create).toHaveBeenLastCalledWith({
        data: { userId: 'user-1', roleId: 'role-2' },
      });
    });

    it('saves mutable fields', async () => {
      const { repo, prisma } = build();
      await repo.save(buildUser());
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          displayName: 'Mariana Souza',
          isActive: true,
          mustChangePassword: false,
        }),
      });
    });

    it('refuses to map corrupted rows', async () => {
      const { repo, prisma } = build();
      prisma.user.findFirst.mockResolvedValue({ ...row, email: 'broken' });
      await expect(repo.findById('user-1')).rejects.toThrow('corrupted');
    });
  });

  describe('PrismaRoleRepository', () => {
    const roleRow = {
      id: 'r1',
      name: 'student',
      rolePermissions: [{ permission: { name: 'study.access' } }],
    };

    it('finds by name and for a user', async () => {
      const prisma = {
        role: { findUnique: jest.fn().mockResolvedValueOnce(roleRow).mockResolvedValueOnce(null) },
        userRole: { findMany: jest.fn().mockResolvedValue([{ role: roleRow }]) },
      };
      const repo = new PrismaRoleRepository(prisma as never);

      expect((await repo.findByName('student'))?.permissions).toEqual(['study.access']);
      await expect(repo.findByName('nope')).resolves.toBeNull();
      expect((await repo.findRolesForUser('u1')).map((role) => role.name)).toEqual(['student']);
    });
  });
});
