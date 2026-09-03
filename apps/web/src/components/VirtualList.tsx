import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'
import { ScrollArea } from './ScrollArea'

// Lista virtualizada genérica y reutilizable (sidebar, dropdowns de filtro,
// cualquier lista larga). Virtualiza filas con @tanstack/react-virtual y usa
// <ScrollArea> para el scrollbar propio estilizado (styles.md §6). Solo se
// montan en el DOM las filas visibles.
type VirtualListProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  // Alto estimado de cada fila (px). Con filas de alto variable, measureElement
  // corrige la medida real tras el primer render.
  estimateSize?: number
  overscan?: number
  getKey?: (item: T, index: number) => string | number
  // Alto del viewport visible (la ventana que se virtualiza).
  alto?: number | string
  className?: string
  viewportClassName?: string
  ariaLabel?: string
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 40,
  overscan = 8,
  getKey,
  alto = 320,
  className = '',
  viewportClassName = '',
  ariaLabel,
}: VirtualListProps<T>) {
  const vpRef = useRef<HTMLDivElement | null>(null)

  // TanStack Virtual administra su propia memoización; React Compiler omite este hook de forma segura.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => vpRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  const filas = virtualizer.getVirtualItems()

  return (
    <ScrollArea
      className={className}
      viewportRef={vpRef}
      viewportClassName={viewportClassName}
      viewportStyle={{ height: alto }}
    >
      <div
        role="list"
        aria-label={ariaLabel}
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {filas.map((fila) => {
          const item = items[fila.index]
          return (
            <div
              key={getKey ? getKey(item, fila.index) : fila.key}
              role="listitem"
              data-index={fila.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${fila.start}px)`,
              }}
            >
              {renderItem(item, fila.index)}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
