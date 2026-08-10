import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { ModuleSnapshotModule } from '../module-snapshot/module-snapshot.module';
import { WearRateModule } from '../wear-rate/wear-rate.module';
import { MigrationController } from './migration.controller';
import { MigrationCommitService } from './migration-commit.service';
import { MigrationPreviewService } from './migration-preview.service';
import { MigrationService } from './migration.service';

// ModuleSnapshotModule: MigrationCommitService lo usa para disparar el
// snapshot mensual automático tras el primer commit exitoso de la migración
// masiva (ver el comentario en confirmar()).
@Module({
  imports: [BrakeDiscRulesModule, WearRateModule, ModuleSnapshotModule],
  controllers: [MigrationController],
  providers: [
    MigrationService,
    MigrationPreviewService,
    MigrationCommitService,
  ],
})
export class MigrationModule {}
