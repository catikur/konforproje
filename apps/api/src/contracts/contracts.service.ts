import { Injectable, NotFoundException } from "@nestjs/common";
import { toNumber } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toDate } from "../common/dates";
import { serializeRecord } from "../common/serialize";

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.contract.findMany({
      where: { deletedAt: null },
      include: { project: true, collections: true },
      orderBy: { createdAt: "desc" },
    }).then((rows) => rows.map((r) => this.withTotals(r)));
  }

  async get(id: string) {
    const row = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: { project: true, collections: true, incomes: true },
    });
    if (!row) throw new NotFoundException("Sözleşme bulunamadı");
    return this.withTotals(row);
  }

  create(data: Record<string, unknown>) {
    return this.prisma.contract.create({
      data: this.map(data),
      include: { project: true, collections: true },
    }).then((r) => this.withTotals(r));
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.ensure(id);
    return this.prisma.contract.update({
      where: { id },
      data: this.map(data, true),
      include: { project: true, collections: true },
    }).then((r) => this.withTotals(r));
  }

  async addCollection(id: string, data: { amount: number; collectedAt: string | Date; description?: string | null }) {
    await this.ensure(id);
    await this.prisma.contractCollection.create({
      data: {
        contractId: id,
        amount: data.amount,
        collectedAt: toDate(data.collectedAt),
        description: data.description,
      },
    });
    return this.get(id);
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private withTotals(row: {
    contractAmount: unknown;
    retainagePercent: unknown;
    collections?: Array<{ amount: unknown }>;
  }) {
    const contractAmount = toNumber(row.contractAmount);
    const retainage = contractAmount * (toNumber(row.retainagePercent) / 100);
    const collected = (row.collections || []).reduce((s, c) => s + toNumber(c.amount), 0);
    const net = contractAmount - retainage;
    return {
      ...serializeRecord(row),
      contractAmount,
      retainage,
      collected,
      remaining: net - collected,
    };
  }

  private map(data: Record<string, unknown>, partial = false) {
    const out: Record<string, unknown> = {};
    const keys = [
      "name",
      "counterparty",
      "contractAmount",
      "retainagePercent",
      "notes",
      "projectId",
      "supplierId",
      "isActive",
    ];
    for (const k of keys) {
      if (data[k] !== undefined) out[k] = data[k] === "" ? null : data[k];
    }
    if (data.startDate !== undefined) out.startDate = data.startDate ? toDate(data.startDate as string) : null;
    if (data.endDate !== undefined) out.endDate = data.endDate ? toDate(data.endDate as string) : null;
    return out;
  }

  private async ensure(id: string) {
    const c = await this.prisma.contract.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw new NotFoundException("Sözleşme bulunamadı");
  }
}
