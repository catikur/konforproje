import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Role } from "@prisma/client";
import { ImportsService } from "./imports.service";
import { Roles } from "../common/guards";

@Controller("imports")
export class ImportsController {
  constructor(private imports: ImportsService) {}

  @Post("expenses")
  @Roles(Role.ADMIN, Role.FINANS)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { userId: string } },
  ) {
    if (!file) throw new BadRequestException("Excel dosyası gerekli");
    return this.imports.expenses(file.buffer, req.user.userId);
  }
}
