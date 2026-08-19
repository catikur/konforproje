import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  computePeriodSummary,
  monthRangeUtc,
  shiftMonth,
  toNumber,
} from "@konfor/shared";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async period(year: number, month: number) {
    const { start, end } = monthRangeUtc(year, month);
    const [
      incomeAgg,
      expenseAgg,
      backlogAggIncome,
      backlogAggExpense,
      incomeCats,
      expenseCats,
      suppliers,
      pendingBacklog,
    ] = await Promise.all([
      this.prisma.income.aggregate({
        where: { deletedAt: null, incomeDate: { gte: start, lt: end } },
        _sum: { grossAmount: true, netAmount: true, vatAmount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { deletedAt: null, expenseDate: { gte: start, lt: end } },
        _sum: { grossAmount: true, netAmount: true, vatAmount: true },
        _count: true,
      }),
      this.prisma.backlogItem.aggregate({
        where: {
          deletedAt: null,
          periodYear: year,
          periodMonth: month,
          status: { not: "CANCELLED" },
          direction: "INCOME",
        },
        _sum: { expectedAmount: true },
        _count: true,
      }),
      this.prisma.backlogItem.aggregate({
        where: {
          deletedAt: null,
          periodYear: year,
          periodMonth: month,
          status: { not: "CANCELLED" },
          direction: "EXPENSE",
        },
        _sum: { expectedAmount: true },
        _count: true,
      }),
      this.categoryBreakdown("income", start, end),
      this.categoryBreakdown("expense", start, end),
      this.supplierBreakdown(start, end),
      this.prisma.backlogItem.findMany({
        where: {
          deletedAt: null,
          periodYear: year,
          periodMonth: month,
          status: { in: ["PLANNED", "PARTIAL"] },
        },
        include: { categories: { include: { category: true } } },
        orderBy: { expectedAmount: "desc" },
        take: 50,
      }),
    ]);

    const summary = computePeriodSummary({
      actualIncome: toNumber(incomeAgg._sum.grossAmount),
      actualExpense: toNumber(expenseAgg._sum.grossAmount),
      expectedIncome: toNumber(backlogAggIncome._sum.expectedAmount),
      expectedExpense: toNumber(backlogAggExpense._sum.expectedAmount),
      actualIncomeNet: toNumber(incomeAgg._sum.netAmount),
      actualIncomeVat: toNumber(incomeAgg._sum.vatAmount),
      actualExpenseNet: toNumber(expenseAgg._sum.netAmount),
      actualExpenseVat: toNumber(expenseAgg._sum.vatAmount),
    });

    return {
      year,
      month,
      ...summary,
      counts: {
        incomes: incomeAgg._count,
        expenses: expenseAgg._count,
        backlog:
          (backlogAggIncome._count as number) + (backlogAggExpense._count as number),
      },
      categoryIncome: incomeCats,
      categoryExpense: expenseCats,
      supplierExpense: suppliers,
      pendingBacklog: pendingBacklog.map((b) => ({
        id: b.id,
        direction: b.direction,
        description: b.description,
        expectedAmount: toNumber(b.expectedAmount),
        status: b.status,
        categories: b.categories.map((c) => c.category.name),
      })),
    };
  }

  async trend(months = 12) {
    const now = new Date();
    const end = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const start = shiftMonth(end.year, end.month, -(months - 1));
    const startDate = monthRangeUtc(start.year, start.month).start;

    const [incomes, expenses, backlog] = await Promise.all([
      this.prisma.$queryRaw<Array<{ y: number; m: number; gross: Prisma.Decimal }>>`
        SELECT EXTRACT(YEAR FROM "incomeDate")::int AS y,
               EXTRACT(MONTH FROM "incomeDate")::int AS m,
               SUM("grossAmount") AS gross
        FROM "Income"
        WHERE "deletedAt" IS NULL AND "incomeDate" >= ${startDate}
        GROUP BY 1, 2
      `,
      this.prisma.$queryRaw<Array<{ y: number; m: number; gross: Prisma.Decimal }>>`
        SELECT EXTRACT(YEAR FROM "expenseDate")::int AS y,
               EXTRACT(MONTH FROM "expenseDate")::int AS m,
               SUM("grossAmount") AS gross
        FROM "Expense"
        WHERE "deletedAt" IS NULL AND "expenseDate" >= ${startDate}
        GROUP BY 1, 2
      `,
      this.prisma.$queryRaw<
        Array<{ y: number; m: number; direction: string; expected: Prisma.Decimal }>
      >`
        SELECT "periodYear" AS y, "periodMonth" AS m, "direction",
               SUM("expectedAmount") AS expected
        FROM "BacklogItem"
        WHERE "deletedAt" IS NULL AND "status" <> 'CANCELLED'
          AND ("periodYear" > ${start.year} OR ("periodYear" = ${start.year} AND "periodMonth" >= ${start.month}))
        GROUP BY 1, 2, 3
      `,
    ]);

    const key = (y: number, m: number) => `${y}-${m}`;
    const incomeMap = new Map(
      incomes.map((r) => [key(Number(r.y), Number(r.m)), toNumber(r.gross)]),
    );
    const expenseMap = new Map(
      expenses.map((r) => [key(Number(r.y), Number(r.m)), toNumber(r.gross)]),
    );
    const expectedIncome = new Map<string, number>();
    const expectedExpense = new Map<string, number>();
    for (const row of backlog) {
      const k = key(Number(row.y), Number(row.m));
      if (row.direction === "INCOME") expectedIncome.set(k, toNumber(row.expected));
      else expectedExpense.set(k, toNumber(row.expected));
    }

    const points = [];
    for (let i = 0; i < months; i++) {
      const p = shiftMonth(start.year, start.month, i);
      const k = key(p.year, p.month);
      const actualIncome = incomeMap.get(k) || 0;
      const actualExpense = expenseMap.get(k) || 0;
      points.push({
        year: p.year,
        month: p.month,
        actualIncome,
        actualExpense,
        expectedIncome: expectedIncome.get(k) || 0,
        expectedExpense: expectedExpense.get(k) || 0,
        netActual: actualIncome - actualExpense,
      });
    }
    return points;
  }

  async excel(year: number, month: number): Promise<Buffer> {
    const period = await this.period(year, month);
    const { start, end } = monthRangeUtc(year, month);
    const [incomes, expenses] = await Promise.all([
      this.prisma.income.findMany({
        where: { deletedAt: null, incomeDate: { gte: start, lt: end } },
        include: { categories: { include: { category: true } } },
        orderBy: { incomeDate: "asc" },
      }),
      this.prisma.expense.findMany({
        where: { deletedAt: null, expenseDate: { gte: start, lt: end } },
        include: {
          categories: { include: { category: true } },
          supplier: true,
        },
        orderBy: { expenseDate: "asc" },
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Konfor Proje";
    const summary = wb.addWorksheet("Ozet");
    summary.addRows([
      ["Konfor Proje dönem raporu"],
      ["Dönem", `${String(month).padStart(2, "0")}/${year}`],
      [],
      ["Kalem", "Tutar"],
      ["Fiili gelir (brüt)", period.actualIncome],
      ["Fiili gelir (net)", period.actualIncomeNet],
      ["Fiili gelir KDV", period.actualIncomeVat],
      ["Fiili gider (brüt)", period.actualExpense],
      ["Fiili gider (net)", period.actualExpenseNet],
      ["Fiili gider KDV", period.actualExpenseVat],
      ["Beklenen gelir", period.expectedIncome],
      ["Beklenen gider", period.expectedExpense],
      ["Gelir Δ", period.deltaIncome],
      ["Gider Δ", period.deltaExpense],
      ["Net fiili", period.netActual],
      ["Net beklenen", period.netExpected],
    ]);
    summary.getColumn(2).numFmt = "#,##0.00";

    const incomeSheet = wb.addWorksheet("Gelirler");
    incomeSheet.addRow(["Tarih", "Açıklama", "Kategoriler", "Net", "KDV", "Brüt", "KDV %", "Vergi"]);
    for (const row of incomes) {
      incomeSheet.addRow([
        row.incomeDate,
        row.description,
        row.categories.map((c) => c.category.name).join(", "),
        toNumber(row.netAmount),
        toNumber(row.vatAmount),
        toNumber(row.grossAmount),
        row.vatRate,
        row.taxMode,
      ]);
    }

    const expenseSheet = wb.addWorksheet("Giderler");
    expenseSheet.addRow([
      "Tarih",
      "Açıklama",
      "Kategoriler",
      "Tedarikçi",
      "Net",
      "KDV",
      "Brüt",
      "KDV %",
      "Vergi",
    ]);
    for (const row of expenses) {
      expenseSheet.addRow([
        row.expenseDate,
        row.description,
        row.categories.map((c) => c.category.name).join(", "),
        row.supplier?.name || "",
        toNumber(row.netAmount),
        toNumber(row.vatAmount),
        toNumber(row.grossAmount),
        row.vatRate,
        row.taxMode,
      ]);
    }

    const catSheet = wb.addWorksheet("Kategori");
    catSheet.addRow(["Yön", "Kategori", "Brüt"]);
    for (const c of period.categoryIncome) catSheet.addRow(["Gelir", c.name, c.gross]);
    for (const c of period.categoryExpense) catSheet.addRow(["Gider", c.name, c.gross]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async categoryBreakdown(kind: "income" | "expense", start: Date, end: Date) {
    if (kind === "income") {
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; name: string; color: string; gross: Prisma.Decimal }>
      >`
        SELECT c.id, c.name, c.color, SUM(i."grossAmount") AS gross
        FROM "Income" i
        JOIN "IncomeCategory" ic ON ic."incomeId" = i.id
        JOIN "Category" c ON c.id = ic."categoryId"
        WHERE i."deletedAt" IS NULL AND i."incomeDate" >= ${start} AND i."incomeDate" < ${end}
        GROUP BY c.id, c.name, c.color
        ORDER BY SUM(i."grossAmount") DESC
      `;
      return rows.map((r) => ({ ...r, gross: toNumber(r.gross) }));
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; color: string; gross: Prisma.Decimal }>
    >`
      SELECT c.id, c.name, c.color, SUM(e."grossAmount") AS gross
      FROM "Expense" e
      JOIN "ExpenseCategory" ec ON ec."expenseId" = e.id
      JOIN "Category" c ON c.id = ec."categoryId"
      WHERE e."deletedAt" IS NULL AND e."expenseDate" >= ${start} AND e."expenseDate" < ${end}
      GROUP BY c.id, c.name, c.color
      ORDER BY SUM(e."grossAmount") DESC
    `;
    return rows.map((r) => ({ ...r, gross: toNumber(r.gross) }));
  }

  private async supplierBreakdown(start: Date, end: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string | null; name: string; gross: Prisma.Decimal }>
    >`
      SELECT s.id, COALESCE(s.name, 'Tedarikçisiz') AS name, SUM(e."grossAmount") AS gross
      FROM "Expense" e
      LEFT JOIN "Supplier" s ON s.id = e."supplierId"
      WHERE e."deletedAt" IS NULL AND e."expenseDate" >= ${start} AND e."expenseDate" < ${end}
      GROUP BY s.id, s.name
      ORDER BY SUM(e."grossAmount") DESC
    `;
    return rows.map((r) => ({ ...r, gross: toNumber(r.gross) }));
  }
}
