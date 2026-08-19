import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ContractCollectionSchema, ContractSchema, ContractUpdateSchema } from "@konfor/shared";
import { ContractsService } from "./contracts.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("contracts")
export class ContractsController {
  constructor(private contracts: ContractsService) {}

  @Get()
  list() {
    return this.contracts.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.contracts.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body(zodPipe(ContractSchema)) body: Record<string, unknown>) {
    return this.contracts.create(body);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(@Param("id") id: string, @Body(zodPipe(ContractUpdateSchema)) body: Record<string, unknown>) {
    return this.contracts.update(id, body);
  }

  @Post(":id/collections")
  @Roles(Role.ADMIN, Role.FINANS)
  collect(
    @Param("id") id: string,
    @Body(zodPipe(ContractCollectionSchema)) body: Record<string, unknown>,
  ) {
    return this.contracts.addCollection(id, body as never);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.contracts.remove(id);
  }
}
