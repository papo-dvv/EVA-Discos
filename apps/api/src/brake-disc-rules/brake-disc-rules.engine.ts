import type { Umbrales } from './umbrales';

export type EstadoDiscoCalculado = 'OK' | 'SEGUIMIENTO' | 'CAMBIO' | 'CRITICO';

// Quinto estado posible, exclusivo de clasificarEstadoConReperfilado — NUNCA
// lo devuelve clasificarEstado (rd puro, 4 estados). Ver el comentario de esa
// función más abajo para la prioridad exacta.
export type EstadoDiscoAmpliado = EstadoDiscoCalculado | 'REPERFILADO';

export type AccionRecomendada =
  'CRITICO' | 'CAMBIO' | 'REPERFILADO' | 'NINGUNA';
export type LadoAfectado = 'izquierdo' | 'derecho' | 'ambos' | null;

export interface MedicionDisco {
  rd: number;
  h: number;
}

export interface ResultadoAccionRecomendada {
  accion: AccionRecomendada;
  ladoAfectado: LadoAfectado;
}

// t - h no depende de ningún umbral configurable — se deja como función
// suelta para no obligar a instanciar el motor (con umbrales) solo para esto.
export function calcularRd(t: number, h: number): number {
  return t - h;
}

// Motor de reglas de discos de freno — ÚNICA fuente de verdad para el estado
// y la acción recomendada. Sin dependencias de Prisma ni de Nest a propósito:
// los umbrales entran ya resueltos por el constructor, así que es un objeto
// plano, fácil de instanciar y testear sin levantar ningún módulo.
//
// Nunca se debe confiar en un estado/acción que venga de un archivo externo
// (CSV/Excel) — eso se usa solo para comparación/advertencia, nunca como
// fuente de cálculo.
export class BrakeDiscRulesEngine {
  constructor(private readonly umbrales: Umbrales) {}

  calcularRd(t: number, h: number): number {
    return calcularRd(t, h);
  }

  clasificarEstado(rd: number): EstadoDiscoCalculado {
    const { rdUmbralOk, rdUmbralSeguimiento, rdUmbralCritico } = this.umbrales;

    if (rd <= rdUmbralCritico) return 'CRITICO';
    if (rd <= rdUmbralSeguimiento) return 'CAMBIO';
    if (rd < rdUmbralOk) return 'SEGUIMIENTO';
    return 'OK';
  }

  // Extiende clasificarEstado con REPERFILADO, cruzando Rd con H — usada SOLO
  // por Migración (preview) y Mediciones confirmadas (ver estado_calculado en
  // MigrationExcelParser/MigrationPreviewService/ScanRecordsService); Tasa de
  // Desgaste y Trazabilidad siguen usando clasificarEstado puro (no tienen H
  // por fila). Prioridad estricta, evaluada en este orden:
  //   a. rd <= rd_umbral_critico -> CRITICO, incondicional (ni mira H).
  //   b. rd > rd_umbral_critico y H >= h_umbral_reperfilado y
  //      (rd - reperfilado_descuento_rd) > rd_umbral_seguimiento (el
  //      resultado post-reperfilado NO cae en zona de Cambio) -> REPERFILADO.
  //      Sobreescribe lo que rd solo habría dado (ej. rd=1.5/h=1.8 da
  //      REPERFILADO, no OK: H manda).
  //   c. rd > rd_umbral_critico y H >= h_umbral_reperfilado y
  //      (rd - reperfilado_descuento_rd) <= rd_umbral_seguimiento -> CAMBIO
  //      (el reperfilado no es viable, se degrada). Límite exacto:
  //      rd=1.20/h=1.8 con los defaults da CAMBIO, no REPERFILADO —
  //      (1.20-0.80)=0.40 no es > 0.40 (comparación estricta).
  //   d. Si nada de lo anterior aplica -> clasificarEstado(rd) puro.
  clasificarEstadoConReperfilado(rd: number, h: number): EstadoDiscoAmpliado {
    const {
      rdUmbralCritico,
      rdUmbralSeguimiento,
      hUmbralReperfilado,
      reperfiladoDescuentoRd,
    } = this.umbrales;

    if (rd <= rdUmbralCritico) return 'CRITICO';

    if (h >= hUmbralReperfilado) {
      return rd - reperfiladoDescuentoRd > rdUmbralSeguimiento
        ? 'REPERFILADO'
        : 'CAMBIO';
    }

    return this.clasificarEstado(rd);
  }

  evaluarAccionRecomendada(
    discoIzquierdo: MedicionDisco,
    discoDerecho: MedicionDisco,
  ): ResultadoAccionRecomendada {
    const { rdUmbralSeguimiento, hUmbralReperfilado, reperfiladoDescuentoRd } =
      this.umbrales;

    // a. Cualquier lado en Rd crítico obliga a intervenir el eje completo.
    if (discoIzquierdo.rd <= 0 || discoDerecho.rd <= 0) {
      return { accion: 'CRITICO', ladoAfectado: 'ambos' };
    }

    const noAlcanzaConReperfilado = (disco: MedicionDisco): boolean =>
      disco.h >= hUmbralReperfilado &&
      disco.rd - reperfiladoDescuentoRd <= rdUmbralSeguimiento;

    // b. El reperfilado dejaría el disco en (o bajo) Seguimiento: no alcanza,
    // hay que cambiarlo — sin importar cómo esté el otro lado.
    if (
      noAlcanzaConReperfilado(discoIzquierdo) ||
      noAlcanzaConReperfilado(discoDerecho)
    ) {
      return { accion: 'CAMBIO', ladoAfectado: 'ambos' };
    }

    const reperfiladoViable = (disco: MedicionDisco): boolean =>
      disco.h >= hUmbralReperfilado &&
      disco.rd - reperfiladoDescuentoRd > rdUmbralSeguimiento;

    const viableIzquierdo = reperfiladoViable(discoIzquierdo);
    const viableDerecho = reperfiladoViable(discoDerecho);

    // c. Reperfilado viable en uno o en ambos lados, de forma independiente.
    if (viableIzquierdo && viableDerecho) {
      return { accion: 'REPERFILADO', ladoAfectado: 'ambos' };
    }
    if (viableIzquierdo) {
      return { accion: 'REPERFILADO', ladoAfectado: 'izquierdo' };
    }
    if (viableDerecho) {
      return { accion: 'REPERFILADO', ladoAfectado: 'derecho' };
    }

    // d. Ninguna condición aplica.
    return { accion: 'NINGUNA', ladoAfectado: null };
  }
}
