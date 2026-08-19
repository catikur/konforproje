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
      projects,
    ] = await Promise.all([
      this.prisma.income.aggregate({
        where: { deletedAt: null, incomeDate: { gte: start, lt: end } },
        _sum: { grossAmount: true, netAmount: true, vatAmount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: {
          deletedAt: null,
          approvalStatus: "APPROVED",
          expenseDate: { gte: start, lt: end },
        },
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
      this.projectBreakdown(year, month),
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
      projects,
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
        WHERE "deletedAt" IS NULL AND "approvalStatus" = 'APPROVED' AND "expenseDate" >= ${startDate}
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
        where: { deletedAt: null, approvalStatus: "APPROVED", expenseDate: { gte: start, lt: end } },
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
      WHERE e."deletedAt" IS NULL AND e."approvalStatus" = 'APPROVED' AND e."expenseDate" >= ${start} AND e."expenseDate" < ${end}
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
      WHERE e."deletedAt" IS NULL AND e."approvalStatus" = 'APPROVED' AND e."expenseDate" >= ${start} AND e."expenseDate" < ${end}
      GROUP BY s.id, s.name
      ORDER BY SUM(e."grossAmount") DESC
    `;
    return rows.map((r) => ({ ...r, gross: toNumber(r.gross) }));
  }

  async cashflow(year: number, month: number) {
    const { start, end } = monthRangeUtc(year, month);
    const [expenses, incomes, backlog, instruments] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          deletedAt: null,
          approvalStatus: { not: "REJECTED" },
          OR: [
            { dueDate: { gte: start, lt: end } },
            { dueDate: null, expenseDate: { gte: start, lt: end } },
          ],
        },
      }),
      this.prisma.income.findMany({
        where: {
          deletedAt: null,
          OR: [
            { dueDate: { gte: start, lt: end } },
            { dueDate: null, incomeDate: { gte: start, lt: end } },
          ],
        },
      }),
      this.prisma.backlogItem.findMany({
        where: {
          deletedAt: null,
          status: { not: "CANCELLED" },
          periodYear: year,
          periodMonth: month,
        },
      }),
      this.prisma.instrument.findMany({
        where: { deletedAt: null, status: "OPEN", dueDate: { gte: start, lt: end } },
      }),
    ]);
    const weeks: Array<{ week: number; inflow: number; outflow: number; items: string[] }> = [];
    for (let w = 1; w <= 5; w++) weeks.push({ week: w, inflow: 0, outflow: 0, items: [] });
    const weekOf = (d: Date) => Math.min(5, Math.floor((d.getUTCDate() - 1) / 7) + 1);
    for (const i of incomes) {
      const d = i.dueDate || i.incomeDate;
      const w = weeks[weekOf(d) - 1];
      w.inflow += toNumber(i.grossAmount) - toNumber(i.paidAmount);
      w.items.push(`Gelir ${i.description}`);
    }
    for (const e of expenses) {
      const d = e.dueDate || e.expenseDate;
      const w = weeks[weekOf(d) - 1];
      w.outflow += toNumber(e.grossAmount) - toNumber(e.paidAmount);
      w.items.push(`Gider ${e.description}`);
    }
    for (const b of backlog) {
      const w = weeks[0];
      if (b.direction === "INCOME") w.inflow += toNumber(b.expectedAmount);
      else w.outflow += toNumber(b.expectedAmount);
      w.items.push(`Plan ${b.description}`);
    }
    for (const n of instruments) {
      const w = weeks[weekOf(n.dueDate) - 1];
      if (n.direction === "RECEIVED") w.inflow += toNumber(n.amount);
      else w.outflow += toNumber(n.amount);
      w.items.push(`${n.type} ${n.counterparty}`);
    }
    return weeks.map((w) => ({ ...w, net: w.inflow - w.outflow }));
  }

  async aging() {
    const today = new Date();
    const expenses = await this.prisma.expense.findMany({
      where: { deletedAt: null, approvalStatus: "APPROVED" },
      include: { supplier: true },
    });
    const buckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    const bySupplier: Record<string, { name: string; open: number; d0_30: number; d31_60: number; d61_90: number; d90p: number }> = {};
    for (const e of expenses) {
      const open = toNumber(e.grossAmount) - toNumber(e.paidAmount);
      if (open <= 0) continue;
      const due = e.dueDate || e.expenseDate;
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const key = !e.supplier ? "Tedarikçisiz" : e.supplier.name;
      if (!bySupplier[key]) {
        bySupplier[key] = { name: key, open: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
      }
      bySupplier[key].open += open;
      if (days <= 30) {
        buckets.d0_30 += open;
        bySupplier[key].d0_30 += open;
      } else if (days <= 60) {
        buckets.d31_60 += open;
        bySupplier[key].d31_60 += open;
      } else if (days <= 90) {
        buckets.d61_90 += open;
        bySupplier[key].d61_90 += open;
      } else {
        buckets.d90p += open;
        bySupplier[key].d90p += open;
      }
    }
    return { buckets, suppliers: Object.values(bySupplier) };
  }

  async projectBreakdown(year: number, month: number) {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string | null; name: string; income: Prisma.Decimal; expense: Prisma.Decimal }>
    >`
      SELECT p.id, COALESCE(p.name, 'Projesiz') AS name,
        COALESCE((
          SELECT SUM(i."grossAmount") FROM "Income" i
          WHERE i."deletedAt" IS NULL AND i."projectId" IS NOT DISTINCT FROM p.id
            AND i."incomeDate" >= ${start} AND i."incomeDate" < ${end}
        ), 0) AS income,
        COALESCE((
          SELECT SUM(e."grossAmount") FROM "Expense" e
          WHERE e."deletedAt" IS NULL AND e."approvalStatus" = 'APPROVED'
            AND e."projectId" IS NOT DISTINCT FROM p.id
            AND e."expenseDate" >= ${start} AND e."expenseDate" < ${end}
        ), 0) AS expense
      FROM (SELECT id, name FROM "Project" WHERE "deletedAt" IS NULL
            UNION ALL SELECT NULL::text, 'Projesiz') p
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      income: toNumber(r.income),
      expense: toNumber(r.expense),
      net: toNumber(r.income) - toNumber(r.expense),
    }));
  }

  async pdf(year: number, month: number): Promise<Buffer> {
    const period = await this.period(year, month);
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
    doc.fontSize(18).text("Konfor Proje — Dönem özeti", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Dönem: ${String(month).padStart(2, "0")}/${year}`);
    doc.moveDown();
    const lines: Array<[string, number]> = [
      ["Fiili gelir", period.actualIncome],
      ["Fiili gider", period.actualExpense],
      ["Net fiili", period.netActual],
      ["Beklenen gelir", period.expectedIncome],
      ["Beklenen gider", period.expectedExpense],
      ["Net beklenen", period.netExpected],
    ];
    for (const [label, value] of lines) {
      doc.text(`${label}: ${value.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}`);
    }
    doc.end();
    return done;
  }
}
