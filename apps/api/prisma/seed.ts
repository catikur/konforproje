import { PrismaClient, Role, CategoryType } from "@prisma/client";
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

  const supplier = await prisma.supplier.findFirst({
    where: { name: "Örnek Tedarik Ltd.", deletedAt: null },
  });
  if (!supplier) {
    await prisma.supplier.create({
      data: { name: "Örnek Tedarik Ltd.", taxId: "1234567890" },
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
