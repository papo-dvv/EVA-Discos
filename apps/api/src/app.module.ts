import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrakeDiscRulesModule } from './brake-disc-rules/brake-disc-rules.module';
import { MigrationModule } from './migration/migration.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScanRecordsModule } from './scan-records/scan-records.module';
import { SystemParamsModule } from './system-params/system-params.module';
import { TraceabilityModule } from './traceability/traceability.module';
import { WearRateModule } from './wear-rate/wear-rate.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    BrakeDiscRulesModule,
    MigrationModule,
    NotificationsModule,
    ScanRecordsModule,
    SystemParamsModule,
    TraceabilityModule,
    WearRateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
