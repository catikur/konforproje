import { z } from "zod";

export const RoleSchema = z.enum(["ADMIN", "FINANS", "IZLEYICI"]);
export type Role = z.infer<typeof RoleSchema>;

export const CategoryTypeSchema = z.enum(["EXPENSE", "INCOME", "BOTH"]);
export type CategoryType = z.infer<typeof CategoryTypeSchema>;

export const TaxModeSchema = z.enum(["INCLUDED", "EXCLUDED"]);
export type TaxMode = z.infer<typeof TaxModeSchema>;

export const VatRateSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(10),
  z.literal(20),
]);
export type VatRate = z.infer<typeof VatRateSchema>;

export const BacklogDirectionSchema = z.enum(["INCOME", "EXPENSE"]);
export type BacklogDirection = z.infer<typeof BacklogDirectionSchema>;

export const BacklogStatusSchema = z.enum([
  "PLANNED",
  "PARTIAL",
  "DONE",
  "CANCELLED",
]);
export type BacklogStatus = z.infer<typeof BacklogStatusSchema>;

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(120),
  role: RoleSchema.default("FINANS"),
});

export const UpdateUserSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  role: RoleSchema.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(128).optional(),
});

export const CategorySchema = z.object({
  name: z.string().min(1).max(80),
  type: CategoryTypeSchema.default("BOTH"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB"),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const SupplierSchema = z.object({
  name: z.string().min(1).max(160),
  taxId: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const MoneyInputSchema = z.object({
  amount: z.number().positive(),
  taxMode: TaxModeSchema.default("INCLUDED"),
  vatRate: VatRateSchema.default(20),
});

export const ExpenseCreateSchema = MoneyInputSchema.extend({
  description: z.string().min(1).max(500),
  expenseDate: z.string().or(z.coerce.date()),
  categoryIds: z.array(z.string().cuid()).min(1),
  supplierId: z.string().cuid().optional().nullable(),
});

export const IncomeCreateSchema = MoneyInputSchema.extend({
  description: z.string().min(1).max(500),
  incomeDate: z.string().or(z.coerce.date()),
  categoryIds: z.array(z.string().cuid()).min(1),
});

export const BacklogCreateSchema = z.object({
  direction: BacklogDirectionSchema,
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  expectedAmount: z.number().positive(),
  description: z.string().min(1).max(500),
  categoryIds: z.array(z.string().cuid()).default([]),
  status: BacklogStatusSchema.default("PLANNED"),
});

export type MoneyBreakdown = {
  inputAmount: number;
  taxMode: TaxMode;
  vatRate: VatRate;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
};

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

  const round2 = (n: number) => Math.round(n * 100) / 100;
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
