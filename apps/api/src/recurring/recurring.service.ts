import { Injectable } from "@nestjs/common";
import { calculateMoney, toNumber, VatRate } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { writeAudit } from "../common/audit";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { serializeMany, serializeRecord } from "../common/serialize";

@Injectable()
export class RecurringService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private notifications: NotificationsService,
  ) {}

  async list() {
    const rows = await this.prisma.recurringRule.findMany({
      include: { category: true, supplier: true, project: true },
      orderBy: { dayOfMonth: "asc" },
    });
    return serializeMany(rows);
  }

  async create(data: Record<string, unknown>) {
    return serializeRecord(await this.prisma.recurringRule.create({ data: data as never }));
  }

  async update(id: string, data: Record<string, unknown>) {
    return serializeRecord(
      await this.prisma.recurringRule.update({ where: { id }, data: data as never }),
    );
  }

  async generate(year: number, month: number, userId: string) {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const rules = await this.prisma.recurringRule.findMany({ where: { isActive: true } });
    const settings = await this.settings.get();
    const limit = toNumber(settings.approvalLimit);
    const created: string[] = [];
    for (const rule of rules) {
      if (rule.lastGeneratedYm === ym) continue;
      const money = calculateMoney(
        Number(rule.amount),
        rule.taxMode,
        rule.vatRate as VatRate,
      );
      const day = Math.min(rule.dayOfMonth, 28);
      const date = new Date(Date.UTC(year, month - 1, day));
      const approvalStatus = limit > 0 && money.grossAmount > limit ? "PENDING" : "APPROVED";
      if (rule.target === "EXPENSE") {
        const exp = await this.prisma.expense.create({
          data: {
            description: `${rule.description} (${ym})`,
            expenseDate: date,
            amount: money.inputAmount,
            taxMode: rule.taxMode,
            vatRate: rule.vatRate,
            netAmount: money.netAmount,
            vatAmount: money.vatAmount,
            grossAmount: money.grossAmount,
            supplierId: rule.supplierId,
            projectId: rule.projectId,
            createdById: userId,
            approvalStatus,
            categories: rule.categoryId
              ? { create: [{ categoryId: rule.categoryId }] }
              : undefined,
          },
        });
        created.push(exp.id);
        if (approvalStatus === "PENDING") {
          await this.notifications.notifyAdmins({
            title: "Onay bekleyen tekrarlayan gider",
            body: `${rule.description} · ${money.grossAmount}`,
            entityType: "Expense",
            entityId: exp.id,
          });
        }
      } else {
        const item = await this.prisma.backlogItem.create({
          data: {
            direction: "EXPENSE",
            periodYear: year,
            periodMonth: month,
            expectedAmount: money.grossAmount,
            description: `${rule.description} (${ym})`,
            createdById: userId,
            projectId: rule.projectId,
            categories: rule.categoryId
              ? { create: [{ categoryId: rule.categoryId }] }
              : undefined,
          },
        });
        created.push(item.id);
      }
      await this.prisma.recurringRule.update({
        where: { id: rule.id },
        data: { lastGeneratedYm: ym },
      });
    }
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "RECURRING_GENERATE",
      entityType: "RecurringRule",
      meta: { ym, count: created.length },
    });
    return { generated: created.length, ids: created };
  }
}
