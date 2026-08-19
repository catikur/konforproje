import { round2 } from "./money";

export type PeriodTotals = {
  actualIncome: number;
  actualExpense: number;
  expectedIncome: number;
  expectedExpense: number;
  actualIncomeNet?: number;
  actualIncomeVat?: number;
  actualExpenseNet?: number;
  actualExpenseVat?: number;
};

export type PeriodSummary = {
  actualIncome: number;
  actualExpense: number;
  expectedIncome: number;
  expectedExpense: number;
  actualIncomeNet: number;
  actualIncomeVat: number;
  actualExpenseNet: number;
  actualExpenseVat: number;
  deltaIncome: number;
  deltaExpense: number;
  netActual: number;
  netExpected: number;
};

export function computePeriodSummary(t: PeriodTotals): PeriodSummary {
  const actualIncome = round2(t.actualIncome);
  const actualExpense = round2(t.actualExpense);
  const expectedIncome = round2(t.expectedIncome);
  const expectedExpense = round2(t.expectedExpense);
  return {
    actualIncome,
    actualExpense,
    expectedIncome,
    expectedExpense,
    actualIncomeNet: round2(t.actualIncomeNet ?? actualIncome),
    actualIncomeVat: round2(t.actualIncomeVat ?? 0),
    actualExpenseNet: round2(t.actualExpenseNet ?? actualExpense),
    actualExpenseVat: round2(t.actualExpenseVat ?? 0),
    deltaIncome: round2(actualIncome - expectedIncome),
    deltaExpense: round2(actualExpense - expectedExpense),
    netActual: round2(actualIncome - actualExpense),
    netExpected: round2(expectedIncome - expectedExpense),
  };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function monthRangeUtc(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}
