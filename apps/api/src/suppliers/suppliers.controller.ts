import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SupplierSchema, SupplierUpdateSchema } from "@konfor/shared";
import { SuppliersService } from "./suppliers.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("suppliers")
export class SuppliersController {
  constructor(private suppliers: SuppliersService) {}

  @Get()
  list(@Query("activeOnly") activeOnly?: string) {
    return this.suppliers.list(activeOnly === "true");
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body(zodPipe(SupplierSchema)) body: Record<string, unknown>) {
    return this.suppliers.create(body as never);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(
    @Param("id") id: string,
    @Body(zodPipe(SupplierUpdateSchema)) body: Record<string, unknown>,
  ) {
    return this.suppliers.update(id, body as never);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.suppliers.remove(id);
  }
}
