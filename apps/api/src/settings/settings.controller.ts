import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SettingsUpdateSchema } from "@konfor/shared";
import { SettingsService } from "./settings.service";
import { Roles } from "../common/guards";
import { zodPipe } from "../common/zod-pipe";
import { serializeRecord } from "../common/serialize";

@Controller("settings")
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  async get() {
    return serializeRecord(await this.settings.get());
  }

  @Patch()
  @Roles(Role.ADMIN)
  async update(@Body(zodPipe(SettingsUpdateSchema)) body: Record<string, unknown>) {
    return serializeRecord(await this.settings.update(body as never));
  }
}
