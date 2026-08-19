import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/guards";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      ok: true,
      service: "konfor-api",
      redis: Boolean(process.env.REDIS_URL),
      s3: Boolean(process.env.S3_ENDPOINT),
      ocr: Boolean(process.env.OPENAI_API_KEY),
    };
  }
}
