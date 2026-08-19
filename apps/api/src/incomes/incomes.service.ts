import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TaxMode } from "@prisma/client";
import { calculateMoney, VatRate } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class IncomesService {
  constructor(private prisma: PrismaService) {}

  list(params: { year?: number; month?: number }) {
    const dateFilter =
      params.year && params.month
        ? {
            incomeDate: {
              gte: new Date(Date.UTC(params.year, params.month - 1, 1)),
              lt: new Date(Date.UTC(params.year, params.month, 1)),
            },
          }
        : {};
    return this.prisma.income.findMany({
      where: { deletedAt: null, ...dateFilter },
      include: { categories: { include: { category: true } } },
      orderBy: { incomeDate: "desc" },
    });
  }

  async create(
    data: {
      description: string;
      incomeDate: string | Date;
      amount: number;
      taxMode: TaxMode;
      vatRate: number;
      categoryIds: string[];
    },
    userId: string,
  ) {
    if (!data.categoryIds?.length) {
      throw new BadRequestException("En az bir kategori seçilmeli");
    }
    const money = calculateMoney(
      Number(data.amount),
      data.taxMode,
      data.vatRate as VatRate,
    );
    const income = await this.prisma.income.create({
      data: {
        description: data.description,
        incomeDate: new Date(data.incomeDate),
        amount: money.inputAmount,
        taxMode: data.taxMode,
        vatRate: data.vatRate,
        netAmount: money.netAmount,
        vatAmount: money.vatAmount,
        grossAmount: money.grossAmount,
        createdById: userId,
        categories: {
          create: data.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: { categories: { include: { category: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "INCOME_CREATE",
        entityType: "Income",
        entityId: income.id,
        meta: { grossAmount: money.grossAmount },
      },
    });
    return income;
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.income.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Gelir bulunamadı");
    const updated = await this.prisma.income.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "INCOME_DELETE",
        entityType: "Income",
        entityId: id,
      },
    });
    return updated;
  }
}
