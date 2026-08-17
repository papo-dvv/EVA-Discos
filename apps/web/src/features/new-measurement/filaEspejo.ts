import type { EstadoDisco, MotivoInvalido, PosicionEsqueleto, PreviewRow } from './types'

// Construye las 24 filas "espejo" (una por eje, izquierdo|Coche|derecho) de
// la tabla de la ficha a partir de las 48 posiciones posibles (esqueleto,
// siempre completo) y las filas que ya existen como scan_records (rows,
// parcial: solo los ejes/lados que trae el CSV o que ya se completaron a
// mano). Lógica pura, sin componentes — así se puede testear/reutilizar sin
// montar React.

export interface LadoFilaEspejo {
  ruedaNumero: number
  // null = todavía no existe scan_record para este eje+lado (fila vacía,
  // editable para completarla) — ver AgregarFilaFicha.
  recordId: string | null
  observacion: string | null
  tValue: number | null
  hValue: number | null
  rdValue: number | null
  rugosidadRa: number | null
  reperfiladoTAntes: number | null
  reperfiladoHAntes: number | null
  // Estado calculado del disco (BrakeDiscRulesEngine.clasificarEstadoConReperfilado,
  // backend) — alimenta el chip de Estado de la columna "Observación" en
  // TablaFichaEspejo. null en una fila vacía (todavía sin T/H).
  estadoCalculado: EstadoDisco | null
  // Flags de validación cruzada automática de ESTE disco (ver
  // NewMeasurementValidationService) — siempre false en una fila vacía o en
  // una fila de una tabla de solo-lectura (comparativa histórica).
  tInvalido: boolean
  rdInvalido: boolean
  // Espejo legible de tInvalido/rdInvalido — alimenta la columna
  // "Motivo/Inválido" y el resaltado por celda de TablaFichaEspejo. Vacío en
  // una fila vacía o de solo lectura. kmInvalido/fechaInvalido (a nivel
  // ficha, no de esta fila) viajan aparte — ver PreviewFichaResult.
  motivos: MotivoInvalido[]
}

export interface FilaEspejo {
  ejeNumero: number
  tipoCoche: string
  bogieCodigo: string
  numeroCoche: number | null
  izquierdo: LadoFilaEspejo
  derecho: LadoFilaEspejo
}

function ladoVacio(pos: PosicionEsqueleto): LadoFilaEspejo {
  return {
    ruedaNumero: pos.ruedaNumero,
    recordId: null,
    observacion: null,
    tValue: null,
    hValue: null,
    rdValue: null,
    rugosidadRa: null,
    reperfiladoTAntes: null,
    reperfiladoHAntes: null,
    estadoCalculado: null,
    tInvalido: false,
    rdInvalido: false,
    motivos: [],
  }
}

function ladoDeFila(pos: PosicionEsqueleto, fila: PreviewRow): LadoFilaEspejo {
  return {
    ruedaNumero: pos.ruedaNumero,
    recordId: fila.id,
    observacion: fila.observacion,
    tValue: fila.tValue,
    hValue: fila.hValue,
    rdValue: fila.rdValue,
    rugosidadRa: fila.rugosidadRa,
    reperfiladoTAntes: fila.reperfiladoTAntes,
    reperfiladoHAntes: fila.reperfiladoHAntes,
    estadoCalculado: fila.estadoCalculado,
    tInvalido: fila.tInvalido,
    rdInvalido: fila.rdInvalido,
    motivos: fila.motivos,
  }
}

export function construirFilasEspejo(
  esqueleto: PosicionEsqueleto[],
  rows: PreviewRow[],
): FilaEspejo[] {
  const porEjeLado = new Map<string, PreviewRow>()
  for (const fila of rows) {
    if (fila.ejeExcel === null || !fila.ubicacionExcel) continue
    porEjeLado.set(`${fila.ejeExcel}|${fila.ubicacionExcel}`, fila)
  }

  // El esqueleto siempre trae las 24x2 posiciones completas (ver
  // generarEsqueleto48 en el backend): alcanza con agrupar por eje.
  const porEje = new Map<number, { izquierdo: PosicionEsqueleto; derecho: PosicionEsqueleto }>()
  for (const pos of esqueleto) {
    const entrada = porEje.get(pos.ejeNumero) ?? ({} as { izquierdo: PosicionEsqueleto; derecho: PosicionEsqueleto })
    entrada[pos.lado] = pos
    porEje.set(pos.ejeNumero, entrada)
  }

  return [...porEje.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ejeNumero, { izquierdo, derecho }]) => {
      const filaIzq = porEjeLado.get(`${ejeNumero}|izquierdo`)
      const filaDer = porEjeLado.get(`${ejeNumero}|derecho`)
      return {
        ejeNumero,
        tipoCoche: izquierdo.tipoCoche,
        bogieCodigo: izquierdo.bogieCodigo,
        numeroCoche: izquierdo.numeroCoche,
        izquierdo: filaIzq ? ladoDeFila(izquierdo, filaIzq) : ladoVacio(izquierdo),
        derecho: filaDer ? ladoDeFila(derecho, filaDer) : ladoVacio(derecho),
      }
    })
}
