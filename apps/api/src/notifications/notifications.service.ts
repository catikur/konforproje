import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(data: {
    userId?: string | null;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId ?? null,
        title: data.title,
        body: data.body,
        entityType: data.entityType,
        entityId: data.entityId,
      },
    });
  }

  async notifyAdmins(data: Omit<Parameters<NotificationsService["notify"]>[0], "userId">) {
    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    await Promise.all(admins.map((a) => this.notify({ ...data, userId: a.id })));
  }

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
