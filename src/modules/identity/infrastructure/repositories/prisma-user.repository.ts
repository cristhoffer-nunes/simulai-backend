import { Injectable } from '@nestjs/common';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { User } from '../../domain/entities/user.entity';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { Email } from '../../domain/value-objects/email.vo';
import {
  IUserRepository,
  UserListFilter,
  UserPage,
} from '../../domain/repositories/user.repository';

const WITH_ROLE_NAMES = { userRoles: { include: { role: true } } } as const;

type UserWithRoleNames = Prisma.UserGetPayload<{ include: typeof WITH_ROLE_NAMES }>;

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: UserListFilter): Promise<UserPage> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(filter.isActive === undefined ? {} : { isActive: filter.isActive }),
      ...(filter.roleName ? { userRoles: { some: { role: { name: filter.roleName } } } } : {}),
      ...(filter.search
        ? {
            OR: [
              { email: { contains: filter.search, mode: 'insensitive' } },
              { displayName: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: WITH_ROLE_NAMES,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row: UserWithRoleNames) => ({
        user: this.toDomain(row),
        roleNames: row.userRoles.map((userRole) => userRole.role.name),
      })),
      total,
    };
  }

  async createWithRole(user: User, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email.toString(),
          passwordHash: user.passwordHash,
          displayName: user.displayName.toString(),
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId } });
    });
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: user.passwordHash,
        displayName: user.displayName.toString(),
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        updatedAt: user.updatedAt,
      },
    });
  }

  async replaceRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId } });
    });
  }

  private toDomain(row: PrismaUser): User {
    const email = Email.create(row.email);
    const displayName = DisplayName.create(row.displayName);
    if (email.isFailure || displayName.isFailure) {
      throw new Error(`User ${row.id} has corrupted data in storage.`);
    }

    return User.reconstitute({
      id: row.id,
      email: email.value,
      passwordHash: row.passwordHash,
      displayName: displayName.value,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
