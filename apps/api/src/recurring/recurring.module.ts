import { Module } from "@nestjs/common";
import { RecurringService } from "./recurring.service";
import { RecurringController } from "./recurring.controller";

@Module({
  controllers: [RecurringController],
  providers: [RecurringService],
})
export class RecurringModule {}
