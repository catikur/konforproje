import { z } from "zod";

export const TaxModeSchema = z.enum(["INCLUDED", "EXCLUDED"]);
export type TaxMode = z.infer<typeof TaxModeSchema>;

export const VatRateSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(10),
  z.literal(20),
]);
export type VatRate = z.infer<typeof VatRateSchema>;

export const MoneyInputSchema = z.object({
  amount: z.number().positive(),
  taxMode: TaxModeSchema.default("INCLUDED"),
  vatRate: VatRateSchema.default(20),
});

export type MoneyBreakdown = {
  inputAmount: number;
  taxMode: TaxMode;
  vatRate: VatRate;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Tutar ve KDV ayrımından net / KDV / brüt hesaplar (TRY, 2 hane). */
export function calculateMoney(
  amount: number,
  taxMode: TaxMode,
  vatRate: VatRate,
): MoneyBreakdown {
  const rate = vatRate / 100;
  let netAmount: number;
  let vatAmount: number;
  let grossAmount: number;

  if (taxMode === "INCLUDED") {
    grossAmount = amount;
    netAmount = amount / (1 + rate);
    vatAmount = grossAmount - netAmount;
  } else {
    netAmount = amount;
    vatAmount = amount * rate;
    grossAmount = netAmount + vatAmount;
  }

  return {
    inputAmount: round2(amount),
    taxMode,
    vatRate,
    netAmount: round2(netAmount),
    vatAmount: round2(vatAmount),
    grossAmount: round2(grossAmount),
  };
}

export function formatTry(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

export function toNumber(v: { toNumber?: () => number } | number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (typeof v.toNumber === "function") return v.toNumber();
  return Number(v) || 0;
}

export function toTry(amount: number, fxRate = 1): number {
  return round2(amount * (fxRate || 1));
}

export const CurrencySchema = z
  .string()
  .length(3)
  .transform((s) => s.toUpperCase())
  .default("TRY");
