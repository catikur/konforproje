import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const uploadDir = process.env.UPLOAD_DIR || "uploads";
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: "/uploads/" });
  const port = Number(process.env.PORT || 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`Konfor API http://localhost:${port}/api`);
}

bootstrap();
