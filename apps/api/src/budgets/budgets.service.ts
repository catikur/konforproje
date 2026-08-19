import { Injectable } from "@nestjs/common";
import { BacklogDirection } from "@prisma/client";
import { toNumber } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { monthRangeUtc } from "@konfor/shared";
import { serializeMany, serializeRecord } from "../common/serialize";

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async list(year: number, month: number) {
    return serializeMany(
      await this.prisma.budget.findMany({
        where: { periodYear: year, periodMonth: month },
        include: { category: true, project: true },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  create(data: {
    periodYear: number;
    periodMonth: number;
    direction: BacklogDirection;
    amount: number;
    categoryId?: string | null;
    projectId?: string | null;
  }) {
    return this.prisma.budget.create({
      data,
      include: { category: true, project: true },
    }).then(serializeRecord);
  }

  async alerts(year: number, month: number) {
    const { start, end } = monthRangeUtc(year, month);
    const [budgets, expenses, incomes] = await Promise.all([
      this.list(year, month),
      this.prisma.expense.findMany({
        where: {
          deletedAt: null,
          approvalStatus: "APPROVED",
          expenseDate: { gte: start, lt: end },
        },
        include: { categories: true },
      }),
      this.prisma.income.findMany({
        where: { deletedAt: null, incomeDate: { gte: start, lt: end } },
        include: { categories: true },
      }),
    ]);
    return budgets.map((b) => {
      const rows = b.direction === "EXPENSE" ? expenses : incomes;
      const actual = rows
        .filter((r) => {
          const catOk = !b.categoryId || r.categories.some((c) => c.categoryId === b.categoryId);
          const projOk = !b.projectId || r.projectId === b.projectId;
          return catOk && projOk;
        })
        .reduce((s, r) => s + toNumber(r.grossAmount), 0);
      const amount = toNumber(b.amount);
      return {
        ...b,
        amount,
        actual,
        over: actual > amount,
        remaining: amount - actual,
      };
    });
  }
}
