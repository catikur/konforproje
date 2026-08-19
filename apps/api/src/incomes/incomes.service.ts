import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TaxMode } from "@prisma/client";
import { calculateMoney, ListQuery, VatRate, toTry } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { serializeMany, serializeRecord } from "../common/serialize";
import { writeAudit } from "../common/audit";
import { toDate } from "../common/dates";

const include = {
  categories: { include: { category: true } },
  project: true,
  account: true,
  contract: true,
} as const;

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
      projectId?: string | null;
      accountId?: string | null;
      contractId?: string | null;
      invoiceNo?: string | null;
      dueDate?: string | Date | null;
      currency?: string;
      fxRate?: number;
      paidAmount?: number;
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
    const fx = data.fxRate ?? 1;
    const netAmount = toTry(money.netAmount, fx);
    const vatAmount = toTry(money.vatAmount, fx);
    const grossAmount = toTry(money.grossAmount, fx);
    const income = await this.prisma.income.create({
      data: {
        description: data.description,
        incomeDate: toDate(data.incomeDate),
        amount: money.inputAmount,
        taxMode: data.taxMode,
        vatRate: data.vatRate,
        netAmount,
        vatAmount,
        grossAmount,
        currency: data.currency || "TRY",
        fxRate: fx,
        paidAmount: data.paidAmount ?? 0,
        invoiceNo: data.invoiceNo || null,
        dueDate: data.dueDate ? toDate(data.dueDate) : null,
        projectId: data.projectId || null,
        accountId: data.accountId || null,
        contractId: data.contractId || null,
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
      meta: { grossAmount },
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
      projectId?: string | null;
      accountId?: string | null;
      contractId?: string | null;
      invoiceNo?: string | null;
      dueDate?: string | Date | null;
      currency?: string;
      fxRate?: number;
      paidAmount?: number;
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
    const fx = data.fxRate ?? Number(existing.fxRate);
    const money =
      data.amount != null || data.taxMode != null || data.vatRate != null || data.fxRate != null
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
          dueDate:
            data.dueDate === undefined
              ? undefined
              : data.dueDate
                ? toDate(data.dueDate)
                : null,
          projectId: data.projectId === undefined ? undefined : data.projectId || null,
          accountId: data.accountId === undefined ? undefined : data.accountId || null,
          contractId: data.contractId === undefined ? undefined : data.contractId || null,
          invoiceNo: data.invoiceNo === undefined ? undefined : data.invoiceNo || null,
          currency: data.currency,
          fxRate: data.fxRate,
          paidAmount: data.paidAmount,
          ...(money
            ? {
                amount: money.inputAmount,
                taxMode,
                vatRate,
                netAmount: toTry(money.netAmount, fx),
                vatAmount: toTry(money.vatAmount, fx),
                grossAmount: toTry(money.grossAmount, fx),
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
    if (params.projectId) and.push({ projectId: params.projectId });
    return { AND: and };
  }
}
