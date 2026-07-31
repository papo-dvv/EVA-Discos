import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsensoConfigService } from './consenso-config.service';
import { CONTEO_MINIMO } from './traceability.service';
import { TraceabilityStatsService } from './traceability-stats.service';

// Amplitud máxima permitida del LÍMITE de consenso (superior - inferior) —
// Regla A del enunciado. Nunca se aplica al extremo ni a los 3 métodos por
// separado, solo al consenso final.
const AMPLITUD_MAXIMA_LIMITE = 0.25;

interface ScopeParcial {
  tren?: number;
  tipoCoche?: string;
  bogieCodigo?: string;
}

interface GrupoScope {
  scope: ScopeParcial;
  valores: number[];
}

export interface CombinacionViolacion {
  scope: string;
  amplitud: number;
  // 'limite': amplitud del LÍMITE de consenso > AMPLITUD_MAXIMA_LIMITE (fija,
  // 0.25). 'extremo': amplitud del EXTREMO de consenso > amplitud_maxima_extremo
  // (configurable, solo se evalúa si no es NULL) — ver ConsensoConfigService.
  tipo: 'limite' | 'extremo';
}

export interface AjusteExtremo {
  scope: string;
  valorOriginal: number;
  epsilonAplicado: number;
}

export type ResultadoValidacionPercentil =
  | { tipo: 'rechazado'; combinaciones: CombinacionViolacion[] }
  | { tipo: 'aceptado'; ajustes: AjusteExtremo[] };

// Todas las filas de wear_rate_pairs (es_valido=true) pertenecen a la vez a
// estas 8 combinaciones de scope: el conjunto vacío (global), cada dimensión
// sola, cada par de dimensiones, y las 3 juntas — exactamente los 2^3
// subconjuntos de {tren, tipoCoche, bogieCodigo}. Es el mismo scope
// combinable de /traceability/summary (TraceabilityScopeQueryDto), aplicado
// exhaustivamente en vez de a un único filtro elegido por el usuario.
function subconjuntosDeFila(f: {
  trenNumero: number;
  tipoCoche: string;
  bogieCodigo: string;
}): ScopeParcial[] {
  const { trenNumero: tren, tipoCoche, bogieCodigo } = f;
  return [
    {},
    { tren },
    { tipoCoche },
    { bogieCodigo },
    { tren, tipoCoche },
    { tren, bogieCodigo },
    { tipoCoche, bogieCodigo },
    { tren, tipoCoche, bogieCodigo },
  ];
}

function claveScope(scope: ScopeParcial): string {
  return `${scope.tren ?? '*'}|${scope.tipoCoche ?? '*'}|${scope.bogieCodigo ?? '*'}`;
}

function describirScope(scope: ScopeParcial): string {
  const partes: string[] = [];
  if (scope.tren !== undefined) partes.push(`Tren ${scope.tren}`);
  if (scope.tipoCoche !== undefined) partes.push(scope.tipoCoche);
  if (scope.bogieCodigo !== undefined)
    partes.push(`Bogie ${scope.bogieCodigo}`);
  return partes.length === 0 ? 'Global (toda la flota)' : partes.join(' · ');
}

// Valida qué pasaría con el consenso de TODAS las combinaciones de scope con
// datos suficientes si se aceptara un cambio candidato a uno de los 4
// parámetros de percentil — ANTES de persistirlo (ver
// SystemParamsService.actualizar). Gauss y Tukey son fijos, así que solo el
// término de percentiles cambia; el resto de la fórmula del consenso
// (intersección de los 3 métodos) es la misma que ya usa TraceabilityService.
@Injectable()
export class ConsensoValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: TraceabilityStatsService,
    private readonly consensoConfig: ConsensoConfigService,
  ) {}

  async validarCambioPercentil(
    clave: string,
    valorNuevo: string,
  ): Promise<ResultadoValidacionPercentil> {
    const [fracciones, epsilon, amplitudMaximaExtremo, grupos] =
      await Promise.all([
        this.consensoConfig.obtenerFraccionesConCandidato(clave, valorNuevo),
        this.consensoConfig.obtenerEpsilon(),
        this.consensoConfig.obtenerAmplitudMaximaExtremo(),
        this.enumerarGruposConDatosSuficientes(),
      ]);

    const combinaciones: CombinacionViolacion[] = [];
    const ajustes: AjusteExtremo[] = [];

    for (const grupo of grupos) {
      const gauss = this.stats.calcularLimitesGauss(grupo.valores);
      const percentiles = this.stats.calcularLimitesPercentiles(
        grupo.valores,
        fracciones,
      );
      const tukey = this.stats.calcularLimitesTukey(grupo.valores);
      const consenso = this.stats.calcularConsenso(gauss, percentiles, tukey);

      const amplitudLimite =
        consenso.limiteConsenso.superior - consenso.limiteConsenso.inferior;
      const amplitudExtremo =
        consenso.extremoConsenso.superior - consenso.extremoConsenso.inferior;

      // Regla A ahora cubre DOS chequeos independientes (límite fijo, extremo
      // configurable) — cualquiera de los dos que viole se reporta, ambos si
      // corresponde. Regla A tiene prioridad sobre Regla B EN LA MISMA
      // combinación: si CUALQUIERA de los dos violó, ni se evalúa el extremo
      // para autoajuste (el ajuste jamás se aplicaría igual, se rechaza todo).
      let violoAmplitud = false;
      if (amplitudLimite > AMPLITUD_MAXIMA_LIMITE) {
        combinaciones.push({
          scope: describirScope(grupo.scope),
          amplitud: amplitudLimite,
          tipo: 'limite',
        });
        violoAmplitud = true;
      }
      if (
        amplitudMaximaExtremo !== null &&
        amplitudExtremo > amplitudMaximaExtremo
      ) {
        combinaciones.push({
          scope: describirScope(grupo.scope),
          amplitud: amplitudExtremo,
          tipo: 'extremo',
        });
        violoAmplitud = true;
      }
      if (!violoAmplitud && consenso.extremoConsenso.inferior <= 0) {
        ajustes.push({
          scope: describirScope(grupo.scope),
          valorOriginal: consenso.extremoConsenso.inferior,
          epsilonAplicado: epsilon,
        });
      }
    }

    // Cualquier violación de amplitud rechaza el cambio COMPLETO — se
    // descartan los ajustes de Regla B que se hayan juntado en el camino,
    // aunque sean de combinaciones distintas a las que violaron.
    if (combinaciones.length > 0) {
      return { tipo: 'rechazado', combinaciones };
    }
    return { tipo: 'aceptado', ajustes };
  }

  // Una sola lectura de TODOS los pares válidos y agrupación en memoria (8
  // combinaciones por fila) en vez de 1 query por combinación: con miles de
  // pares y cientos de combinaciones posibles, evitar el N+1 es lo que hace
  // viable validar esto dentro de un único PATCH.
  private async enumerarGruposConDatosSuficientes(): Promise<GrupoScope[]> {
    const filas = await this.prisma.wearRatePair.findMany({
      where: { esValido: true },
      select: {
        trenNumero: true,
        tipoCoche: true,
        bogieCodigo: true,
        tasaMensual: true,
      },
    });

    const grupos = new Map<string, GrupoScope>();
    for (const f of filas) {
      const valor = Number(f.tasaMensual);
      for (const scope of subconjuntosDeFila(f)) {
        const k = claveScope(scope);
        let grupo = grupos.get(k);
        if (!grupo) {
          grupo = { scope, valores: [] };
          grupos.set(k, grupo);
        }
        grupo.valores.push(valor);
      }
    }

    return [...grupos.values()].filter(
      (g) => g.valores.length >= CONTEO_MINIMO,
    );
  }
}
