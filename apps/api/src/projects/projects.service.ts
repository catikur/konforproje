import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.project.findMany({
      where: { deletedAt: null, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: "asc" },
    });
  }

  create(data: { name: string; code?: string | null; notes?: string | null; isActive?: boolean }) {
    return this.prisma.project.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; code: string | null; notes: string | null; isActive: boolean }>) {
    await this.ensure(id);
    return this.prisma.project.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async ensure(id: string) {
    const p = await this.prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException("Proje bulunamadı");
  }
}
