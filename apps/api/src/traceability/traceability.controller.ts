import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TraceabilityPromedioPorTrenQueryDto } from './dto/traceability-promedio-por-tren-query.dto';
import { TraceabilityScopeQueryDto } from './dto/traceability-scope-query.dto';
import { TraceabilitySeriesQueryDto } from './dto/traceability-series-query.dto';
import { TraceabilityService } from './traceability.service';

// Estadísticas de trazabilidad sobre wear_rate_pairs (solo pares válidos).
// Mismo criterio de acceso que wear-rate: exclusivo del Administrador.
@Controller('traceability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class TraceabilityController {
  constructor(private readonly traceability: TraceabilityService) {}

  @Get('summary')
  summary(@Query() query: TraceabilityScopeQueryDto) {
    return this.traceability.obtenerSummary(query);
  }

  // ⚠️ Contrato con el frontend — NO cambiar el default de `agregacion` sin
  // revisar esto primero: el Gráfico 1 "Diagnóstico completo"
  // (GraficoTrazabilidad.tsx) necesita cada punto individual (para mostrar
  // outliers/recortes uno por uno) y por eso SIEMPRE pide
  // `agregacion=crudo` de forma explícita, sin importar el volumen — nunca
  // depende del default. Si en algún momento se cambia qué valor devuelve
  // 'auto' (o se quita 'crudo' como opción), ese gráfico deja de perder
  // granularidad SOLO porque sigue pidiendo el modo explícito; pero
  // cualquier otro consumidor que llegue a depender del default silencioso
  // sí se rompería. El Gráfico 2 "Trazabilidad limpia" también pide
  // `agregacion=crudo` hoy (agrega su propia línea de tendencia en el
  // frontend) — si a futuro se lo hace consumir 'mensual' directamente,
  // actualizar este comentario.
  @Get('series')
  series(@Query() query: TraceabilitySeriesQueryDto) {
    return this.traceability.obtenerSeries(query);
  }

  @Get('promedio-por-tren')
  promedioPorTren(@Query() query: TraceabilityPromedioPorTrenQueryDto) {
    return this.traceability.obtenerPromedioPorTren(
      query.filtrarPorRangoKm,
      query.incluirDetalle,
    );
  }
}
