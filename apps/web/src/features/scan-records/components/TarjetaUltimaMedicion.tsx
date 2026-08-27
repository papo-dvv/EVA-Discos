import { useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { useScanRecordsPreview } from '../queries'
import type { AlcanceScanRecords, PreviewParams } from '../types'
import { calcularUltimaMedicionGlobal, calcularUltimaMedicionTren } from '../ultimaMedicion'
import { ModalDetalleUltimaMedicionTren } from './ModalDetalleUltimaMedicionTren'

// Siempre contra el histórico YA CONFIRMADO (mismo criterio que
// fleet-completeness/measurement-gap): un borrador de migración sin commit
// no tiene disc_id resuelto, así que nunca es "la última medición" real de
// un disco físico — ni siquiera en la pantalla de Migración (preview).
const ALCANCE_CONFIRMADOS: AlcanceScanRecords = {}
// Máximo permitido por PreviewQueryDto.pageSize — la muestra más grande
// posible en un solo pedido para derivar esto sin un endpoint dedicado.
const PAGE_SIZE_MUESTRA = 200

// Pseudo-tren "Reserva" (ver schema.prisma, Train.numero=0).
function etiquetaTren(tren: number): string {
  return tren === 0 ? 'Reserva' : `Tren ${tren}`
}

type Props = {
  // Reusa el mismo estado de selección de tren que ya maneja la página
  // (SidebarTrenes) como el "toggle General/Por tren" pedido — null = Todos.
  trenSeleccionado: number | null
}

// Card informativa (siempre visible, a diferencia de las alertas de
// fleet-completeness/measurement-gap): cambia de contenido según el modo de
// vista ya activo en la pantalla (Todos vs. tren puntual).
export function TarjetaUltimaMedicion({ trenSeleccionado }: Props) {
  const [detalleAbierto, setDetalleAbierto] = useState(false)

  const params: PreviewParams = {
    page: 1,
    pageSize: PAGE_SIZE_MUESTRA,
    vistaFecha: 'ultima',
    sortBy: 'fecha',
    sortDir: 'desc',
    ...(trenSeleccionado !== null ? { tren: trenSeleccionado } : {}),
  }
  const preview = useScanRecordsPreview(ALCANCE_CONFIRMADOS, params)

  if (preview.isLoading) {
    return (
      <GlassSurface fuerte className="rounded-glass p-4">
        <p className="font-body text-sm text-concreto">Cargando…</p>
      </GlassSurface>
    )
  }
  if (preview.isError) return null

  const rows = preview.data?.rows ?? []

  if (trenSeleccionado === null) {
    const resultado = calcularUltimaMedicionGlobal(rows, PAGE_SIZE_MUESTRA)
    return (
      <GlassSurface fuerte elevar className="eva-widget eva-widget--m rounded-glass p-4">
        <div className="eva-widget__cabecera">
          <span className="eva-widget__glifo">◷</span>
          <span>Última medición — toda la flota</span>
        </div>
        {!resultado ? (
          <p className="font-body text-sm text-concreto">Todavía no hay mediciones confirmadas.</p>
        ) : (
          <>
            <div className="eva-widget__valor font-data">{resultado.fecha}</div>
            <div className="eva-widget__pie font-body text-xs text-concreto">
              Encontrada en el tren(es):{' '}
              <span className="font-data text-concreto-oscuro">{resultado.trenes.join(', ')}</span>
            </div>
          </>
        )}
      </GlassSurface>
    )
  }

  const resultado = calcularUltimaMedicionTren(rows)

  return (
    <>
      <GlassSurface fuerte elevar className="eva-widget eva-widget--m rounded-glass p-4">
        <div className="eva-widget__cabecera">
          <span className="eva-widget__glifo">◷</span>
          <span>Última medición — {etiquetaTren(trenSeleccionado)}</span>
        </div>
        {!resultado ? (
          <p className="font-body text-sm text-concreto">Este tren todavía no tiene mediciones confirmadas.</p>
        ) : (
          <>
            <div className="eva-widget__valor font-data">{resultado.fecha}</div>
            <div className="eva-widget__pie flex flex-wrap items-center gap-2">
              <span className="font-body text-xs text-concreto">
                Coche <span className="font-data text-concreto-oscuro">{resultado.coche}</span> #
                <span className="font-data text-concreto-oscuro">{resultado.numeroCoche}</span>
              </span>
              <button
                type="button"
                onClick={() => setDetalleAbierto(true)}
                className="rounded-full border border-concreto/30 px-3 py-1 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/60"
              >
                Ver detalle
              </button>
            </div>
          </>
        )}
      </GlassSurface>

      {detalleAbierto && resultado && (
        <ModalDetalleUltimaMedicionTren
          tren={trenSeleccionado}
          resultado={resultado}
          onCerrar={() => setDetalleAbierto(false)}
        />
      )}
    </>
  )
}
