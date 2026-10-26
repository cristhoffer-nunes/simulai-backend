import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { Role } from '../../domain/entities/role.entity';
import { IRoleRepository } from '../../domain/repositories/role.repository';

const WITH_PERMISSIONS = {
  rolePermissions: { include: { permission: true } },
} as const;

type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof WITH_PERMISSIONS }>;

@Injectable()
export class PrismaRoleRepository implements IRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByName(name: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({
      where: { name },
      include: WITH_PERMISSIONS,
    });
    return row ? this.toDomain(row) : null;
  }

  async findRolesForUser(userId: string): Promise<Role[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: WITH_PERMISSIONS } },
    });

    return userRoles.map(({ role }) => this.toDomain(role));
  }

  private toDomain(row: RoleWithPermissions): Role {
    return Role.reconstitute({
      id: row.id,
      name: row.name,
      permissions: row.rolePermissions.map((rp) => rp.permission.name),
    });
  }
}
