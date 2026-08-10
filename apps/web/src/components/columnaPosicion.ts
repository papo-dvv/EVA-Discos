import { createElement, type CSSProperties } from 'react'
import type { ColumnHelper } from '@tanstack/react-table'

// Columna/panel pinneado a la izquierda: identidad física de un disco
// (Coche+N°Coche+Bogie+Eje+Lado, mismo orden jerárquico que common/orden-fisico.ts
// en el backend) — extraído de TablaWearRate (Tasa de Desgaste) para
// reutilizarlo tal cual en cualquier tabla que muestre discos individuales
// (ver también TablaProyeccion). Colapsada, solo queda visible el botón de
// alternar (ancho mínimo); expandida, se suman las 5 columnas de identidad
// antes que el resto de la tabla.
//
// Genérico en T (el tipo de fila de cada tabla): la mecánica de pin/ancho es
// idéntica en cualquier tabla, pero cada una define sus propias 5 columnas
// accessor (con su propio `columnHelper`, ligado a su propio tipo de fila) —
// acá solo vive lo que NO depende del tipo de fila: anchos, cálculo de
// posición sticky, y la columna de toggle (un `display`, no necesita accessor).
//
// Archivo .ts (no .tsx): columnaIdentidadToggle usa createElement en vez de
// JSX a propósito — un .tsx que exporta una función no-componente junto a
// constantes dispara react-refresh/only-export-components (ver el mismo
// criterio en features/system-params/components/FilaParametro.tsx).

export const ANCHO_TOGGLE_POSICION = 32
export const ANCHO_COCHE_POSICION = 56
export const ANCHO_NUMERO_COCHE_POSICION = 84
export const ANCHO_BOGIE_POSICION = 72
export const ANCHO_EJE_POSICION = 52
export const ANCHO_LADO_POSICION = 92

export const ORDEN_PIN_POSICION = [
  'identidadToggle',
  'identidadCoche',
  'identidadNumeroCoche',
  'identidadBogie',
  'identidadEje',
  'identidadLado',
] as const
export type IdPinPosicion = (typeof ORDEN_PIN_POSICION)[number]

// Los 5 ids de columna de identidad (sin el toggle) — para que cada tabla
// pueda sumarlos a su propio set de columnas en tipografía mono.
export const COLUMNAS_MONO_POSICION: readonly string[] = ORDEN_PIN_POSICION

const ANCHOS_PIN_POSICION: Record<IdPinPosicion, number> = {
  identidadToggle: ANCHO_TOGGLE_POSICION,
  identidadCoche: ANCHO_COCHE_POSICION,
  identidadNumeroCoche: ANCHO_NUMERO_COCHE_POSICION,
  identidadBogie: ANCHO_BOGIE_POSICION,
  identidadEje: ANCHO_EJE_POSICION,
  identidadLado: ANCHO_LADO_POSICION,
}

export function calcularInfoPinPosicion(abierta: boolean) {
  const ids: readonly IdPinPosicion[] = abierta ? ORDEN_PIN_POSICION : ['identidadToggle']
  const infos = new Map<string, { left: number; ancho: number }>()
  let left = 0
  for (const id of ids) {
    infos.set(id, { left, ancho: ANCHOS_PIN_POSICION[id] })
    left += ANCHOS_PIN_POSICION[id]
  }
  return { infos, ultimo: ids[ids.length - 1] as string }
}

export function estiloHeaderPinPosicion(
  pinInfo: Map<string, { left: number; ancho: number }>,
  ultimoPin: string,
  id: string,
): CSSProperties | undefined {
  const info = pinInfo.get(id)
  if (!info) return undefined
  return {
    position: 'sticky',
    left: info.left,
    width: info.ancho,
    minWidth: info.ancho,
    zIndex: 3,
    boxShadow: id === ultimoPin ? '4px 0 8px -4px rgba(85, 82, 74, 0.25)' : undefined,
  }
}

export function estiloBodyPinPosicion(
  pinInfo: Map<string, { left: number; ancho: number }>,
  ultimoPin: string,
  id: string,
): CSSProperties | undefined {
  const info = pinInfo.get(id)
  if (!info) return undefined
  return {
    position: 'sticky',
    left: info.left,
    width: info.ancho,
    minWidth: info.ancho,
    zIndex: 2,
    background: 'rgba(255, 255, 255, 0.94)',
    boxShadow: id === ultimoPin ? '4px 0 8px -4px rgba(85, 82, 74, 0.18)' : undefined,
  }
}

// Único elemento de la columna de identidad que no depende del tipo de fila
// (T) — un `display`, no un `accessor`. Cada tabla sigue definiendo sus
// propias 5 columnas accessor (Coche/N°Coche/Bogie/Eje/Lado) con su propio
// `columnHelper`, ligadas a la forma real de su fila.
export function columnaIdentidadToggle<T>(columnHelper: ColumnHelper<T>, abierta: boolean, alternar: () => void) {
  const etiqueta = abierta ? 'Ocultar identidad del disco' : 'Mostrar identidad del disco'
  return columnHelper.display({
    id: 'identidadToggle',
    header: () =>
      createElement(
        'button',
        {
          type: 'button',
          onClick: alternar,
          'aria-label': etiqueta,
          title: etiqueta,
          className: 'flex h-6 w-6 items-center justify-center rounded-full text-concreto-oscuro transition-colors hover:bg-white/60',
        },
        abierta ? '◂' : '▸',
      ),
    cell: () => null,
    enableSorting: false,
  })
}
