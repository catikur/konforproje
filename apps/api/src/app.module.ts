import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { IncomesModule } from "./incomes/incomes.module";
import { BacklogModule } from "./backlog/backlog.module";
import { ReportsModule } from "./reports/reports.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    SuppliersModule,
    ExpensesModule,
    IncomesModule,
    BacklogModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
