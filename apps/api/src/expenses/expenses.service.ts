import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TaxMode } from "@prisma/client";
import { calculateMoney, VatRate } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  list(params: { year?: number; month?: number }) {
    const dateFilter =
      params.year && params.month
        ? {
            expenseDate: {
              gte: new Date(Date.UTC(params.year, params.month - 1, 1)),
              lt: new Date(Date.UTC(params.year, params.month, 1)),
            },
          }
        : {};
    return this.prisma.expense.findMany({
      where: { deletedAt: null, ...dateFilter },
      include: {
        categories: { include: { category: true } },
        supplier: true,
        attachments: true,
      },
      orderBy: { expenseDate: "desc" },
    });
  }

  async create(
    data: {
      description: string;
      expenseDate: string | Date;
      amount: number;
      taxMode: TaxMode;
      vatRate: number;
      categoryIds: string[];
      supplierId?: string | null;
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
    const expense = await this.prisma.expense.create({
      data: {
        description: data.description,
        expenseDate: new Date(data.expenseDate),
        amount: money.inputAmount,
        taxMode: data.taxMode,
        vatRate: data.vatRate,
        netAmount: money.netAmount,
        vatAmount: money.vatAmount,
        grossAmount: money.grossAmount,
        supplierId: data.supplierId || null,
        createdById: userId,
        categories: {
          create: data.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: {
        categories: { include: { category: true } },
        supplier: true,
        attachments: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "EXPENSE_CREATE",
        entityType: "Expense",
        entityId: expense.id,
        meta: { grossAmount: money.grossAmount },
      },
    });
    return expense;
  }

  async addAttachment(
    expenseId: string,
    file: {
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
    },
    userId: string,
  ) {
    await this.ensure(expenseId);
    const attachment = await this.prisma.attachment.create({
      data: {
        expenseId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "EXPENSE_ATTACHMENT",
        entityType: "Expense",
        entityId: expenseId,
        meta: { filename: file.filename },
      },
    });
    return attachment;
  }

  async remove(id: string, userId: string) {
    await this.ensure(id);
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "EXPENSE_DELETE",
        entityType: "Expense",
        entityId: id,
      },
    });
    return updated;
  }

  private async ensure(id: string) {
    const e = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!e) throw new NotFoundException("Gider bulunamadı");
    return e;
  }
}
