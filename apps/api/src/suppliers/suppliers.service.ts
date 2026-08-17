import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.supplier.findMany({
      where: {
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  create(data: {
    name: string;
    taxId?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }) {
    return this.prisma.supplier.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      taxId: string | null;
      notes: string | null;
      isActive: boolean;
    }>,
  ) {
    await this.ensure(id);
    return this.prisma.supplier.update({ where: { id }, data });
  }

  private async ensure(id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!s) throw new NotFoundException("Tedarikçi bulunamadı");
  }
}
