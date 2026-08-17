import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Role } from "@prisma/client";
import { UsersService } from "./users.service";
import { Roles } from "../common/guards";

class CreateUserDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsEnum(Role)
  role: Role = Role.FINANS;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

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
    @Body() body: CreateUserDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.users.create({ ...body, actorId: req.user.userId });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateUserDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.users.update(id, { ...body, actorId: req.user.userId });
  }
}
