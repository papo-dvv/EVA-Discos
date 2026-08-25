import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { FleetModule } from '../fleet/fleet.module';
import { WearRateModule } from '../wear-rate/wear-rate.module';
import { OperationsCambioDiscoService } from './operations-cambio-disco.service';
import { OperationsRetiroMasivoService } from './operations-retiro-masivo.service';
import { OperationsController } from './operations.controller';

@Module({
  imports: [BrakeDiscRulesModule, WearRateModule, FleetModule],
  controllers: [OperationsController],
  providers: [OperationsRetiroMasivoService, OperationsCambioDiscoService],
})
export class OperationsModule {}
