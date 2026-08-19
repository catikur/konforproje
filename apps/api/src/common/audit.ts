import { PrismaService } from "../prisma/prisma.service";

export async function writeAudit(
  prisma: PrismaService,
  data: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  await prisma.auditLog.create({
    data: {
      actorId: data.actorId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      meta: (data.meta as never) ?? undefined,
    },
  });
}
