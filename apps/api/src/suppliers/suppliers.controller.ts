import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Role } from "@prisma/client";
import { SuppliersService } from "./suppliers.service";
import { Roles } from "../common/guards";

class SupplierDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  taxId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller("suppliers")
export class SuppliersController {
  constructor(private suppliers: SuppliersService) {}

  @Get()
  list(@Query("activeOnly") activeOnly?: string) {
    return this.suppliers.list(activeOnly === "true");
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(@Body() body: SupplierDto) {
    return this.suppliers.create(body);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(@Param("id") id: string, @Body() body: SupplierDto) {
    return this.suppliers.update(id, body);
  }
}
