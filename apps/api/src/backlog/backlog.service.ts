import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BacklogDirection, BacklogStatus, Prisma } from "@prisma/client";
import { ListQuery, toNumber } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { serializeMany, serializeRecord } from "../common/serialize";
import { writeAudit } from "../common/audit";

const include = {
  categories: { include: { category: true } },
  project: true,
  links: {
    include: {
      expense: true,
      income: true,
    },
  },
} as const;

@Injectable()
export class BacklogService {
  constructor(private prisma: PrismaService) {}

  async list(params: ListQuery) {
    const where = this.where(params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.backlogItem.count({ where }),
      this.prisma.backlogItem.findMany({
        where,
        include,
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: serializeMany(rows).map((row) => this.withLinked(row as Record<string, unknown>)),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const row = await this.prisma.backlogItem.findFirst({
      where: { id, deletedAt: null },
      include,
    });
    if (!row) throw new NotFoundException("Backlog kalemi bulunamadı");
    return this.withLinked(serializeRecord(row) as Record<string, unknown>);
  }

  async create(
    data: {
      direction: BacklogDirection;
      periodYear: number;
      periodMonth: number;
      expectedAmount: number;
      description: string;
      categoryIds?: string[];
      status?: BacklogStatus;
      projectId?: string | null;
      dueDate?: string | Date | null;
      currency?: string;
    },
    userId: string,
  ) {
    const item = await this.prisma.backlogItem.create({
      data: {
        direction: data.direction,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        expectedAmount: data.expectedAmount,
        description: data.description,
        status: data.status || BacklogStatus.PLANNED,
        projectId: data.projectId || null,
        currency: data.currency || "TRY",
        createdById: userId,
        categories: {
          create: (data.categoryIds || []).map((categoryId) => ({
            categoryId,
          })),
        },
      },
      include,
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "BACKLOG_CREATE",
      entityType: "BacklogItem",
      entityId: item.id,
    });
    return this.withLinked(serializeRecord(item) as Record<string, unknown>);
  }

  async update(
    id: string,
    data: {
      direction?: BacklogDirection;
      periodYear?: number;
      periodMonth?: number;
      expectedAmount?: number;
      description?: string;
      categoryIds?: string[];
      status?: BacklogStatus;
    },
    userId: string,
  ) {
    await this.ensure(id);
    const item = await this.prisma.$transaction(async (tx) => {
      if (data.categoryIds) {
        await tx.backlogCategory.deleteMany({ where: { backlogId: id } });
      }
      return tx.backlogItem.update({
        where: { id },
        data: {
          direction: data.direction,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
          expectedAmount: data.expectedAmount,
          description: data.description,
          status: data.status,
          ...(data.categoryIds
            ? {
                categories: {
                  create: data.categoryIds.map((categoryId) => ({ categoryId })),
                },
              }
            : {}),
        },
        include,
      });
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "BACKLOG_UPDATE",
      entityType: "BacklogItem",
      entityId: id,
    });
    return this.withLinked(serializeRecord(item) as Record<string, unknown>);
  }

  async copyPeriod(
    data: { fromYear: number; fromMonth: number; toYear: number; toMonth: number },
    userId: string,
  ) {
    if (data.fromYear === data.toYear && data.fromMonth === data.toMonth) {
      throw new BadRequestException("Kaynak ve hedef dönem aynı olamaz");
    }
    const source = await this.prisma.backlogItem.findMany({
      where: {
        deletedAt: null,
        periodYear: data.fromYear,
        periodMonth: data.fromMonth,
        status: { not: BacklogStatus.CANCELLED },
      },
      include: { categories: true },
    });
    const created = [];
    for (const item of source) {
      const copy = await this.prisma.backlogItem.create({
        data: {
          direction: item.direction,
          periodYear: data.toYear,
          periodMonth: data.toMonth,
          expectedAmount: item.expectedAmount,
          description: item.description,
          status: BacklogStatus.PLANNED,
          createdById: userId,
          categories: {
            create: item.categories.map((c) => ({ categoryId: c.categoryId })),
          },
        },
        include,
      });
      created.push(this.withLinked(serializeRecord(copy) as Record<string, unknown>));
    }
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "BACKLOG_COPY",
      entityType: "BacklogItem",
      meta: { ...data, count: created.length },
    });
    return { copied: created.length, items: created };
  }

  async link(
    id: string,
    data: { expenseId?: string; incomeId?: string },
    userId: string,
  ) {
    const item = await this.ensure(id);
    if (data.expenseId) {
      if (item.direction !== BacklogDirection.EXPENSE) {
        throw new BadRequestException("Gider kaydı yalnızca gider planına bağlanır");
      }
      const exp = await this.prisma.expense.findFirst({
        where: { id: data.expenseId, deletedAt: null },
      });
      if (!exp) throw new NotFoundException("Gider bulunamadı");
    }
    if (data.incomeId) {
      if (item.direction !== BacklogDirection.INCOME) {
        throw new BadRequestException("Gelir kaydı yalnızca gelir planına bağlanır");
      }
      const inc = await this.prisma.income.findFirst({
        where: { id: data.incomeId, deletedAt: null },
      });
      if (!inc) throw new NotFoundException("Gelir bulunamadı");
    }
    const link = await this.prisma.backlogLink.create({
      data: {
        backlogId: id,
        expenseId: data.expenseId || null,
        incomeId: data.incomeId || null,
      },
    });
    await this.syncStatus(id);
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "BACKLOG_LINK",
      entityType: "BacklogItem",
      entityId: id,
      meta: data,
    });
    return link;
  }

  async unlink(id: string, linkId: string, userId: string) {
    await this.ensure(id);
    const existing = await this.prisma.backlogLink.findFirst({
      where: { id: linkId, backlogId: id },
    });
    if (!existing) throw new NotFoundException("Bağlantı bulunamadı");
    await this.prisma.backlogLink.delete({ where: { id: linkId } });
    await this.syncStatus(id);
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "BACKLOG_UNLINK",
      entityType: "BacklogItem",
      entityId: id,
    });
    return { ok: true };
  }

  async remove(id: string, userId: string) {
    await this.ensure(id);
    const updated = await this.prisma.backlogItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "BACKLOG_DELETE",
      entityType: "BacklogItem",
      entityId: id,
    });
    return serializeRecord(updated);
  }

  private withLinked(row: Record<string, unknown>) {
    const links = (row.links as Array<{
      expense?: { grossAmount?: number };
      income?: { grossAmount?: number };
    }>) || [];
    const linked = links.reduce((sum, link) => {
      return sum + toNumber(link.expense?.grossAmount) + toNumber(link.income?.grossAmount);
    }, 0);
    return {
      ...row,
      linkedAmount: linked,
      remainingAmount: toNumber(row.expectedAmount as number) - linked,
    };
  }

  private async syncStatus(id: string) {
    const item = await this.prisma.backlogItem.findFirst({
      where: { id },
      include: { links: { include: { expense: true, income: true } } },
    });
    if (!item || item.status === BacklogStatus.CANCELLED) return;
    const linked = item.links.reduce(
      (s, l) => s + toNumber(l.expense?.grossAmount) + toNumber(l.income?.grossAmount),
      0,
    );
    const expected = toNumber(item.expectedAmount);
    let status: BacklogStatus = BacklogStatus.PLANNED;
    if (linked <= 0) status = BacklogStatus.PLANNED;
    else if (linked >= expected) status = BacklogStatus.DONE;
    else status = BacklogStatus.PARTIAL;
    await this.prisma.backlogItem.update({ where: { id }, data: { status } });
  }

  private where(params: ListQuery): Prisma.BacklogItemWhereInput {
    const and: Prisma.BacklogItemWhereInput[] = [{ deletedAt: null }];
    if (params.year) and.push({ periodYear: params.year });
    if (params.month) and.push({ periodMonth: params.month });
    if (params.q) {
      and.push({ description: { contains: params.q, mode: "insensitive" } });
    }
    if (params.categoryId) {
      and.push({ categories: { some: { categoryId: params.categoryId } } });
    }
    if (params.projectId) and.push({ projectId: params.projectId });
    return { AND: and };
  }

  private async ensure(id: string) {
    const existing = await this.prisma.backlogItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Backlog kalemi bulunamadı");
    return existing;
  }
}
