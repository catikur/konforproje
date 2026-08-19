import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { InstrumentSchema, InstrumentUpdateSchema } from "@konfor/shared";
import { InstrumentsService } from "./instruments.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("instruments")
export class InstrumentsController {
  constructor(private instruments: InstrumentsService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.instruments.list(status);
  }

  @Get("upcoming")
  upcoming() {
    return this.instruments.upcoming();
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body(zodPipe(InstrumentSchema)) body: Record<string, unknown>) {
    return this.instruments.create(body);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(@Param("id") id: string, @Body(zodPipe(InstrumentUpdateSchema)) body: Record<string, unknown>) {
    return this.instruments.update(id, body);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string) {
    return this.instruments.remove(id);
  }
}
