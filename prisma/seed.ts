import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS } from '../src/modules/identity/domain/services/access-policy';
import { isStrongPassword } from '../src/modules/identity/domain/services/password-policy';

const prisma = new PrismaClient();

// Taxonomy catalog (owner_user_id NULL). Students add their own subjects/topics privately;
// these are only the starting point. Never hard-code subjects in the frontend.
const CATALOG: Record<string, Record<string, string[]>> = {
  Medicina: {
    Anatomia: [],
    Cardiologia: [],
  },
};

async function seedAccessControl(): Promise<void> {
  console.log('Seeding roles and permissions...');
  const allPermissions = [...new Set(Object.values(ROLE_PERMISSIONS).flat())];
  const permissionIds = new Map<string, string>();
  for (const name of allPermissions) {
    const permission = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    permissionIds.set(name, permission.id);
  }

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    for (const permissionName of permissionNames) {
      const permissionId = permissionIds.get(permissionName);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
}

async function seedTaxonomy(): Promise<void> {
  console.log('Seeding taxonomy catalog...');
  for (const [areaName, subjects] of Object.entries(CATALOG)) {
    const area = await prisma.knowledgeArea.upsert({
      where: { name: areaName },
      update: {},
      create: { name: areaName },
    });
    for (const [subjectName, topics] of Object.entries(subjects)) {
      const subject =
        (await prisma.subject.findFirst({
          where: { knowledgeAreaId: area.id, ownerUserId: null, name: subjectName },
        })) ??
        (await prisma.subject.create({ data: { knowledgeAreaId: area.id, name: subjectName } }));
      for (const topicName of topics) {
        const exists = await prisma.topic.findFirst({
          where: { subjectId: subject.id, ownerUserId: null, name: topicName },
        });
        if (!exists)
          await prisma.topic.create({ data: { subjectId: subject.id, name: topicName } });
      }
    }
  }
}

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping first admin.');
    return;
  }
  if (!isStrongPassword(password)) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is too weak: use 8+ characters with lowercase, uppercase, a digit and a symbol.',
    );
  }

  console.log('Seeding first administrator...');
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      displayName: process.env.SEED_ADMIN_DISPLAY_NAME?.trim() || 'Administrador',
      isActive: true,
      // The seeded admin chose this password in .env; no first-access step needed.
      mustChangePassword: false,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
}

async function main(): Promise<void> {
  await seedAccessControl();
  await seedTaxonomy();
  await seedAdmin();
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
