import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/guards";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true, service: "konfor-api" };
  }
}
