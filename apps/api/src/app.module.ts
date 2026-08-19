import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SettingsModule } from "./settings/settings.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { ProjectsModule } from "./projects/projects.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { IncomesModule } from "./incomes/incomes.module";
import { BacklogModule } from "./backlog/backlog.module";
import { ReportsModule } from "./reports/reports.module";
import { AccountsModule } from "./accounts/accounts.module";
import { ContractsModule } from "./contracts/contracts.module";
import { BudgetsModule } from "./budgets/budgets.module";
import { InstrumentsModule } from "./instruments/instruments.module";
import { RecurringModule } from "./recurring/recurring.module";
import { ImportsModule } from "./imports/imports.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    NotificationsModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    SuppliersModule,
    ProjectsModule,
    ExpensesModule,
    IncomesModule,
    BacklogModule,
    ReportsModule,
    AccountsModule,
    ContractsModule,
    BudgetsModule,
    InstrumentsModule,
    RecurringModule,
    ImportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
