import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { SystemParamsController } from './system-params.controller';
import { SystemParamsService } from './system-params.service';

@Module({
  // TraceabilityModule exporta ConsensoValidationService: PATCH /system-params/:clave
  // lo usa para validar un cambio de percentil ANTES de persistirlo (Reglas A/B).
  imports: [TraceabilityModule],
  controllers: [SystemParamsController],
  providers: [SystemParamsService],
})
export class SystemParamsModule {}
