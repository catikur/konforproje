import { describe, expect, it } from "vitest";
import { calculateMoney, round2, toNumber } from "./money";
import { computePeriodSummary, shiftMonth } from "./period";
import { ExpenseCreateSchema, ListQuerySchema, LoginSchema } from "./schemas";

describe("calculateMoney", () => {
  it("dahil KDV %20", () => {
    const r = calculateMoney(120, "INCLUDED", 20);
    expect(r.grossAmount).toBe(120);
    expect(r.netAmount).toBe(100);
    expect(r.vatAmount).toBe(20);
  });

  it("hariç KDV %20", () => {
    const r = calculateMoney(100, "EXCLUDED", 20);
    expect(r.netAmount).toBe(100);
    expect(r.vatAmount).toBe(20);
    expect(r.grossAmount).toBe(120);
  });

  it("dahil KDV %10", () => {
    const r = calculateMoney(110, "INCLUDED", 10);
    expect(r.grossAmount).toBe(110);
    expect(r.netAmount).toBe(100);
    expect(r.vatAmount).toBe(10);
  });

  it("KDV %0", () => {
    const r = calculateMoney(50, "INCLUDED", 0);
    expect(r.netAmount).toBe(50);
    expect(r.vatAmount).toBe(0);
    expect(r.grossAmount).toBe(50);
  });
});

describe("computePeriodSummary", () => {
  it("fiili vs beklenen farkları", () => {
    const s = computePeriodSummary({
      actualIncome: 1000,
      actualExpense: 400,
      expectedIncome: 800,
      expectedExpense: 500,
    });
    expect(s.deltaIncome).toBe(200);
    expect(s.deltaExpense).toBe(-100);
    expect(s.netActual).toBe(600);
    expect(s.netExpected).toBe(300);
  });
});

describe("shiftMonth", () => {
  it("ocaktan geriye", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("schemas", () => {
  it("login", () => {
    expect(LoginSchema.parse({ username: "a", password: "b" }).username).toBe("a");
  });

  it("gider en az bir kategori", () => {
    expect(() =>
      ExpenseCreateSchema.parse({
        amount: 10,
        description: "x",
        expenseDate: "2026-08-01",
        categoryIds: [],
      }),
    ).toThrow();
  });

  it("liste query boş stringleri yok sayar", () => {
    const q = ListQuerySchema.parse({ year: "", month: "8", page: "2" });
    expect(q.year).toBeUndefined();
    expect(q.month).toBe(8);
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(50);
  });
});

describe("helpers", () => {
  it("round2 / toNumber", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber(null)).toBe(0);
  });
});
