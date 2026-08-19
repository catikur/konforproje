import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { mkdirSync } from "fs";
import { Role } from "@prisma/client";
import {
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  ListQuerySchema,
} from "@konfor/shared";
import type { Response } from "express";
import { ExpensesService } from "./expenses.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  openUploadFile,
  uploadDir,
} from "../common/uploads";

@Controller("expenses")
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  list(@Query(zodPipe(ListQuerySchema)) query: Record<string, unknown>) {
    return this.expenses.list(query as never);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.expenses.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.FINANS)
  create(
    @Body(zodPipe(ExpenseCreateSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.expenses.create(body as never, req.user.userId);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  update(
    @Param("id") id: string,
    @Body(zodPipe(ExpenseUpdateSchema)) body: Record<string, unknown>,
    @Req() req: { user: { userId: string } },
  ) {
    return this.expenses.update(id, body as never, req.user.userId);
  }

  @Post(":id/restore")
  @Roles(Role.ADMIN)
  restore(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.expenses.restore(id, req.user.userId);
  }

  @Post(":id/attachments")
  @Roles(Role.ADMIN, Role.FINANS)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = uploadDir();
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname) || ""}`);
        },
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        const ok = ALLOWED_UPLOAD_MIME.includes(file.mimetype.toLowerCase());
        cb(ok ? null : new Error("Desteklenmeyen dosya tipi"), ok);
      },
    }),
  )
  upload(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { userId: string } },
  ) {
    if (!file) {
      throw new BadRequestException("Dosya gerekli");
    }
    return this.expenses.addAttachment(id, file, req.user.userId);
  }

  @Get(":id/attachments/:attId/file")
  async file(
    @Param("id") id: string,
    @Param("attId") attId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const att = await this.expenses.getAttachment(id, attId);
    res.setHeader("Content-Type", att.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(att.originalName)}"`,
    );
    return new StreamableFile(openUploadFile(att.filename));
  }

  @Delete(":id/attachments/:attId")
  @Roles(Role.ADMIN, Role.FINANS)
  removeAttachment(
    @Param("id") id: string,
    @Param("attId") attId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.expenses.removeAttachment(id, attId, req.user.userId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.FINANS)
  remove(@Param("id") id: string, @Req() req: { user: { userId: string } }) {
    return this.expenses.remove(id, req.user.userId);
  }
}
