import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Role } from "@prisma/client";
import {
  BacklogCopySchema,
  BacklogCreateSchema,
  BacklogLinkSchema,
  BacklogUpdateSchema,
  ListQuerySchema,
} from "@konfor/shared";
import { BacklogService } from "./backlog.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("backlog")
export class BacklogController {
  constructor(private backlog: BacklogService) {}

  @Get()
  list(@Query(zodPipe(ListQuerySchema)) query: Record<string, unknown>) {
    return this.backlog.list(query as never);
  }

  @Post("copy-period")
  @Roles(Role.ADMIN, Role.FINANS)
  copy(
    @Body(zodPipe(BacklogCopySchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.backlog.copyPeriod(body as never, req.user.userId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.backlog.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(
    @Body(zodPipe(BacklogCreateSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.backlog.create(body as never, req.user.userId);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(
    @Param("id") id: string,
    @Body(zodPipe(BacklogUpdateSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.backlog.update(id, body as never, req.user.userId);
  }

  @Post(":id/link")
  @Roles(Role.ADMIN, Role.FINANS)
  link(
    @Param("id") id: string,
    @Body(zodPipe(BacklogLinkSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.backlog.link(id, body as never, req.user.userId);
  }

  @Delete(":id/link/:linkId")
  @Roles(Role.ADMIN, Role.FINANS)
  unlink(
    @Param("id") id: string,
    @Param("linkId") linkId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.backlog.unlink(id, linkId, req.user.userId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.backlog.remove(id, req.user.userId);
  }
}
