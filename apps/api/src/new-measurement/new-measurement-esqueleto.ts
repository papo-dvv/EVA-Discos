import { LadoDisco, type TipoCoche } from '../../generated/prisma';
import {
  resolverIdentidadPorEje,
  resolverRuedaNumero,
} from './new-measurement-csv.parser';

// Las 48 posiciones POSIBLES de disco de un tren Alstom (24 ejes x 2 lados),
// calculadas en memoria (sin Prisma): sirven para que el frontend de ingreso
// manual muestre 48 filas "vacías" para completar SIN necesitar 48
// scan_records reales de entrada — H/T son NOT NULL en el schema, así que una
// fila sin medición todavía simplemente no existe como registro (ver
// NewMeasurementService.crearManual).
export interface PosicionEsqueleto {
  ejeNumero: number;
  lado: LadoDisco;
  tipoCoche: TipoCoche;
  bogieCodigo: string;
  ruedaNumero: number;
  numeroCoche: number | null;
}

export function generarEsqueleto48(
  numerosCochePorTipo: Partial<Record<TipoCoche, number>> = {},
): PosicionEsqueleto[] {
  const posiciones: PosicionEsqueleto[] = [];
  for (let eje = 1; eje <= 24; eje++) {
    const identidad = resolverIdentidadPorEje(eje);
    if (!identidad) continue;
    for (const lado of [LadoDisco.izquierdo, LadoDisco.derecho] as const) {
      posiciones.push({
        ejeNumero: eje,
        lado,
        tipoCoche: identidad.tipoCoche,
        bogieCodigo: identidad.bogieCodigo,
        ruedaNumero: resolverRuedaNumero(eje, lado),
        numeroCoche: numerosCochePorTipo[identidad.tipoCoche] ?? null,
      });
    }
  }
  return posiciones;
}
