import { Controller, Get, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get("period")
  period(@Query("year") year?: string, @Query("month") month?: string) {
    const now = new Date();
    const y = year ? Number(year) : now.getUTCFullYear();
    const m = month ? Number(month) : now.getUTCMonth() + 1;
    return this.reports.period(y, m);
  }
}
