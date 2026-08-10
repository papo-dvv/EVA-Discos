import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'

// PRNG con semilla fija, sin dependencias externas — mismo algoritmo de
// siempre (mulberry32): reproducible entre recargas (útil en desarrollo/QA
// para comparar capturas), pero con distribución no-uniforme de verdad (a
// diferencia de la fase áurea determinista que usaba esta función antes, que
// repetía el mismo patrón visual de espaciado).
function mulberry32(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEMILLA = 1337
// styles.md §7.1 — 5 a 8 carriles paralelos sugeridos; 7 reparte parejo un
// `cantidad` típico (24-36) sin que ningún carril quede visiblemente más
// cargado que los demás.
const CARRILES = 7
const TAMANO_BASE_PX = 26

// 3 categorías reconocibles (no ruido continuo): pequeña/mediana/grande,
// cada una con su propio rango de factor sobre TAMANO_BASE_PX.
const CATEGORIAS_TAMANO = [
  { min: 0.6, max: 0.75 }, // pequeña
  { min: 0.85, max: 1.05 }, // mediana
  { min: 1.2, max: 1.4 }, // grande
]

// styles.md §7.1 — fondo animado exclusivo de pantallas de solo aviso.
// Lluvia de meteoritos: cada tuerca cae por la MISMA diagonal de siempre
// (esquina superior izquierda -> inferior derecha, ver @keyframes
// eva-engranaje-caer en tokens.css) pero desplazada en el eje perpendicular
// según su carril (--carril), así varias caen en paralelo en vez de una
// detrás de otra en la misma línea. Tamaño/velocidad/retraso de cada tuerca
// salen de un PRNG con semilla fija (mulberry32) — reproducible, no
// aleatoriedad real del navegador.
function crearEngranajes(cantidad: number) {
  const random = mulberry32(SEMILLA)
  const anchoCarril = 100 / CARRILES

  return Array.from({ length: cantidad }, (_, i) => {
    const carril = i % CARRILES
    // Centro del carril, con jitter propio (hasta ~30% del ancho del
    // carril) para que no se vea una grilla de líneas perfectamente
    // equiespaciadas — carriles "paralelos" pero no mecánicos.
    const centro = (carril + 0.5) * anchoCarril
    const jitter = (random() - 0.5) * anchoCarril * 0.6
    // La semilla decide primero la categoría (pequeña/mediana/grande) y
    // luego el factor dentro de esa categoría — mezcla reconocible de 3
    // tamaños, no una variación continua imperceptible.
    const categoria = CATEGORIAS_TAMANO[Math.floor(random() * CATEGORIAS_TAMANO.length)]
    const factorTamano = categoria.min + random() * (categoria.max - categoria.min)

    return {
      carril: `${(centro + jitter - 50).toFixed(1)}%`,
      size: Math.round(TAMANO_BASE_PX * factorTamano),
      opacidad: Number((0.08 + random() * 0.08).toFixed(2)),
      duracion: Number((3 + random() * 4).toFixed(2)), // 3-7s por trayecto
      giro: Number((6 + random() * 4).toFixed(2)),
      // Negativo: cada tuerca arranca como si ya llevara un tramo recorrido,
      // en vez de nacer todas del mismo punto de partida en el frame inicial
      // — evita el efecto "oleada" de tuercas sincronizadas.
      retraso: Number((-(random() * 7)).toFixed(2)),
    }
  })
}

type FondoEngranajesProps = {
  cantidad?: number
  className?: string
  children?: ReactNode
}

export function FondoEngranajes({ cantidad = 30, className = '', children }: FondoEngranajesProps) {
  const engranajes = useMemo(() => crearEngranajes(cantidad), [cantidad])

  return (
    <div className={`bg-engranajes-cayendo rounded-glass ${className}`}>
      {engranajes.map((g, i) => (
        <span
          key={i}
          className="engranaje"
          style={
            {
              '--carril': g.carril,
              '--size': `${g.size}px`,
              '--opacidad': g.opacidad,
              '--duracion': `${g.duracion}s`,
              '--giro': `${g.giro}s`,
              '--retraso': `${g.retraso}s`,
            } as CSSProperties
          }
        >
          <svg width="100%" height="100%" role="presentation" aria-hidden="true">
            <use href="/icons.svg#gear-icon" />
          </svg>
        </span>
      ))}
      {children}
    </div>
  )
}
