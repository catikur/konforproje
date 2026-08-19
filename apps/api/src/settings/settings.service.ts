import { Injectable } from "@nestjs/common";
import { VatRate } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    return this.prisma.appSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });
  }

  async update(data: {
    companyName?: string;
    approvalLimit?: number;
    defaultVatRate?: VatRate;
    defaultCurrency?: string;
  }) {
    return this.prisma.appSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        companyName: data.companyName || "Konfor Proje",
        approvalLimit: data.approvalLimit ?? 0,
        defaultVatRate: data.defaultVatRate ?? 20,
        defaultCurrency: data.defaultCurrency || "TRY",
      },
      update: data,
    });
  }
}
