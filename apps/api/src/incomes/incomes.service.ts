import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TaxMode } from "@prisma/client";
import { calculateMoney, ListQuery, VatRate } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { serializeMany, serializeRecord } from "../common/serialize";
import { writeAudit } from "../common/audit";
import { toDate } from "../common/dates";

const include = { categories: { include: { category: true } } } as const;

@Injectable()
export class IncomesService {
  constructor(private prisma: PrismaService) {}

  async list(params: ListQuery) {
    const where = this.where(params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.income.count({ where }),
      this.prisma.income.findMany({
        where,
        include,
        orderBy: { incomeDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: serializeMany(rows), total, page, pageSize };
  }

  async get(id: string) {
    const row = await this.prisma.income.findFirst({
      where: { id, deletedAt: null },
      include,
    });
    if (!row) throw new NotFoundException("Gelir bulunamadı");
    return serializeRecord(row);
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
        incomeDate: toDate(data.incomeDate),
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
      include,
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "INCOME_CREATE",
      entityType: "Income",
      entityId: income.id,
      meta: { grossAmount: money.grossAmount },
    });
    return serializeRecord(income);
  }

  async update(
    id: string,
    data: {
      description?: string;
      incomeDate?: string | Date;
      amount?: number;
      taxMode?: TaxMode;
      vatRate?: number;
      categoryIds?: string[];
    },
    userId: string,
  ) {
    const existing = await this.prisma.income.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Gelir bulunamadı");
    const amount = data.amount ?? Number(existing.amount);
    const taxMode = data.taxMode ?? existing.taxMode;
    const vatRate = data.vatRate ?? existing.vatRate;
    const money =
      data.amount != null || data.taxMode != null || data.vatRate != null
        ? calculateMoney(amount, taxMode, vatRate as VatRate)
        : null;

    const income = await this.prisma.$transaction(async (tx) => {
      if (data.categoryIds) {
        await tx.incomeCategory.deleteMany({ where: { incomeId: id } });
      }
      return tx.income.update({
        where: { id },
        data: {
          description: data.description,
          incomeDate: data.incomeDate ? toDate(data.incomeDate) : undefined,
          ...(money
            ? {
                amount: money.inputAmount,
                taxMode,
                vatRate,
                netAmount: money.netAmount,
                vatAmount: money.vatAmount,
                grossAmount: money.grossAmount,
              }
            : {}),
          ...(data.categoryIds
            ? {
                categories: {
                  create: data.categoryIds.map((categoryId) => ({ categoryId })),
                },
              }
            : {}),
        },
        include,
      });
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "INCOME_UPDATE",
      entityType: "Income",
      entityId: id,
    });
    return serializeRecord(income);
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
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "INCOME_DELETE",
      entityType: "Income",
      entityId: id,
    });
    return serializeRecord(updated);
  }

  async restore(id: string, userId: string) {
    const existing = await this.prisma.income.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException("Gelir bulunamadı");
    const updated = await this.prisma.income.update({
      where: { id },
      data: { deletedAt: null },
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "INCOME_RESTORE",
      entityType: "Income",
      entityId: id,
    });
    return serializeRecord(updated);
  }

  private where(params: ListQuery): Prisma.IncomeWhereInput {
    const and: Prisma.IncomeWhereInput[] = [{ deletedAt: null }];
    if (params.year && params.month) {
      and.push({
        incomeDate: {
          gte: new Date(Date.UTC(params.year, params.month - 1, 1)),
          lt: new Date(Date.UTC(params.year, params.month, 1)),
        },
      });
    }
    if (params.q) {
      and.push({ description: { contains: params.q, mode: "insensitive" } });
    }
    if (params.categoryId) {
      and.push({ categories: { some: { categoryId: params.categoryId } } });
    }
    return { AND: and };
  }
}
