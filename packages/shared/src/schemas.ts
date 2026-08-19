import { z } from "zod";
import { MoneyInputSchema, TaxModeSchema, VatRateSchema } from "./money";

const emptyToUndef = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

const optInt = (min: number, max: number) =>
  z.preprocess(
    emptyToUndef,
    z.union([z.undefined(), z.coerce.number().int().min(min).max(max)]),
  );

const intWithDefault = (min: number, max: number, def: number) =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return def;
    return Number(v);
  }, z.number().int().min(min).max(max));

export const RoleSchema = z.enum(["ADMIN", "FINANS", "IZLEYICI"]);
export type Role = z.infer<typeof RoleSchema>;

export const CategoryTypeSchema = z.enum(["EXPENSE", "INCOME", "BOTH"]);
export type CategoryType = z.infer<typeof CategoryTypeSchema>;

export const BacklogDirectionSchema = z.enum(["INCOME", "EXPENSE"]);
export type BacklogDirection = z.infer<typeof BacklogDirectionSchema>;

export const BacklogStatusSchema = z.enum([
  "PLANNED",
  "PARTIAL",
  "DONE",
  "CANCELLED",
]);
export type BacklogStatus = z.infer<typeof BacklogStatusSchema>;

export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Tarih YYYY-AA-GG olmalı")
  .or(z.coerce.date());

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(16),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
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
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#2563EB"),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const CategoryUpdateSchema = CategorySchema.partial();

export const SupplierSchema = z.object({
  name: z.string().min(1).max(160),
  taxId: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const SupplierUpdateSchema = SupplierSchema.partial();

export const ExpenseCreateSchema = MoneyInputSchema.extend({
  description: z.string().min(1).max(500),
  expenseDate: DateOnlySchema,
  categoryIds: z.array(z.string().min(1)).min(1),
  supplierId: z.string().min(1).optional().nullable(),
});

export const ExpenseUpdateSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  expenseDate: DateOnlySchema.optional(),
  amount: z.number().positive().optional(),
  taxMode: TaxModeSchema.optional(),
  vatRate: VatRateSchema.optional(),
  categoryIds: z.array(z.string().min(1)).min(1).optional(),
  supplierId: z.string().min(1).optional().nullable(),
});

export const IncomeCreateSchema = MoneyInputSchema.extend({
  description: z.string().min(1).max(500),
  incomeDate: DateOnlySchema,
  categoryIds: z.array(z.string().min(1)).min(1),
});

export const IncomeUpdateSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  incomeDate: DateOnlySchema.optional(),
  amount: z.number().positive().optional(),
  taxMode: TaxModeSchema.optional(),
  vatRate: VatRateSchema.optional(),
  categoryIds: z.array(z.string().min(1)).min(1).optional(),
});

export const BacklogCreateSchema = z.object({
  direction: BacklogDirectionSchema,
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  expectedAmount: z.number().positive(),
  description: z.string().min(1).max(500),
  categoryIds: z.array(z.string().min(1)).default([]),
  status: BacklogStatusSchema.default("PLANNED"),
});

export const BacklogUpdateSchema = BacklogCreateSchema.partial();

export const BacklogCopySchema = z.object({
  fromYear: z.number().int().min(2000).max(2100),
  fromMonth: z.number().int().min(1).max(12),
  toYear: z.number().int().min(2000).max(2100),
  toMonth: z.number().int().min(1).max(12),
});

export const BacklogLinkSchema = z
  .object({
    expenseId: z.string().min(1).optional(),
    incomeId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.expenseId) !== Boolean(v.incomeId), {
    message: "expenseId veya incomeId'den yalnızca biri gönderilmeli",
  });

export const ListQuerySchema = z.object({
  year: optInt(2000, 2100),
  month: optInt(1, 12),
  q: z.preprocess(emptyToUndef, z.string().max(200).optional()),
  categoryId: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  supplierId: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  page: intWithDefault(1, 10_000, 1),
  pageSize: intWithDefault(1, 100, 50),
});

export type ListQuery = z.infer<typeof ListQuerySchema>;

export const PeriodQuerySchema = z.object({
  year: optInt(2000, 2100),
  month: optInt(1, 12),
  months: optInt(3, 24),
});

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
