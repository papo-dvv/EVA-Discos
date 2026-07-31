import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

// Área con scrollbar propio (styles.md §6): oculta el scrollbar nativo y dibuja
// uno delgado tipo iOS —thumb verde translúcido, track arena— que aparece en
// hover/scroll y hace fade out al quedar inactivo. El thumb es arrastrable.
// El alto lo define el consumidor con `viewportClassName` (ej. max-h-[70vh]).
type Ejes = 'y' | 'x' | 'both'

type Metricas = { size: number; offset: number; visible: boolean }

const OCULTO: Metricas = { size: 0, offset: 0, visible: false }
const THUMB_MIN = 28
const INSET = 6 // top+bottom (o left+right) del bar respecto al viewport

type ScrollAreaProps = {
  ejes?: Ejes
  className?: string
  viewportClassName?: string
  // El consumidor puede pasar su propio ref del viewport (ej. VirtualList lo
  // necesita para el virtualizador); si no, ScrollArea usa uno interno.
  viewportRef?: RefObject<HTMLDivElement | null>
  style?: CSSProperties
  viewportStyle?: CSSProperties
  children?: ReactNode
}

export function ScrollArea({
  ejes = 'y',
  className = '',
  viewportClassName = '',
  viewportRef,
  style,
  viewportStyle,
  children,
}: ScrollAreaProps) {
  const vpRef = useRef<HTMLDivElement | null>(null)
  const [v, setV] = useState<Metricas>(OCULTO)
  const [h, setH] = useState<Metricas>(OCULTO)
  const [activo, setActivo] = useState(false)
  const inactivar = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Callback ref: guarda el nodo para medir y lo reenvía al ref del consumidor.
  const fijarViewport = useCallback(
    (node: HTMLDivElement | null) => {
      vpRef.current = node
      if (viewportRef) viewportRef.current = node
    },
    [viewportRef],
  )

  const medir = useCallback(() => {
    const vp = vpRef.current
    if (!vp) return
    if (ejes !== 'x') {
      const barLen = vp.clientHeight - INSET
      const visible = vp.scrollHeight > vp.clientHeight + 1 && barLen > 0
      const thumb = visible
        ? Math.max(THUMB_MIN, (vp.clientHeight / vp.scrollHeight) * barLen)
        : 0
      const max = barLen - thumb
      const denom = vp.scrollHeight - vp.clientHeight
      setV({
        size: thumb,
        offset: denom > 0 ? (vp.scrollTop / denom) * max : 0,
        visible,
      })
    }
    if (ejes !== 'y') {
      const barLen = vp.clientWidth - INSET
      const visible = vp.scrollWidth > vp.clientWidth + 1 && barLen > 0
      const thumb = visible
        ? Math.max(THUMB_MIN, (vp.clientWidth / vp.scrollWidth) * barLen)
        : 0
      const max = barLen - thumb
      const denom = vp.scrollWidth - vp.clientWidth
      setH({
        size: thumb,
        offset: denom > 0 ? (vp.scrollLeft / denom) * max : 0,
        visible,
      })
    }
  }, [ejes])

  // Re-mide ante cambios de tamaño del viewport o de su contenido.
  useEffect(() => {
    medir()
    const vp = vpRef.current
    if (!vp || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir())
    ro.observe(vp)
    if (vp.firstElementChild) ro.observe(vp.firstElementChild)
    return () => ro.disconnect()
  }, [medir])

  const alScroll = useCallback(() => {
    medir()
    setActivo(true)
    if (inactivar.current) clearTimeout(inactivar.current)
    inactivar.current = setTimeout(() => setActivo(false), 900)
  }, [medir])

  // Arrastre del thumb (vertical u horizontal según eje).
  const arrastrar = (eje: 'v' | 'h') => (e: React.PointerEvent) => {
    e.preventDefault()
    const vp = vpRef.current
    if (!vp) return
    const thumb = eje === 'v' ? v : h
    const barLen =
      (eje === 'v' ? vp.clientHeight : vp.clientWidth) - INSET
    const max = barLen - thumb.size
    const denom =
      eje === 'v'
        ? vp.scrollHeight - vp.clientHeight
        : vp.scrollWidth - vp.clientWidth
    const ratio = max > 0 ? denom / max : 0
    const inicioPtr = eje === 'v' ? e.clientY : e.clientX
    const inicioScroll = eje === 'v' ? vp.scrollTop : vp.scrollLeft
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const mover = (ev: PointerEvent) => {
      const delta = (eje === 'v' ? ev.clientY : ev.clientX) - inicioPtr
      if (eje === 'v') vp.scrollTop = inicioScroll + delta * ratio
      else vp.scrollLeft = inicioScroll + delta * ratio
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  return (
    <div
      className={`eva-scroll-area ${className}`.trim()}
      data-activo={activo ? 'true' : undefined}
      style={style}
    >
      <div
        ref={fijarViewport}
        onScroll={alScroll}
        className={`eva-scroll-viewport ${viewportClassName}`.trim()}
        style={viewportStyle}
      >
        {children}
      </div>
      {v.visible && (
        <div className="eva-scroll-bar eva-scroll-bar--v">
          <div className="eva-scroll-track" />
          <div
            className="eva-scroll-thumb"
            style={{ top: v.offset, height: v.size }}
            onPointerDown={arrastrar('v')}
          />
        </div>
      )}
      {h.visible && (
        <div className="eva-scroll-bar eva-scroll-bar--h">
          <div className="eva-scroll-track" />
          <div
            className="eva-scroll-thumb"
            style={{ left: h.offset, width: h.size }}
            onPointerDown={arrastrar('h')}
          />
        </div>
      )}
    </div>
  )
}
