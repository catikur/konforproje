import { Injectable } from "@nestjs/common";
import { BacklogDirection, BacklogStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function toNumber(v: Prisma.Decimal | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async period(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const [incomes, expenses, backlog] = await Promise.all([
      this.prisma.income.findMany({
        where: {
          deletedAt: null,
          incomeDate: { gte: start, lt: end },
        },
      }),
      this.prisma.expense.findMany({
        where: {
          deletedAt: null,
          expenseDate: { gte: start, lt: end },
        },
      }),
      this.prisma.backlogItem.findMany({
        where: {
          deletedAt: null,
          periodYear: year,
          periodMonth: month,
          status: { not: BacklogStatus.CANCELLED },
        },
      }),
    ]);

    const actualIncome = incomes.reduce(
      (s, i) => s + toNumber(i.grossAmount),
      0,
    );
    const actualExpense = expenses.reduce(
      (s, e) => s + toNumber(e.grossAmount),
      0,
    );
    const expectedIncome = backlog
      .filter((b) => b.direction === BacklogDirection.INCOME)
      .reduce((s, b) => s + toNumber(b.expectedAmount), 0);
    const expectedExpense = backlog
      .filter((b) => b.direction === BacklogDirection.EXPENSE)
      .reduce((s, b) => s + toNumber(b.expectedAmount), 0);

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      year,
      month,
      actualIncome: round2(actualIncome),
      actualExpense: round2(actualExpense),
      expectedIncome: round2(expectedIncome),
      expectedExpense: round2(expectedExpense),
      deltaIncome: round2(actualIncome - expectedIncome),
      deltaExpense: round2(actualExpense - expectedExpense),
      netActual: round2(actualIncome - actualExpense),
      netExpected: round2(expectedIncome - expectedExpense),
      counts: {
        incomes: incomes.length,
        expenses: expenses.length,
        backlog: backlog.length,
      },
    };
  }
}
