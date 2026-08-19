import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { createReadStream, existsSync, mkdirSync } from "fs";
import { readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";
import { uploadDir } from "../common/uploads";

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: any = null;
  private bucket = process.env.S3_BUCKET || "konfor";

  async onModuleInit() {
    if (process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY) {
      const { S3Client } = await import("@aws-sdk/client-s3");
      this.s3 = new S3Client({
        region: process.env.S3_REGION || "us-east-1",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY || "",
        },
      });
    } else {
      mkdirSync(uploadDir(), { recursive: true });
    }
  }

  keyFor(originalName: string) {
    const ext = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : "";
    return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  }

  async put(body: Buffer, key: string, mimeType: string) {
    if (this.s3) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
        }),
      );
      return key;
    }
    mkdirSync(uploadDir(), { recursive: true });
    await writeFile(join(uploadDir(), key), body);
    return key;
  }

  async getBuffer(key: string): Promise<Buffer> {
    this.assertKey(key);
    if (this.s3) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const chunks: Buffer[] = [];
      for await (const chunk of out.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    const path = join(uploadDir(), key);
    if (!existsSync(path)) throw new NotFoundException("Dosya bulunamadı");
    return readFile(path);
  }

  async getStream(key: string): Promise<Readable> {
    this.assertKey(key);
    if (this.s3) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return out.Body as Readable;
    }
    const path = join(uploadDir(), key);
    if (!existsSync(path)) throw new NotFoundException("Dosya bulunamadı");
    return createReadStream(path);
  }

  async remove(key: string) {
    this.assertKey(key);
    try {
      if (this.s3) {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        return;
      }
      await unlink(join(uploadDir(), key));
    } catch {
      /* ignore */
    }
  }

  private assertKey(key: string) {
    if (!key || key.includes("..") || key.includes("/") || key.includes("\\")) {
      throw new NotFoundException("Dosya bulunamadı");
    }
  }
}
