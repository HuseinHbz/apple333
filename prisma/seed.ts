import { hash } from 'bcryptjs';

import { PrismaClient } from '@prisma/client';

import { permissionDefinitions, SYSTEM_ROLES } from '../src/modules/auth/default-rbac';

const prisma = new PrismaClient();

async function main() {
  for (const permission of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { group: permission.group, description: permission.description }
    });
  }

  for (const role of SYSTEM_ROLES) {
    const permissionIds = await prisma.permission.findMany({
      where: { code: { in: [...role.permissions] } },
      select: { id: true }
    });
    await prisma.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
        permissions: { create: permissionIds.map((permission) => ({ permissionId: permission.id })) }
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
        permissions: {
          deleteMany: {},
          create: permissionIds.map((permission) => ({ permissionId: permission.id }))
        }
      }
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.info('Roles and permissions seeded. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create a bootstrap administrator.');
    return;
  }

  if (password.length < 16) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 16 characters long.');
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Bootstrap Administrator', status: 'ACTIVE' },
    update: { status: 'ACTIVE' }
  });
  const passwordHash = await hash(password, 12);
  await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, passwordHash, isActive: true },
    update: { passwordHash, isActive: true }
  });
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
    create: { userId: user.id, roleId: superAdmin.id },
    update: {}
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
