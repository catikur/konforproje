import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Role } from "@prisma/client";
import { CreateUserSchema, UpdateUserSchema } from "@konfor/shared";
import { UsersService } from "./users.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";

@Controller("users")
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(
    @Body(zodPipe(CreateUserSchema))
    body: {
      username: string;
      password: string;
      displayName: string;
      role: Role;
    },
    @Req() req: { user: { userId: string } },
  ) {
    return this.users.create({ ...body, actorId: req.user.userId });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(zodPipe(UpdateUserSchema))
    body: {
      displayName?: string;
      role?: Role;
      isActive?: boolean;
      password?: string;
    },
    @Req() req: { user: { userId: string } },
  ) {
    return this.users.update(id, { ...body, actorId: req.user.userId });
  }
}
