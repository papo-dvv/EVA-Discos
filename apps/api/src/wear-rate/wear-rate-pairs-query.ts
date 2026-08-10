import type { EstadoDisco } from '../../generated/prisma';
import { Prisma } from '../../generated/prisma';
import type { Umbrales } from '../brake-disc-rules/umbrales';
import { empujarRango, rangoFecha } from '../scan-records/scan-record-query';
import type { WearRatePairsQueryDto } from './dto/wear-rate-pairs-query.dto';

// Traduce un estado de disco al rango de rd2 que lo produce, con los mismos
// límites (estrictos/no estrictos) que BrakeDiscRulesEngine.clasificarEstado:
// rd<=0 Crítico, 0<rd<=rdUmbralSeguimiento Cambio, rdUmbralSeguimiento<rd<rdUmbralOk
// Seguimiento, rd>=rdUmbralOk OK. WearRatePair no tiene una columna
// estadoCalculado propia (a diferencia de ScanRecord) — rd2 SÍ existe, así
// que se puede expresar como un WHERE normal en vez de post-filtrar.
function rangoRd2ParaEstado(
  estado: EstadoDisco,
  umbrales: Umbrales,
): Prisma.FloatFilter {
  switch (estado) {
    case 'CRITICO':
      return { lte: 0 };
    case 'CAMBIO':
      return { gt: 0, lte: umbrales.rdUmbralSeguimiento };
    case 'SEGUIMIENTO':
      return { gt: umbrales.rdUmbralSeguimiento, lt: umbrales.rdUmbralOk };
    case 'OK':
      return { gte: umbrales.rdUmbralOk };
    case 'REPERFILADO':
      // Nunca debería llegar acá: WearRatePairsQueryDto valida estado[]
      // contra ESTADOS_DISCO (4 estados, sin REPERFILADO) — wear-rate/pairs
      // no tiene H por fila, así que no participa de la clasificación
      // ampliada (ver BrakeDiscRulesEngine.clasificarEstadoConReperfilado,
      // exclusiva de Migración/Mediciones). Caso agregado solo para que el
      // switch siga siendo exhaustivo tras sumar REPERFILADO al enum.
      throw new Error(
        'REPERFILADO no es un estado válido para el filtro de wear-rate/pairs',
      );
  }
}

// WHERE-builder de /wear-rate/pairs. A diferencia de scan-record-query.ts NO
// hay `base` (migración vs. confirmados): wear_rate_pairs es una tabla plana,
// siempre de alcance global — el filtro de tren es un filtro más, combinable
// con el resto según modoCombinacion (igual que scan-records trata `tren`
// dentro de construirWhereScanRecord, no como un AND aparte). Reutiliza
// rangoFecha/empujarRango de scan-record-query.ts en vez de duplicar esa
// lógica — acá solo se agregan las condiciones propias de wear-rate-pairs
// (identidad del disco, es_valido, dos rangos de fecha independientes).
// `umbrales` es opcional: sin él, un filtro de estado[] simplemente se
// ignora (ningún llamador debería omitirlo si `q.estado` viene con datos —
// ver WearRateService.buscarPares, que siempre los resuelve primero).
export function construirWhereWearRate(
  q: WearRatePairsQueryDto,
  umbrales?: Umbrales,
): Prisma.WearRatePairWhereInput {
  const condiciones: Prisma.WearRatePairWhereInput[] = [];

  if (q.tren !== undefined) condiciones.push({ trenNumero: q.tren });
  if (q.tipoCoche?.length) condiciones.push({ tipoCoche: { in: q.tipoCoche } });
  if (q.bogieCodigo?.length) {
    condiciones.push({ bogieCodigo: { in: q.bogieCodigo } });
  }
  if (q.lado?.length) condiciones.push({ lado: { in: q.lado } });
  if (q.motivoFecha2?.length) {
    condiciones.push({ motivo2: { in: q.motivoFecha2 } });
  }
  if (q.estado?.length && umbrales) {
    condiciones.push({
      OR: q.estado.map((e) => ({ rd2: rangoRd2ParaEstado(e, umbrales) })),
    });
  }

  // Tri-estado, igual patrón que corregidoOAdvertencia en scan-record-query.ts:
  // true = solo inválidos, false = solo válidos, ausente = sin filtro.
  if (q.soloInvalidos === true) condiciones.push({ esValido: false });
  else if (q.soloInvalidos === false) condiciones.push({ esValido: true });

  // Dos rangos de fecha INDEPENDIENTES: la tabla tiene fecha_1 y fecha_2, a
  // diferencia de ScanRecord que solo tiene una `fecha`.
  const fecha1 = rangoFecha(q.fecha1Desde, q.fecha1Hasta);
  if (fecha1) condiciones.push({ fecha1 });
  const fecha2 = rangoFecha(q.fecha2Desde, q.fecha2Hasta);
  if (fecha2) condiciones.push({ fecha2 });

  empujarRango(condiciones, 'km1', q.km1Min, q.km1Max);
  empujarRango(condiciones, 'km2', q.km2Min, q.km2Max);
  empujarRango(condiciones, 'rd1', q.rd1Min, q.rd1Max);
  empujarRango(condiciones, 'rd2', q.rd2Min, q.rd2Max);
  empujarRango(
    condiciones,
    'diferenciaKm',
    q.diferenciaKmMin,
    q.diferenciaKmMax,
  );
  empujarRango(
    condiciones,
    'diferenciaRd',
    q.diferenciaRdMin,
    q.diferenciaRdMax,
  );
  empujarRango(condiciones, 'tasa', q.tasaMin, q.tasaMax);
  empujarRango(condiciones, 'tasaMensual', q.tasaMensualMin, q.tasaMensualMax);
  empujarRango(condiciones, 'ejeNumero', q.ejeNumeroMin, q.ejeNumeroMax);

  if (condiciones.length === 0) return {};

  return q.modoCombinacion === 'OR'
    ? { OR: condiciones }
    : { AND: condiciones };
}
