import { Injectable, NotFoundException } from "@nestjs/common";
import { CategoryType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  create(data: {
    name: string;
    type?: CategoryType;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return this.prisma.category.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      type: CategoryType;
      color: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    await this.ensure(id);
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async ensure(id: string) {
    const c = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });
    if (!c) throw new NotFoundException("Kategori bulunamadı");
  }
}
