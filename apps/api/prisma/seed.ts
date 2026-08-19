import { PrismaClient, Role, CategoryType, AccountType } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("admin123");
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      displayName: "Sistem Yöneticisi",
      role: Role.ADMIN,
    },
  });

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Konfor Proje",
      approvalLimit: 50000,
    },
  });

  const categories = [
    { name: "Malzeme", type: CategoryType.EXPENSE, color: "#DC2626", sortOrder: 1 },
    { name: "İşçilik", type: CategoryType.EXPENSE, color: "#EA580C", sortOrder: 2 },
    { name: "Kira / Ekipman", type: CategoryType.EXPENSE, color: "#CA8A04", sortOrder: 3 },
    { name: "Hakediş", type: CategoryType.INCOME, color: "#16A34A", sortOrder: 4 },
    { name: "Genel", type: CategoryType.BOTH, color: "#2563EB", sortOrder: 5 },
  ];

  for (const c of categories) {
    const existing = await prisma.category.findFirst({
      where: { name: c.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.category.create({ data: c });
    }
  }

  if (!(await prisma.supplier.findFirst({ where: { name: "Örnek Tedarik Ltd.", deletedAt: null } }))) {
    await prisma.supplier.create({
      data: { name: "Örnek Tedarik Ltd.", taxId: "1234567890" },
    });
  }

  if (!(await prisma.project.findFirst({ where: { name: "Merkez Şantiye", deletedAt: null } }))) {
    await prisma.project.create({ data: { name: "Merkez Şantiye", code: "SNT-01" } });
  }

  if (!(await prisma.financeAccount.findFirst({ where: { name: "Ana Kasa", deletedAt: null } }))) {
    await prisma.financeAccount.create({
      data: { name: "Ana Kasa", type: AccountType.CASH, openingBalance: 0 },
    });
  }
  if (!(await prisma.financeAccount.findFirst({ where: { name: "İş Bankası", deletedAt: null } }))) {
    await prisma.financeAccount.create({
      data: { name: "İş Bankası", type: AccountType.BANK, openingBalance: 0 },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed OK — admin / admin123", admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
