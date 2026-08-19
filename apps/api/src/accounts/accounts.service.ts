import { Injectable, NotFoundException } from "@nestjs/common";
import { AccountType } from "@prisma/client";
import { toNumber } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { serializeMany, serializeRecord } from "../common/serialize";

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async list(activeOnly = false) {
    return serializeMany(
      await this.prisma.financeAccount.findMany({
        where: { deletedAt: null, ...(activeOnly ? { isActive: true } : {}) },
        orderBy: { name: "asc" },
      }),
    );
  }

  create(data: {
    name: string;
    type?: AccountType;
    currency?: string;
    iban?: string | null;
    openingBalance?: number;
    isActive?: boolean;
  }) {
    return this.prisma.financeAccount.create({ data }).then(serializeRecord);
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.ensure(id);
    return serializeRecord(
      await this.prisma.financeAccount.update({ where: { id }, data: data as never }),
    );
  }

  async balances() {
    const accounts = await this.list(true);
    const result = [];
    for (const a of accounts) {
      const [exp, inc] = await Promise.all([
        this.prisma.expense.aggregate({
          where: { deletedAt: null, accountId: a.id, approvalStatus: "APPROVED" },
          _sum: { paidAmount: true },
        }),
        this.prisma.income.aggregate({
          where: { deletedAt: null, accountId: a.id },
          _sum: { paidAmount: true },
        }),
      ]);
      const opening = toNumber(a.openingBalance);
      const out = toNumber(exp._sum.paidAmount);
      const inn = toNumber(inc._sum.paidAmount);
      result.push({
        ...a,
        openingBalance: opening,
        paidOut: out,
        paidIn: inn,
        balance: opening + inn - out,
      });
    }
    return result;
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.financeAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async ensure(id: string) {
    const a = await this.prisma.financeAccount.findFirst({ where: { id, deletedAt: null } });
    if (!a) throw new NotFoundException("Hesap bulunamadı");
  }
}
