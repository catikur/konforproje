import { Injectable, NotFoundException } from "@nestjs/common";
import { BacklogDirection, BacklogStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BacklogService {
  constructor(private prisma: PrismaService) {}

  list(params: { year?: number; month?: number }) {
    return this.prisma.backlogItem.findMany({
      where: {
        deletedAt: null,
        ...(params.year ? { periodYear: params.year } : {}),
        ...(params.month ? { periodMonth: params.month } : {}),
      },
      include: { categories: { include: { category: true } } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
  }

  async create(
    data: {
      direction: BacklogDirection;
      periodYear: number;
      periodMonth: number;
      expectedAmount: number;
      description: string;
      categoryIds?: string[];
      status?: BacklogStatus;
    },
    userId: string,
  ) {
    const item = await this.prisma.backlogItem.create({
      data: {
        direction: data.direction,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        expectedAmount: data.expectedAmount,
        description: data.description,
        status: data.status || BacklogStatus.PLANNED,
        createdById: userId,
        categories: {
          create: (data.categoryIds || []).map((categoryId) => ({
            categoryId,
          })),
        },
      },
      include: { categories: { include: { category: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "BACKLOG_CREATE",
        entityType: "BacklogItem",
        entityId: item.id,
      },
    });
    return item;
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.backlogItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Backlog kalemi bulunamadı");
    const updated = await this.prisma.backlogItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "BACKLOG_DELETE",
        entityType: "BacklogItem",
        entityId: id,
      },
    });
    return updated;
  }
}
