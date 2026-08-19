import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { BudgetSchema, PeriodQuerySchema } from "@konfor/shared";
import { BudgetsService } from "./budgets.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("budgets")
export class BudgetsController {
  constructor(private budgets: BudgetsService) {}

  @Get()
  list(@Query(zodPipe(PeriodQuerySchema)) q: { year?: number; month?: number }) {
    const now = new Date();
    return this.budgets.list(q.year ?? now.getUTCFullYear(), q.month ?? now.getUTCMonth() + 1);
  }

  @Get("alerts")
  alerts(@Query(zodPipe(PeriodQuerySchema)) q: { year?: number; month?: number }) {
    const now = new Date();
    return this.budgets.alerts(q.year ?? now.getUTCFullYear(), q.month ?? now.getUTCMonth() + 1);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body(zodPipe(BudgetSchema)) body: Record<string, unknown>) {
    return this.budgets.create(body as never);
  }
}
