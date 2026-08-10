import { Module } from '@nestjs/common';
import { MeasurementGapConfigService } from './measurement-gap-config.service';
import { MeasurementGapController } from './measurement-gap.controller';
import { MeasurementGapService } from './measurement-gap.service';

@Module({
  controllers: [MeasurementGapController],
  providers: [MeasurementGapService, MeasurementGapConfigService],
})
export class MeasurementGapModule {}
