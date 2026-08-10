import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { ConsensoConfigService } from '../traceability/consenso-config.service';
import { TraceabilityStatsService } from '../traceability/traceability-stats.service';
import { ProyeccionCalculatorService } from './proyeccion-calculator.service';
import { ProyeccionConfigService } from './proyeccion-config.service';
import { ProyeccionRateService } from './proyeccion-rate.service';
import { ProyeccionController } from './proyeccion.controller';
import { ProyeccionService } from './proyeccion.service';

// ConsensoConfigService y TraceabilityStatsService son servicios puros /
// solo-Prisma sin estado propio (ver traceability.module.ts) — se reutilizan
// acá tal cual, con su propia instancia, para el mismo cálculo de "dato
// limpio" (consenso Gauss∩Percentiles∩Tukey) que ya usa Trazabilidad, ahora
// aplicado a la tasa promedio de desgaste por tipo de coche (ver
// ProyeccionRateService). TraceabilityModule no los exporta (solo exporta
// ConsensoValidationService, para SystemParamsModule), así que se declaran
// como providers propios de este módulo en vez de importarlos de ahí.
@Module({
  imports: [BrakeDiscRulesModule],
  controllers: [ProyeccionController],
  providers: [
    ProyeccionService,
    ProyeccionCalculatorService,
    ProyeccionRateService,
    ProyeccionConfigService,
    TraceabilityStatsService,
    ConsensoConfigService,
  ],
  // Exportado para que ModuleSnapshotModule pueda reusar exactamente el
  // mismo cálculo que ve la pantalla de Proyección (listarDiscos completo +
  // pronóstico 12 meses + promedio por vagón, ver GenerarSnapshotService) sin
  // reconstruir su árbol de dependencias como provider propio — mismo
  // criterio que WearRateModule exporta WearRateService para MigrationModule.
  exports: [ProyeccionService],
})
export class ProjectionModule {}
