import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toDate } from "../common/dates";
import { serializeMany, serializeRecord } from "../common/serialize";

@Injectable()
export class InstrumentsService {
  constructor(private prisma: PrismaService) {}

  async list(status?: string) {
    return serializeMany(
      await this.prisma.instrument.findMany({
        where: {
          deletedAt: null,
          ...(status ? { status: status as never } : {}),
        },
        include: { account: true },
        orderBy: { dueDate: "asc" },
      }),
    );
  }

  create(data: Record<string, unknown>) {
    return this.prisma.instrument
      .create({
        data: {
          type: data.type as never,
          direction: data.direction as never,
          amount: data.amount as number,
          dueDate: toDate(data.dueDate as string),
          counterparty: data.counterparty as string,
          status: (data.status as never) || "OPEN",
          notes: (data.notes as string) || null,
          accountId: (data.accountId as string) || null,
        },
        include: { account: true },
      })
      .then(serializeRecord);
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.ensure(id);
    return serializeRecord(
      await this.prisma.instrument.update({
        where: { id },
        data: {
          ...(data.status ? { status: data.status as never } : {}),
          ...(data.notes !== undefined ? { notes: data.notes as string } : {}),
          ...(data.amount != null ? { amount: data.amount as number } : {}),
          ...(data.dueDate ? { dueDate: toDate(data.dueDate as string) } : {}),
        },
        include: { account: true },
      }),
    );
  }

  async upcoming(days = 14) {
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + days);
    return serializeMany(
      await this.prisma.instrument.findMany({
        where: {
          deletedAt: null,
          status: "OPEN",
          dueDate: { lte: until },
        },
        orderBy: { dueDate: "asc" },
      }),
    );
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.instrument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensure(id: string) {
    const i = await this.prisma.instrument.findFirst({ where: { id, deletedAt: null } });
    if (!i) throw new NotFoundException("Çek/senet bulunamadı");
  }
}
