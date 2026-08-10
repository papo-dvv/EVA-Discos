import { Module } from '@nestjs/common';
import { ProyeccionConfigService } from '../projection/proyeccion-config.service';
import { AsimetriaConfigService } from './asimetria-config.service';
import { ConsensoConfigService } from './consenso-config.service';
import { ConsensoValidationService } from './consenso-validation.service';
import { TraceabilityStatsService } from './traceability-stats.service';
import { TraceabilityController } from './traceability.controller';
import { TraceabilityService } from './traceability.service';

// ProyeccionConfigService es un servicio puro / solo-Prisma sin estado propio
// (ver projection.module.ts) — se reutiliza acá tal cual, con su propia
// instancia, para leer proyeccion_km_rango_min/max (ver
// TraceabilityService.filtrarPorRangoKm). Mismo criterio inverso que ya usa
// ProjectionModule con ConsensoConfigService/TraceabilityStatsService: no se
// importa ProjectionModule entero (evita una dependencia circular entre
// módulos), solo el provider puntual que hace falta.
@Module({
  controllers: [TraceabilityController],
  providers: [
    TraceabilityService,
    TraceabilityStatsService,
    ConsensoConfigService,
    ConsensoValidationService,
    AsimetriaConfigService,
    ProyeccionConfigService,
  ],
  // ConsensoValidationService lo usa SystemParamsModule para validar un
  // cambio de parámetro de percentil ANTES de persistirlo (ver
  // SystemParamsService.actualizar) — dependencia en un solo sentido
  // (system-params -> traceability, nunca al revés). TraceabilityService se
  // exporta aparte para que ModuleSnapshotModule pueda reusar exactamente el
  // mismo cálculo que ve la pantalla (ver GenerarSnapshotService) sin
  // reconstruir todo su árbol de dependencias como provider propio.
  exports: [ConsensoValidationService, TraceabilityService],
})
export class TraceabilityModule {}
