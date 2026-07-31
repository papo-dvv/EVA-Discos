import { Injectable } from '@nestjs/common';

// Motor de cálculo de tasa de desgaste — puro (sin Prisma ni Nest DI más
// allá del decorador), para poder testearlo en aislamiento. Un "par" son dos
// mediciones CONSECUTIVAS del mismo disco físico: fecha1 = medición n,
// fecha2 = medición n+1.

export interface ParInput {
  rd1: number;
  rd2: number;
  km1: number;
  km2: number;
  motivo2: string;
  kmMensual: number;
}

export interface ParCalculado {
  diferenciaKm: number;
  diferenciaRd: number;
  tasa: number;
  tasaMensual: number;
  esValido: boolean;
  comentario: string;
}

const MOTIVO_RD_MAYOR = 'Rd de fecha 2 mayor que Rd de fecha 1';
const MOTIVO_REPERFILADO = 'Motivo de fecha 2 es Reperfilado';
const MOTIVO_CAMBIO = 'Motivo de fecha 2 es Cambio';
const MOTIVO_GIRO = 'Motivo de fecha 2 es Pares montados de giro';
const MOTIVO_KM_MENOR = 'Kilometraje de fecha 2 menor que fecha 1';
// No está en la lista de reglas original, pero es necesario: sin esto,
// Km(n+1) == Km(n) (dos mediciones el mismo día, mismo odómetro — ocurre en
// datos reales) produce una división 0/0 o x/0, que ni JS ni el DECIMAL(20,12)
// de la base pueden representar (Prisma rechaza NaN/Infinity de plano).
const MOTIVO_KM_IGUAL =
  'Kilometraje de fecha 2 igual a fecha 1 (no se puede calcular una tasa)';

// Redondea a 7 decimales; si el resultado da todo ceros pero el valor real
// no es exactamente cero, extiende decimal por decimal (hasta 9) buscando el
// primer dígito significativo. Con diferencias de Rd pequeñas sobre
// recorridos largos, 7 decimales a veces no alcanzan a mostrar nada útil.
export function formatearTasa(valor: number): string {
  if (valor === 0) return valor.toFixed(7);
  for (let decimales = 7; decimales <= 9; decimales++) {
    const fijo = valor.toFixed(decimales);
    if (Number(fijo) !== 0) return fijo;
  }
  return valor.toFixed(9);
}

@Injectable()
export class WearRateCalculatorService {
  // Evalúa TODAS las reglas de invalidez (no corta en la primera) y acumula
  // los motivos que aplican. La invalidez de este par es local a él: no
  // hereda ni contamina el par siguiente en la cadena del mismo disco (eso
  // lo garantiza que cada llamada es independiente, sin estado compartido).
  calcularPar(input: ParInput): ParCalculado {
    const diferenciaRd = input.rd1 - input.rd2;
    const diferenciaKm = input.km2 - input.km1;

    const motivos: string[] = [];
    // Rd(n) - Rd(n+1) < 0 es la misma condición que Rd2 > Rd1: un solo check.
    if (diferenciaRd < 0) motivos.push(MOTIVO_RD_MAYOR);
    if (input.motivo2 === 'Reperfilado') motivos.push(MOTIVO_REPERFILADO);
    // Substring case-insensitive, NO igualdad exacta: el motivo real (texto
    // libre del Excel) aparece como "Cambio", "Cambio de discos", "Cambio de
    // Disco", "Cambio Par Montado", "Cambio de pares montados", "Medición y
    // Cambio", etc. — cualquier variante que mencione un cambio de disco
    // rompe la continuidad física que asume esta tasa (rd2 pertenece a un
    // disco NUEVO, no es desgaste del mismo disco de rd1). Con igualdad
    // exacta, todas esas variantes quedaban esValido=true y su Rd1→Rd2 (caída
    // real por el cambio, no por desgaste) se extrapolaba a un mes completo,
    // inflando outliers de tasaMensual hasta ~67,000 y disparando los límites
    // de Gauss (media±2σ/3σ, muy sensible a outliers) a rangos de miles.
    if (/cambio/i.test(input.motivo2)) motivos.push(MOTIVO_CAMBIO);
    // "Pares montados de giro" (rotación/torneado de ruedas): igual que un
    // cambio de disco, rompe la continuidad física entre rd1 y rd2 — caso
    // real confirmado (tren 10, coche 120): diferenciaKm=207 idéntico en 6
    // pares distintos con tasaMensual de 32 a 43, muy por encima de cualquier
    // medición real (máximo ~18 entre las genuinas), y el grupo que más
    // ensanchaba los límites de Gauss tras excluir la familia "Cambio".
    // Comparación case-insensitive por el mismo motivo que MOTIVO_CAMBIO: no
    // asumir que el texto libre del Excel siempre viene con la misma capitalización.
    if (input.motivo2.toLowerCase() === 'pares montados de giro') {
      motivos.push(MOTIVO_GIRO);
    }
    if (diferenciaKm < 0) motivos.push(MOTIVO_KM_MENOR);
    else if (diferenciaKm === 0) motivos.push(MOTIVO_KM_IGUAL);

    if (motivos.length > 0) {
      return {
        diferenciaKm,
        diferenciaRd,
        tasa: 0,
        tasaMensual: 0,
        esValido: false,
        comentario: motivos.join('; '),
      };
    }

    const tasa = diferenciaRd / diferenciaKm;
    const tasaMensual = tasa * input.kmMensual;
    return {
      diferenciaKm,
      diferenciaRd,
      tasa,
      tasaMensual,
      esValido: true,
      comentario: 'Válido',
    };
  }

  formatearTasa(valor: number): string {
    return formatearTasa(valor);
  }
}
