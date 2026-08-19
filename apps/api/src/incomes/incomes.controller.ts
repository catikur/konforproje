import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Role } from "@prisma/client";
import {
  IncomeCreateSchema,
  IncomeUpdateSchema,
  ListQuerySchema,
} from "@konfor/shared";
import { IncomesService } from "./incomes.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("incomes")
export class IncomesController {
  constructor(private incomes: IncomesService) {}

  @Get()
  list(@Query(zodPipe(ListQuerySchema)) query: Record<string, unknown>) {
    return this.incomes.list(query as never);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.incomes.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(
    @Body(zodPipe(IncomeCreateSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.incomes.create(body as never, req.user.userId);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(
    @Param("id") id: string,
    @Body(zodPipe(IncomeUpdateSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.incomes.update(id, body as never, req.user.userId);
  }

  @Post(":id/restore")
  @Roles(Role.ADMIN)
  restore(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.incomes.restore(id, req.user.userId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.incomes.remove(id, req.user.userId);
  }
}
