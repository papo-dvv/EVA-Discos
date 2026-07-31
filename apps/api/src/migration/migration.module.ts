import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { WearRateModule } from '../wear-rate/wear-rate.module';
import { MigrationController } from './migration.controller';
import { MigrationCommitService } from './migration-commit.service';
import { MigrationPreviewService } from './migration-preview.service';
import { MigrationService } from './migration.service';

@Module({
  imports: [BrakeDiscRulesModule, WearRateModule],
  controllers: [MigrationController],
  providers: [
    MigrationService,
    MigrationPreviewService,
    MigrationCommitService,
  ],
})
export class MigrationModule {}
