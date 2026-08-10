import { Module } from '@nestjs/common';
import { FleetCompletenessController } from './fleet-completeness.controller';
import { FleetCompletenessService } from './fleet-completeness.service';

@Module({
  controllers: [FleetCompletenessController],
  providers: [FleetCompletenessService],
})
export class FleetCompletenessModule {}
