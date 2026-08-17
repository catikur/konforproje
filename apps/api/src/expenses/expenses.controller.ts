import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";
import { Role, TaxMode } from "@prisma/client";
import { ExpensesService } from "./expenses.service";
import { Roles } from "../common/guards";

class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsDateString()
  expenseDate!: string;

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

  @IsOptional()
  @IsString()
  supplierId?: string | null;
}

@Controller("expenses")
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  list(@Query("year") year?: string, @Query("month") month?: string) {
    return this.expenses.list({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(
    @Body() body: CreateExpenseDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.expenses.create(body, req.user.userId);
  }

  @Post(":id/attachments")
  @Roles(Role.ADMIN, Role.FINANS)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /pdf|jpe?g|png|heic|webp/i.test(file.mimetype);
        cb(ok ? null : new Error("Desteklenmeyen dosya tipi"), ok);
      },
    }),
  )
  upload(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { userId: string } },
  ) {
    return this.expenses.addAttachment(id, file, req.user.userId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.expenses.remove(id, req.user.userId);
  }
}
