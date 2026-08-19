import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

function corsOrigins(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw === "*") return true;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET tanımlı olmalı. apps/api/.env örneğine bakın.");
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.set("trust proxy", 1);
  const port = Number(process.env.PORT || 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`Konfor API http://localhost:${port}/api`);
}

bootstrap();
