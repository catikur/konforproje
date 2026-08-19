-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AccountType" AS ENUM ('BANK', 'CASH');
CREATE TYPE "InstrumentType" AS ENUM ('CHECK', 'NOTE');
CREATE TYPE "InstrumentDirection" AS ENUM ('GIVEN', 'RECEIVED');
CREATE TYPE "InstrumentStatus" AS ENUM ('OPEN', 'PAID', 'BOUNCED', 'CANCELLED');
CREATE TYPE "RecurringTarget" AS ENUM ('EXPENSE', 'BACKLOG');

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'Konfor Proje',
    "approvalLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "defaultVatRate" INTEGER NOT NULL DEFAULT 20,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'BANK',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "iban" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "direction" "BacklogDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "categoryId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "contractAmount" DECIMAL(14,2) NOT NULL,
    "retainagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "startDate" DATE,
    "endDate" DATE,
    "notes" TEXT,
    "projectId" TEXT,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractCollection" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "collectedAt" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringRule" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'INCLUDED',
    "vatRate" INTEGER NOT NULL DEFAULT 20,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "target" "RecurringTarget" NOT NULL DEFAULT 'EXPENSE',
    "categoryId" TEXT,
    "supplierId" TEXT,
    "projectId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedYm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "type" "InstrumentType" NOT NULL,
    "direction" "InstrumentDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "counterparty" TEXT NOT NULL,
    "status" "InstrumentStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Alter existing
ALTER TABLE "Category" ADD COLUMN "budgetLimit" DECIMAL(14,2);

ALTER TABLE "Expense"
  ADD COLUMN "dueDate" DATE,
  ADD COLUMN "fxRate" DECIMAL(12,6) NOT NULL DEFAULT 1,
  ADD COLUMN "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceNo" TEXT,
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "approvedById" TEXT;

ALTER TABLE "Income"
  ADD COLUMN "dueDate" DATE,
  ADD COLUMN "fxRate" DECIMAL(12,6) NOT NULL DEFAULT 1,
  ADD COLUMN "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceNo" TEXT,
  ADD COLUMN "contractId" TEXT,
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "accountId" TEXT;

ALTER TABLE "BacklogItem"
  ADD COLUMN "dueDate" DATE,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN "projectId" TEXT;

ALTER TABLE "Attachment" ADD COLUMN "storageKey" TEXT;
UPDATE "Attachment" SET "storageKey" = "filename" WHERE "storageKey" IS NULL;
ALTER TABLE "Attachment" ALTER COLUMN "storageKey" SET NOT NULL;

CREATE UNIQUE INDEX "Expense_invoiceNo_alive_key" ON "Expense" ("invoiceNo") WHERE "invoiceNo" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "Expense_invoiceNo_idx" ON "Expense"("invoiceNo");
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");
CREATE INDEX "Expense_approvalStatus_idx" ON "Expense"("approvalStatus");
CREATE INDEX "Income_projectId_idx" ON "Income"("projectId");
CREATE INDEX "BacklogItem_projectId_idx" ON "BacklogItem"("projectId");
CREATE INDEX "Budget_periodYear_periodMonth_idx" ON "Budget"("periodYear", "periodMonth");
CREATE INDEX "Instrument_dueDate_status_idx" ON "Instrument"("dueDate", "status");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BacklogItem" ADD CONSTRAINT "BacklogItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractCollection" ADD CONSTRAINT "ContractCollection_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AppSettings" ("id", "companyName", "approvalLimit", "defaultVatRate", "defaultCurrency", "updatedAt")
VALUES ('default', 'Konfor Proje', 0, 20, 'TRY', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
