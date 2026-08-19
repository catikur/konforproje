import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { CategoryType, Role } from "@prisma/client";
import { CategoriesService } from "./categories.service";
import { Roles } from "../common/guards";

class CategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller("categories")
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  list(@Query("activeOnly") activeOnly?: string) {
    return this.categories.list(activeOnly === "true");
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body() body: CategoryDto) {
    return this.categories.create(body);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(@Param("id") id: string, @Body() body: CategoryDto) {
    return this.categories.update(id, body);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.categories.remove(id);
  }
}
