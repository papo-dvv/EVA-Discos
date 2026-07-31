import { Module } from '@nestjs/common';
import { ConsensoConfigService } from './consenso-config.service';
import { ConsensoValidationService } from './consenso-validation.service';
import { TraceabilityStatsService } from './traceability-stats.service';
import { TraceabilityController } from './traceability.controller';
import { TraceabilityService } from './traceability.service';

@Module({
  controllers: [TraceabilityController],
  providers: [
    TraceabilityService,
    TraceabilityStatsService,
    ConsensoConfigService,
    ConsensoValidationService,
  ],
  // ConsensoValidationService lo usa SystemParamsModule para validar un
  // cambio de parámetro de percentil ANTES de persistirlo (ver
  // SystemParamsService.actualizar) — dependencia en un solo sentido
  // (system-params -> traceability, nunca al revés).
  exports: [ConsensoValidationService],
})
export class TraceabilityModule {}
