import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { calculateMoney, VatRate } from "@konfor/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toDate } from "../common/dates";

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  async expenses(buffer: Buffer, userId: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException("Excel sayfası yok");
    const cats = await this.prisma.category.findMany({ where: { deletedAt: null } });
    const created: string[] = [];
    const errors: string[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const date = String(row.getCell(1).text || "").slice(0, 10);
      const description = String(row.getCell(2).text || "").trim();
      const amount = Number(String(row.getCell(3).text || "").replace(",", "."));
      const vatRate = Number(row.getCell(4).text || 20) as VatRate;
      const taxMode = String(row.getCell(5).text || "INCLUDED").toUpperCase() === "EXCLUDED"
        ? "EXCLUDED"
        : "INCLUDED";
      const catName = String(row.getCell(6).text || "").trim();
      if (!description || !amount || !date) {
        if (description || amount) errors.push(`Satır ${i}: eksik alan`);
        continue;
      }
      const cat = cats.find((c) => c.name.toLowerCase() === catName.toLowerCase()) || cats[0];
      if (!cat) {
        errors.push(`Satır ${i}: kategori yok`);
        continue;
      }
      try {
        const money = calculateMoney(amount, taxMode, [0, 1, 10, 20].includes(vatRate) ? vatRate : 20);
        const exp = await this.prisma.expense.create({
          data: {
            description,
            expenseDate: toDate(date),
            amount: money.inputAmount,
            taxMode,
            vatRate: money.vatRate,
            netAmount: money.netAmount,
            vatAmount: money.vatAmount,
            grossAmount: money.grossAmount,
            createdById: userId,
            categories: { create: [{ categoryId: cat.id }] },
          },
        });
        created.push(exp.id);
      } catch (e) {
        errors.push(`Satır ${i}: ${e instanceof Error ? e.message : "hata"}`);
      }
    }
    return { created: created.length, errors };
  }
}
