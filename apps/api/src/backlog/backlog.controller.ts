import { Body, Controller, Delete, Get, Param, Post, Query, Req } from "@nestjs/common";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { BacklogDirection, BacklogStatus, Role } from "@prisma/client";
import { BacklogService } from "./backlog.service";
import { Roles } from "../common/guards";

class CreateBacklogDto {
  @IsEnum(BacklogDirection)
  direction!: BacklogDirection;

  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsNumber()
  @Min(0.01)
  expectedAmount!: number;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsEnum(BacklogStatus)
  status?: BacklogStatus;
}

@Controller("backlog")
export class BacklogController {
  constructor(private backlog: BacklogService) {}

  @Get()
  list(@Query("year") year?: string, @Query("month") month?: string) {
    return this.backlog.list({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(
    @Body() body: CreateBacklogDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.backlog.create(body, req.user.userId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.backlog.remove(id, req.user.userId);
  }
}
