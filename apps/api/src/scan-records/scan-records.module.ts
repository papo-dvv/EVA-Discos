import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { ScanRecordsController } from './scan-records.controller';
import { ScanRecordsService } from './scan-records.service';

@Module({
  imports: [BrakeDiscRulesModule],
  controllers: [ScanRecordsController],
  providers: [ScanRecordsService],
})
export class ScanRecordsModule {}
