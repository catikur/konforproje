import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { CategorySchema, CategoryUpdateSchema } from "@konfor/shared";
import { CategoriesService } from "./categories.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("categories")
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  list(@Query("activeOnly") activeOnly?: string) {
    return this.categories.list(activeOnly === "true");
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body(zodPipe(CategorySchema)) body: Record<string, unknown>) {
    return this.categories.create(body as never);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(
    @Param("id") id: string,
    @Body(zodPipe(CategoryUpdateSchema)) body: Record<string, unknown>,
  ) {
    return this.categories.update(id, body as never);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.categories.remove(id);
  }
}
