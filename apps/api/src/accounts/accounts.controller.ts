import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { FinanceAccountSchema, FinanceAccountUpdateSchema } from "@konfor/shared";
import { AccountsService } from "./accounts.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("accounts")
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get()
  list(@Query("activeOnly") activeOnly?: string) {
    return this.accounts.list(activeOnly === "true");
  }

  @Get("balances")
  balances() {
    return this.accounts.balances();
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body(zodPipe(FinanceAccountSchema)) body: Record<string, unknown>) {
    return this.accounts.create(body as never);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(@Param("id") id: string, @Body(zodPipe(FinanceAccountUpdateSchema)) body: Record<string, unknown>) {
    return this.accounts.update(id, body);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.accounts.remove(id);
  }
}
