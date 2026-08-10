const DIAS_POR_MES_PROMEDIO = 365.25 / 12;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MS_POR_MES_PROMEDIO = DIAS_POR_MES_PROMEDIO * MS_POR_DIA;

export function sumarMeses(fecha: Date, meses: number): Date {
  return new Date(fecha.getTime() + meses * MS_POR_MES_PROMEDIO);
}

export function mesesEntre(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / MS_POR_MES_PROMEDIO;
}

export const MAX_CICLOS_REPERFILADO = 5;

export interface UmbralesProyeccion {
  hUmbralReperfilado: number;
  reperfiladoDescuentoRd: number;
  rdUmbralSeguimiento: number;
  rdUmbralCambioProyeccion: number;
}

export interface EstadoActualDisco {
  h: number;
  rd: number;
  fecha: Date;
}

export interface CicloReperfilado {
  numero: number;
  mesesHastaFecha: number;
  fechaEstimada: Date;
  // H (Desgaste Cóncavo) en el instante en que dispara este reperfilado —
  // normalmente h_umbral_reperfilado, salvo que el disco ya arrancara sobre
  // el umbral (0 meses de crecimiento, ver "H ya en o sobre el umbral" en el
  // spec).
  hEnEseMomento: number;
  // T (Espesor Medido) vigente ANTES de este reperfilado — la base sobre la
  // que se calcula rdAntes. El siguiente ciclo arranca con
  // tEnEseMomento - reperfiladoDescuentoRd (T pierde el descuento, no H).
  tEnEseMomento: number;
  // Rd (Vida Útil) justo antes de aplicar el descuento de reperfilado.
  rdAntes: number;
  // Rd proyectado cuando H vuelva a alcanzar h_umbral_reperfilado en el
  // siguiente ciclo (= tEnEseMomento - reperfiladoDescuentoRd - hEnEseMomento
  // del siguiente ciclo) — NO es el Rd real inmediatamente tras el
  // reperfilado (ese es tEnEseMomento - reperfiladoDescuentoRd, con H=0).
  rdDespues: number;
}

export interface CicloCambio {
  mesesHastaFecha: number;
  fechaEstimada: Date;
}

export interface ResultadoProyeccionCiclos {
  ciclosReperfilado: CicloReperfilado[];
  cicloCambio: CicloCambio | null;
  truncado: boolean;
}

export function proyectarCiclos(
  actual: EstadoActualDisco,
  tasaMensual: number,
  umbrales: UmbralesProyeccion,
): ResultadoProyeccionCiclos {
  const ciclosReperfilado: CicloReperfilado[] = [];
  let h = actual.h;
  // T (Espesor Medido) no viaja en EstadoActualDisco — se deriva una sola vez
  // de Rd = T - H (h + rd) y de ahí en más es la base que decrece 0.8 por
  // reperfilado viable, mientras H resetea a 0 (ver CicloReperfilado).
  let t = actual.h + actual.rd;
  let fecha = actual.fecha;
  let mesesAcumulados = 0;

  for (let numero = 1; numero <= MAX_CICLOS_REPERFILADO; numero++) {
    const rd = t - h;
    if (rd <= umbrales.rdUmbralCambioProyeccion) {
      return {
        ciclosReperfilado,
        cicloCambio: {
          mesesHastaFecha: mesesAcumulados,
          fechaEstimada: fecha,
        },
        truncado: false,
      };
    }

    const mesesCrudos = (umbrales.hUmbralReperfilado - h) / tasaMensual;
    const meses = Math.max(0, mesesCrudos);
    const fechaReperfilado = sumarMeses(fecha, meses);

    const hAntes = h + tasaMensual * meses;
    const rdAntes = rd - tasaMensual * meses;
    mesesAcumulados += meses;

    const rdDespues = rdAntes - umbrales.reperfiladoDescuentoRd;

    if (rdDespues <= umbrales.rdUmbralCambioProyeccion) {
      const mesesHastaCambio = Math.max(0, rdAntes / tasaMensual);
      return {
        ciclosReperfilado,
        cicloCambio: {
          mesesHastaFecha: mesesAcumulados + mesesHastaCambio,
          fechaEstimada: sumarMeses(fechaReperfilado, mesesHastaCambio),
        },
        truncado: false,
      };
    }

    ciclosReperfilado.push({
      numero,
      mesesHastaFecha: mesesAcumulados,
      fechaEstimada: fechaReperfilado,
      hEnEseMomento: hAntes,
      tEnEseMomento: t,
      rdAntes,
      rdDespues,
    });

    h = 0;
    t = t - umbrales.reperfiladoDescuentoRd;
    fecha = fechaReperfilado;
  }

  return { ciclosReperfilado, cicloCambio: null, truncado: true };
}

export interface PuntoProyectado {
  h: number;
  rd: number;
}

export function interpolarEnFecha(
  actual: EstadoActualDisco,
  ciclosReperfilado: CicloReperfilado[],
  tasaMensual: number,
  fecha: Date,
): PuntoProyectado {
  let checkpoint = { fecha: actual.fecha, h: actual.h, rd: actual.rd };
  for (const ciclo of ciclosReperfilado) {
    if (ciclo.fechaEstimada > fecha) break;
    // Justo tras el reperfilado: H resetea a 0 y Rd = T_siguiente - 0, con
    // T_siguiente = tEnEseMomento - reperfiladoDescuentoRd. Se deriva de
    // rdDespues + hEnEseMomento en vez de recibir el descuento como
    // parámetro (rdDespues = (tEnEseMomento - hEnEseMomento) - descuento).
    checkpoint = {
      fecha: ciclo.fechaEstimada,
      h: 0,
      rd: ciclo.rdDespues + ciclo.hEnEseMomento,
    };
  }

  const meses = Math.max(0, mesesEntre(checkpoint.fecha, fecha));
  return {
    h: checkpoint.h + tasaMensual * meses,
    rd: checkpoint.rd - tasaMensual * meses,
  };
}

export interface MesForecast {
  mes: string;
  fechaInicio: Date;
  fechaFin: Date;
  fechaReferencia: Date;
}

export function generarMesesForecast(hoy: Date, cantidad = 12): MesForecast[] {
  const meses: MesForecast[] = [];
  const anioBase = hoy.getUTCFullYear();
  const mesBase = hoy.getUTCMonth();

  for (let i = 0; i < cantidad; i++) {
    const fechaInicio = new Date(Date.UTC(anioBase, mesBase + i, 1));
    const fechaFin = new Date(Date.UTC(anioBase, mesBase + i + 1, 1));
    meses.push({
      mes: fechaInicio.toISOString().slice(0, 7),
      fechaInicio,
      fechaFin,
      fechaReferencia: new Date(fechaFin.getTime() - 1),
    });
  }
  return meses;
}

export function fechaCaeEnMes(fecha: Date, mes: MesForecast): boolean {
  return fecha >= mes.fechaInicio && fecha < mes.fechaFin;
}
