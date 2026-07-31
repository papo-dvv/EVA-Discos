import type { Umbrales } from './umbrales';

export type EstadoDiscoCalculado = 'OK' | 'SEGUIMIENTO' | 'CAMBIO' | 'CRITICO';

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
    const { rdUmbralOk, rdUmbralSeguimiento } = this.umbrales;

    if (rd <= 0) return 'CRITICO';
    if (rd <= rdUmbralSeguimiento) return 'CAMBIO';
    if (rd < rdUmbralOk) return 'SEGUIMIENTO';
    return 'OK';
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
