import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ProjectSchema, ProjectUpdateSchema } from "@konfor/shared";
import { ProjectsService } from "./projects.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("projects")
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  list(@Query("activeOnly") activeOnly?: string) {
    return this.projects.list(activeOnly === "true");
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body(zodPipe(ProjectSchema)) body: Record<string, unknown>) {
    return this.projects.create(body as never);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body(zodPipe(ProjectUpdateSchema)) body: Record<string, unknown>) {
    return this.projects.update(id, body as never);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.projects.remove(id);
  }
}
