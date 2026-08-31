import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrakeDiscRulesModule } from './brake-disc-rules/brake-disc-rules.module';
import { FleetCompletenessModule } from './fleet-completeness/fleet-completeness.module';
import { FleetModule } from './fleet/fleet.module';
import { HistorialModule } from './historial/historial.module';
import { InventoryModule } from './inventory/inventory.module';
import { MeasurementGapModule } from './measurement-gap/measurement-gap.module';
import { MigrationModule } from './migration/migration.module';
import { ModuleSnapshotModule } from './module-snapshot/module-snapshot.module';
import { NewMeasurementModule } from './new-measurement/new-measurement.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectionModule } from './projection/projection.module';
import { ScanRecordsModule } from './scan-records/scan-records.module';
import { SystemParamsCacheModule } from './system-params/system-params-cache.module';
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
    FleetCompletenessModule,
    FleetModule,
    HistorialModule,
    InventoryModule,
    MeasurementGapModule,
    MigrationModule,
    ModuleSnapshotModule,
    NewMeasurementModule,
    NotificationsModule,
    OperationsModule,
    ProjectionModule,
    ScanRecordsModule,
    SystemParamsCacheModule,
    SystemParamsModule,
    TraceabilityModule,
    WearRateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
