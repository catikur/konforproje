import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PeriodQuerySchema, RecurringSchema, RecurringUpdateSchema } from "@konfor/shared";
import { RecurringService } from "./recurring.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("recurring")
export class RecurringController {
  constructor(private recurring: RecurringService) {}

  @Get()
  list() {
    return this.recurring.list();
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body(zodPipe(RecurringSchema)) body: Record<string, unknown>) {
    return this.recurring.create(body);
  }

  @Post("generate")
  @Roles(Role.ADMIN, Role.FINANS)
  generate(
    @Query(zodPipe(PeriodQuerySchema)) q: { year?: number; month?: number },
    @Req() req: { user: { userId: string } },
  ) {
    const now = new Date();
    return this.recurring.generate(
      q.year ?? now.getUTCFullYear(),
      q.month ?? now.getUTCMonth() + 1,
      req.user.userId,
    );
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(@Param("id") id: string, @Body(zodPipe(RecurringUpdateSchema)) body: Record<string, unknown>) {
    return this.recurring.update(id, body);
  }
}
