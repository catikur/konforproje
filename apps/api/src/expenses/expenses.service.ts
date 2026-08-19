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
import { assertAllowedMime, uploadDir } from "../common/uploads";
import { unlink } from "fs/promises";
import { join } from "path";

const include = {
  categories: { include: { category: true } },
  supplier: true,
  attachments: true,
} as const;

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async list(params: ListQuery) {
    const where = this.where(params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include,
        orderBy: { expenseDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: serializeMany(rows), total, page, pageSize };
  }

  async get(id: string) {
    return serializeRecord(await this.ensure(id, true));
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
        expenseDate: toDate(data.expenseDate),
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
      include,
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "EXPENSE_CREATE",
      entityType: "Expense",
      entityId: expense.id,
      meta: { grossAmount: money.grossAmount },
    });
    return serializeRecord(expense);
  }

  async update(
    id: string,
    data: {
      description?: string;
      expenseDate?: string | Date;
      amount?: number;
      taxMode?: TaxMode;
      vatRate?: number;
      categoryIds?: string[];
      supplierId?: string | null;
    },
    userId: string,
  ) {
    const existing = await this.ensure(id);
    const amount = data.amount ?? Number(existing.amount);
    const taxMode = data.taxMode ?? existing.taxMode;
    const vatRate = data.vatRate ?? existing.vatRate;
    const money =
      data.amount != null || data.taxMode != null || data.vatRate != null
        ? calculateMoney(amount, taxMode, vatRate as VatRate)
        : null;

    const expense = await this.prisma.$transaction(async (tx) => {
      if (data.categoryIds) {
        await tx.expenseCategory.deleteMany({ where: { expenseId: id } });
      }
      return tx.expense.update({
        where: { id },
        data: {
          description: data.description,
          expenseDate: data.expenseDate ? toDate(data.expenseDate) : undefined,
          supplierId:
            data.supplierId === undefined ? undefined : data.supplierId || null,
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
      action: "EXPENSE_UPDATE",
      entityType: "Expense",
      entityId: id,
    });
    return serializeRecord(expense);
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
    assertAllowedMime(file.mimetype);
    const attachment = await this.prisma.attachment.create({
      data: {
        expenseId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "EXPENSE_ATTACHMENT",
      entityType: "Expense",
      entityId: expenseId,
      meta: { filename: file.filename },
    });
    return attachment;
  }

  async removeAttachment(expenseId: string, attachmentId: string, userId: string) {
    await this.ensure(expenseId);
    const att = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, expenseId },
    });
    if (!att) throw new NotFoundException("Ek bulunamadı");
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    try {
      await unlink(join(uploadDir(), att.filename));
    } catch {
      /* ignore missing file */
    }
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "EXPENSE_ATTACHMENT_DELETE",
      entityType: "Expense",
      entityId: expenseId,
    });
    return { ok: true };
  }

  async getAttachment(expenseId: string, attachmentId: string) {
    await this.ensure(expenseId);
    const att = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, expenseId },
    });
    if (!att) throw new NotFoundException("Ek bulunamadı");
    return att;
  }

  async remove(id: string, userId: string) {
    await this.ensure(id);
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "EXPENSE_DELETE",
      entityType: "Expense",
      entityId: id,
    });
    return serializeRecord(updated);
  }

  async restore(id: string, userId: string) {
    const existing = await this.prisma.expense.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException("Gider bulunamadı");
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: null },
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "EXPENSE_RESTORE",
      entityType: "Expense",
      entityId: id,
    });
    return serializeRecord(updated);
  }

  private where(params: ListQuery): Prisma.ExpenseWhereInput {
    const and: Prisma.ExpenseWhereInput[] = [{ deletedAt: null }];
    if (params.year && params.month) {
      and.push({
        expenseDate: {
          gte: new Date(Date.UTC(params.year, params.month - 1, 1)),
          lt: new Date(Date.UTC(params.year, params.month, 1)),
        },
      });
    }
    if (params.q) {
      and.push({
        description: { contains: params.q, mode: "insensitive" },
      });
    }
    if (params.categoryId) {
      and.push({ categories: { some: { categoryId: params.categoryId } } });
    }
    if (params.supplierId) {
      and.push({ supplierId: params.supplierId });
    }
    return { AND: and };
  }

  private async ensure(id: string, withInclude = false) {
    const e = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: withInclude ? include : undefined,
    });
    if (!e) throw new NotFoundException("Gider bulunamadı");
    return e;
  }
}
