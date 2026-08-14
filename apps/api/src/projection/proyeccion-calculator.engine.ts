const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_POR_MES_PROYECCION = 30;
const MS_POR_MES_PROYECCION = DIAS_POR_MES_PROYECCION * MS_POR_DIA;

function truncarAUnDecimal(valor: number): number {
  return Math.trunc(valor * 10) / 10;
}

// La tasa es mensual: primero se trunca a un decimal el resultado de
// (umbralReperfilado - h) / tasaMensual; recién después se multiplica por
// 30 días para obtener la fecha estimada, sin redondearla hacia adelante.
export function sumarMeses(fecha: Date, meses: number): Date {
  const dias = truncarAUnDecimal(meses) * DIAS_POR_MES_PROYECCION;
  return new Date(fecha.getTime() + dias * MS_POR_DIA);
}

export function mesesEntre(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / MS_POR_MES_PROYECCION;
}

// Límite TÉCNICO de seguridad (no una regla de negocio): evita un bucle
// infinito ante datos patológicos donde H nunca llegaría a cruzar el umbral
// de reperfilado (ej. tasaMensual <= 0) o donde el descuento de reperfilado
// nunca reduce Rd lo suficiente (ej. reperfiladoDescuentoRd=0) — bien por
// encima de cualquier escenario real de desgaste/reperfilado. Si se alcanza
// sin converger a la condición de Cambio, proyectarCiclos lanza
// ProyeccionNoConvergeError en vez de devolver un resultado truncado o
// colgarse.
const LIMITE_ITERACIONES_SEGURIDAD = 200;

// Lanzado por proyectarCiclos cuando ni la condición de Cambio ni el límite
// de seguridad de arriba se alcanzan de forma razonable — en la práctica,
// ProyeccionCalculatorService.proyectarDisco ya filtra tasaMensual<=0 ANTES
// de llegar acá (devuelve proyectable:false con un motivo claro), así que
// este error es sobre todo una salvaguarda del motor puro en sí mismo, no el
// camino esperado de un disco real.
export class ProyeccionNoConvergeError extends Error {
  constructor() {
    super(
      'La proyección no converge a una condición de Cambio dentro de un rango razonable de ciclos — revisá la tasa de desgaste y los umbrales de reperfilado configurados.',
    );
    this.name = 'ProyeccionNoConvergeError';
  }
}

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
  // Ya NO es nullable: sin cap de ciclos, el cálculo SIEMPRE continúa hasta
  // la condición real de Cambio (o lanza ProyeccionNoConvergeError si eso no
  // pasa dentro del límite técnico de seguridad) — nunca vuelve "a medias".
  cicloCambio: CicloCambio;
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

  for (let numero = 1; numero <= LIMITE_ITERACIONES_SEGURIDAD; numero++) {
    const rd = t - h;
    if (rd <= umbrales.rdUmbralCambioProyeccion) {
      return {
        ciclosReperfilado,
        cicloCambio: {
          mesesHastaFecha: mesesAcumulados,
          fechaEstimada: fecha,
        },
      };
    }

    // A partir de acá, cada iteración necesita una tasa positiva para AMBAS
    // divisiones que siguen (los meses de crecimiento hasta el umbral, y —
    // si este reperfilado no resulta viable — los meses hasta Cambio). Sin
    // eso, H nunca se movería y la proyección jamás convergería: se corta
    // acá mismo, antes de que Infinity/NaN contaminen el resultado.
    if (tasaMensual <= 0) {
      throw new ProyeccionNoConvergeError();
    }

    const meses = Math.max(0, (umbrales.hUmbralReperfilado - h) / tasaMensual);
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

  throw new ProyeccionNoConvergeError();
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
