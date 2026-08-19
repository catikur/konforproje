import { BadRequestException } from "@nestjs/common";
import { createReadStream, existsSync } from "fs";
import { join } from "path";

export const ALLOWED_UPLOAD_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function uploadDir() {
  return join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
}

export function assertAllowedMime(mime: string | undefined) {
  const ok = Boolean(mime && ALLOWED_UPLOAD_MIME.includes(mime.toLowerCase()));
  if (!ok) {
    throw new BadRequestException("Desteklenmeyen dosya tipi (PDF, JPEG, PNG, HEIC, WebP)");
  }
}

export function openUploadFile(filename: string) {
  const path = join(uploadDir(), filename);
  if (!existsSync(path) || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new BadRequestException("Dosya bulunamadı");
  }
  return createReadStream(path);
}
