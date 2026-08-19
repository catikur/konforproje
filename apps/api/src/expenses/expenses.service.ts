import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApprovalStatus, Prisma, TaxMode } from "@prisma/client";
import { calculateMoney, ListQuery, VatRate, toNumber, toTry } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { serializeMany, serializeRecord } from "../common/serialize";
import { writeAudit } from "../common/audit";
import { toDate } from "../common/dates";
import { assertAllowedMime } from "../common/uploads";
import { StorageService } from "../storage/storage.service";
import { OcrService } from "../ocr/ocr.service";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { OcrSuggestion } from "../ocr/extract";

const include = {
  categories: { include: { category: true } },
  supplier: true,
  project: true,
  account: true,
  attachments: true,
} as const;

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private ocr: OcrService,
    private settings: SettingsService,
    private notifications: NotificationsService,
  ) {}

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
      projectId?: string | null;
      accountId?: string | null;
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
    await this.assertInvoice(data.invoiceNo);
    const money = calculateMoney(
      Number(data.amount),
      data.taxMode,
      data.vatRate as VatRate,
    );
    const fx = data.fxRate ?? 1;
    const netAmount = toTry(money.netAmount, fx);
    const vatAmount = toTry(money.vatAmount, fx);
    const grossAmount = toTry(money.grossAmount, fx);
    const approvalStatus = await this.statusFor(grossAmount);
    const expense = await this.prisma.expense.create({
      data: {
        description: data.description,
        expenseDate: toDate(data.expenseDate),
        dueDate: data.dueDate ? toDate(data.dueDate) : null,
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
        approvalStatus,
        supplierId: data.supplierId || null,
        projectId: data.projectId || null,
        accountId: data.accountId || null,
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
      meta: { grossAmount, approvalStatus },
    });
    if (approvalStatus === "PENDING") {
      await this.notifications.notifyAdmins({
        title: "Onay bekleyen gider",
        body: `${data.description} · ${grossAmount}`,
        entityType: "Expense",
        entityId: expense.id,
      });
    }
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
      projectId?: string | null;
      accountId?: string | null;
      invoiceNo?: string | null;
      dueDate?: string | Date | null;
      currency?: string;
      fxRate?: number;
      paidAmount?: number;
    },
    userId: string,
  ) {
    const existing = await this.ensure(id);
    if (data.invoiceNo !== undefined) await this.assertInvoice(data.invoiceNo, id);
    const amount = data.amount ?? Number(existing.amount);
    const taxMode = data.taxMode ?? existing.taxMode;
    const vatRate = data.vatRate ?? existing.vatRate;
    const fx = data.fxRate ?? Number(existing.fxRate);
    const money =
      data.amount != null || data.taxMode != null || data.vatRate != null || data.fxRate != null
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
          dueDate:
            data.dueDate === undefined
              ? undefined
              : data.dueDate
                ? toDate(data.dueDate)
                : null,
          supplierId: data.supplierId === undefined ? undefined : data.supplierId || null,
          projectId: data.projectId === undefined ? undefined : data.projectId || null,
          accountId: data.accountId === undefined ? undefined : data.accountId || null,
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
      action: "EXPENSE_UPDATE",
      entityType: "Expense",
      entityId: id,
    });
    return serializeRecord(expense);
  }

  async applyOcr(id: string, userId: string) {
    const existing = await this.ensure(id, true);
    const suggestion = (existing.ocrRawJson || {}) as OcrSuggestion;
    if (existing.ocrStatus !== "DONE" || suggestion.skipped) {
      throw new BadRequestException("Uygulanacak OCR önerisi yok");
    }
    const patch: Parameters<ExpensesService["update"]>[1] = {};
    if (suggestion.description) patch.description = suggestion.description;
    if (suggestion.amount) patch.amount = suggestion.amount;
    if (suggestion.expenseDate) patch.expenseDate = suggestion.expenseDate;
    if (suggestion.vatRate != null) patch.vatRate = suggestion.vatRate;
    if (suggestion.taxMode) patch.taxMode = suggestion.taxMode as TaxMode;
    if (suggestion.invoiceNo) patch.invoiceNo = suggestion.invoiceNo;
    if (suggestion.supplierName) {
      const supplier = await this.findOrCreateSupplier(suggestion.supplierName);
      patch.supplierId = supplier.id;
    }
    return this.update(id, patch, userId);
  }

  async decide(id: string, approve: boolean, userId: string) {
    await this.ensure(id);
    const status: ApprovalStatus = approve ? "APPROVED" : "REJECTED";
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { approvalStatus: status, approvedById: userId },
      include,
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: approve ? "EXPENSE_APPROVE" : "EXPENSE_REJECT",
      entityType: "Expense",
      entityId: id,
    });
    await this.notifications.notify({
      userId: updated.createdById,
      title: approve ? "Gider onaylandı" : "Gider reddedildi",
      body: updated.description,
      entityType: "Expense",
      entityId: id,
    });
    return serializeRecord(updated);
  }

  async addAttachment(
    expenseId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    userId: string,
  ) {
    await this.ensure(expenseId);
    assertAllowedMime(file.mimetype);
    const key = this.storage.keyFor(file.originalname);
    await this.storage.put(file.buffer, key, file.mimetype);
    const attachment = await this.prisma.attachment.create({
      data: {
        expenseId,
        filename: key,
        storageKey: key,
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
      meta: { filename: key },
    });
    await this.ocr.enqueue(expenseId, attachment.id);
    return attachment;
  }

  async removeAttachment(expenseId: string, attachmentId: string, userId: string) {
    await this.ensure(expenseId);
    const att = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, expenseId },
    });
    if (!att) throw new NotFoundException("Ek bulunamadı");
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(att.storageKey);
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

  async attachmentStream(expenseId: string, attachmentId: string) {
    const att = await this.getAttachment(expenseId, attachmentId);
    return { att, stream: await this.storage.getStream(att.storageKey) };
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

  private async statusFor(gross: number): Promise<ApprovalStatus> {
    const settings = await this.settings.get();
    const limit = toNumber(settings.approvalLimit);
    if (limit > 0 && gross > limit) return "PENDING";
    return "APPROVED";
  }

  private async assertInvoice(invoiceNo?: string | null, excludeId?: string) {
    if (!invoiceNo) return;
    const dup = await this.prisma.expense.findFirst({
      where: {
        invoiceNo,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) throw new ConflictException("Bu fatura no zaten kayıtlı");
  }

  private async findOrCreateSupplier(name: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
    });
    if (existing) return existing;
    return this.prisma.supplier.create({ data: { name } });
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
        OR: [
          { description: { contains: params.q, mode: "insensitive" } },
          { invoiceNo: { contains: params.q, mode: "insensitive" } },
        ],
      });
    }
    if (params.categoryId) {
      and.push({ categories: { some: { categoryId: params.categoryId } } });
    }
    if (params.supplierId) and.push({ supplierId: params.supplierId });
    if (params.projectId) and.push({ projectId: params.projectId });
    if (params.approvalStatus) and.push({ approvalStatus: params.approvalStatus });
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
