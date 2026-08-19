import { Controller, Get, Query, Res } from "@nestjs/common";
import { PeriodQuerySchema } from "@konfor/shared";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { zodPipe } from "../common/zod-pipe";

@Controller("reports")
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get("period")
  period(@Query(zodPipe(PeriodQuerySchema)) query: { year?: number; month?: number }) {
    const now = new Date();
    const y = query.year ?? now.getUTCFullYear();
    const m = query.month ?? now.getUTCMonth() + 1;
    return this.reports.period(y, m);
  }

  @Get("trend")
  trend(@Query(zodPipe(PeriodQuerySchema)) query: { months?: number }) {
    return this.reports.trend(query.months ?? 12);
  }

  @Get("cashflow")
  cashflow(@Query(zodPipe(PeriodQuerySchema)) query: { year?: number; month?: number }) {
    const now = new Date();
    return this.reports.cashflow(
      query.year ?? now.getUTCFullYear(),
      query.month ?? now.getUTCMonth() + 1,
    );
  }

  @Get("aging")
  aging() {
    return this.reports.aging();
  }

  @Get("period/pdf")
  async pdf(
    @Query(zodPipe(PeriodQuerySchema)) query: { year?: number; month?: number },
    @Res() res: Response,
  ) {
    const now = new Date();
    const y = query.year ?? now.getUTCFullYear();
    const m = query.month ?? now.getUTCMonth() + 1;
    const buf = await this.reports.pdf(y, m);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="konfor-${y}-${String(m).padStart(2, "0")}.pdf"`,
    );
    res.send(buf);
  }

  @Get("period/export")
  async export(
    @Query(zodPipe(PeriodQuerySchema)) query: { year?: number; month?: number },
    @Res() res: Response,
  ) {
    const now = new Date();
    const y = query.year ?? now.getUTCFullYear();
    const m = query.month ?? now.getUTCMonth() + 1;
    const buf = await this.reports.excel(y, m);
    const filename = `konfor-${y}-${String(m).padStart(2, "0")}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  }
}
