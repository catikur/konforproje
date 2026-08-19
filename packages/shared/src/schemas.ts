import { z } from "zod";
import { CurrencySchema, MoneyInputSchema, TaxModeSchema, VatRateSchema } from "./money";

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

export const ApprovalStatusSchema = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const AccountTypeSchema = z.enum(["BANK", "CASH"]);
export const InstrumentTypeSchema = z.enum(["CHECK", "NOTE"]);
export const InstrumentDirectionSchema = z.enum(["GIVEN", "RECEIVED"]);
export const InstrumentStatusSchema = z.enum(["OPEN", "PAID", "BOUNCED", "CANCELLED"]);
export const RecurringTargetSchema = z.enum(["EXPENSE", "BACKLOG"]);

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
  projectId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  invoiceNo: z.string().max(80).optional().nullable(),
  dueDate: DateOnlySchema.optional().nullable(),
  currency: CurrencySchema,
  fxRate: z.number().positive().default(1),
  paidAmount: z.number().min(0).optional(),
});

export const ExpenseUpdateSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  expenseDate: DateOnlySchema.optional(),
  amount: z.number().positive().optional(),
  taxMode: TaxModeSchema.optional(),
  vatRate: VatRateSchema.optional(),
  categoryIds: z.array(z.string().min(1)).min(1).optional(),
  supplierId: z.string().min(1).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  invoiceNo: z.string().max(80).optional().nullable(),
  dueDate: DateOnlySchema.optional().nullable(),
  currency: CurrencySchema.optional(),
  fxRate: z.number().positive().optional(),
  paidAmount: z.number().min(0).optional(),
  applyOcr: z.boolean().optional(),
});

export const IncomeCreateSchema = MoneyInputSchema.extend({
  description: z.string().min(1).max(500),
  incomeDate: DateOnlySchema,
  categoryIds: z.array(z.string().min(1)).min(1),
  projectId: z.string().min(1).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  contractId: z.string().min(1).optional().nullable(),
  invoiceNo: z.string().max(80).optional().nullable(),
  dueDate: DateOnlySchema.optional().nullable(),
  currency: CurrencySchema,
  fxRate: z.number().positive().default(1),
  paidAmount: z.number().min(0).optional(),
});

export const IncomeUpdateSchema = IncomeCreateSchema.partial().omit({
  categoryIds: true,
}).extend({
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
  projectId: z.string().min(1).optional().nullable(),
  dueDate: DateOnlySchema.optional().nullable(),
  currency: CurrencySchema,
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
  projectId: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  approvalStatus: z.preprocess(emptyToUndef, ApprovalStatusSchema.optional()),
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

export const ProjectSchema = z.object({
  name: z.string().min(1).max(160),
  code: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});
export const ProjectUpdateSchema = ProjectSchema.partial();

export const SettingsUpdateSchema = z.object({
  companyName: z.string().min(1).max(160).optional(),
  approvalLimit: z.number().min(0).optional(),
  defaultVatRate: VatRateSchema.optional(),
  defaultCurrency: CurrencySchema.optional(),
});

export const FinanceAccountSchema = z.object({
  name: z.string().min(1).max(120),
  type: AccountTypeSchema.default("BANK"),
  currency: CurrencySchema,
  iban: z.string().max(34).optional().nullable(),
  openingBalance: z.number().default(0),
  isActive: z.boolean().default(true),
});
export const FinanceAccountUpdateSchema = FinanceAccountSchema.partial();

export const BudgetSchema = z.object({
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  direction: BacklogDirectionSchema,
  amount: z.number().positive(),
  categoryId: z.string().min(1).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
});

export const ContractSchema = z.object({
  name: z.string().min(1).max(160),
  counterparty: z.string().min(1).max(160),
  contractAmount: z.number().positive(),
  retainagePercent: z.number().min(0).max(100).default(0),
  startDate: DateOnlySchema.optional().nullable(),
  endDate: DateOnlySchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});
export const ContractUpdateSchema = ContractSchema.partial();

export const ContractCollectionSchema = z.object({
  amount: z.number().positive(),
  collectedAt: DateOnlySchema,
  description: z.string().max(300).optional().nullable(),
});

export const RecurringSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  taxMode: TaxModeSchema.default("INCLUDED"),
  vatRate: VatRateSchema.default(20),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  target: RecurringTargetSchema.default("EXPENSE"),
  categoryId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});
export const RecurringUpdateSchema = RecurringSchema.partial();

export const InstrumentSchema = z.object({
  type: InstrumentTypeSchema,
  direction: InstrumentDirectionSchema,
  amount: z.number().positive(),
  dueDate: DateOnlySchema,
  counterparty: z.string().min(1).max(160),
  status: InstrumentStatusSchema.default("OPEN"),
  notes: z.string().max(500).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
});
export const InstrumentUpdateSchema = InstrumentSchema.partial();

export const ApproveSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(300).optional(),
});

export const OcrApplySchema = z.object({
  fields: z.array(z.string()).optional(),
});

