import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { NotificationsService } from "../notifications/notifications.service";
import { extractFromImage } from "./extract";
import { writeAudit } from "../common/audit";

const QUEUE = "ocr";

@Injectable()
export class OcrService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OcrService.name);
  private queue: { add: (name: string, data: object) => Promise<unknown> } | null = null;
  private worker: { close: () => Promise<void> } | null = null;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const redis = process.env.REDIS_URL;
    if (!redis) {
      this.log.warn("REDIS_URL yok — OCR işleri süreç içi çalışacak");
      return;
    }
    const { Queue, Worker } = await import("bullmq");
    const connection = { url: redis };
    this.queue = new Queue(QUEUE, { connection });
    this.worker = new Worker(
      QUEUE,
      async (job: { data: { expenseId: string; attachmentId: string } }) => {
        await this.process(job.data.expenseId, job.data.attachmentId);
      },
      { connection, concurrency: 2 },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  async enqueue(expenseId: string, attachmentId: string) {
    await this.prisma.expense.update({
      where: { id: expenseId },
      data: { ocrStatus: "PROCESSING" },
    });
    if (this.queue) {
      await this.queue.add("parse", { expenseId, attachmentId });
      return { queued: true };
    }
    setImmediate(() => {
      this.process(expenseId, attachmentId).catch((err) =>
        this.log.error(err),
      );
    });
    return { queued: false, inline: true };
  }

  async process(expenseId: string, attachmentId: string) {
    const att = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, expenseId },
    });
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, deletedAt: null },
    });
    if (!att || !expense) return;
    try {
      const buf = await this.storage.getBuffer(att.storageKey);
      const suggestion = await extractFromImage(buf, att.mimeType);
      const failed = Boolean(suggestion.skipped);
      await this.prisma.expense.update({
        where: { id: expenseId },
        data: {
          ocrStatus: failed ? "FAILED" : "DONE",
          ocrRawJson: suggestion as object,
        },
      });
      await writeAudit(this.prisma, {
        action: failed ? "OCR_FAILED" : "OCR_DONE",
        entityType: "Expense",
        entityId: expenseId,
        meta: { reason: suggestion.reason },
      });
      await this.notifications.notify({
        userId: expense.createdById,
        title: failed ? "OCR tamamlanamadı" : "OCR hazır",
        body: failed
          ? suggestion.reason || "Fiş okunamadı, manuel girin"
          : `${expense.description} için öneriler hazır`,
        entityType: "Expense",
        entityId: expenseId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR hata";
      await this.prisma.expense.update({
        where: { id: expenseId },
        data: { ocrStatus: "FAILED", ocrRawJson: { reason: message } },
      });
      await this.notifications.notify({
        userId: expense.createdById,
        title: "OCR hata",
        body: message,
        entityType: "Expense",
        entityId: expenseId,
      });
    }
  }
}
