import { Body, Controller, Delete, Get, Param, Post, Query, Req } from "@nestjs/common";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { Role, TaxMode } from "@prisma/client";
import { IncomesService } from "./incomes.service";
import { Roles } from "../common/guards";

class CreateIncomeDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsDateString()
  incomeDate!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(TaxMode)
  taxMode: TaxMode = TaxMode.INCLUDED;

  @IsNumber()
  vatRate = 20;

  @IsArray()
  @IsString({ each: true })
  categoryIds!: string[];
}

@Controller("incomes")
export class IncomesController {
  constructor(private incomes: IncomesService) {}

  @Get()
  list(@Query("year") year?: string, @Query("month") month?: string) {
    return this.incomes.list({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(
    @Body() body: CreateIncomeDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.incomes.create(body, req.user.userId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.incomes.remove(id, req.user.userId);
  }
}
