import { useState } from 'react'
import { TarjetaAlertaFuerte } from '../../../components/TarjetaAlertaFuerte'
import { useFleetCompletenessSummary } from '../queries'
import { ModalDetalleFlota } from './ModalDetalleFlota'

// Card de alerta de sistema (no depende de ningún filtro/fileId de la
// pantalla): solo se muestra si el catálogo de flota esperada tiene AL MENOS
// un disco sin ninguna medición confirmada — en el caso feliz (flota
// completa) no ocupa espacio en pantalla.
export function TarjetaDatosFaltantes() {
  const summary = useFleetCompletenessSummary()
  const [detalleAbierto, setDetalleAbierto] = useState(false)

  if (!summary.data || summary.data.total.discosFaltantes === 0) return null

  const trenesConFaltantes = summary.data.porTren.filter((t) => t.discosFaltantes > 0)

  return (
    <>
      <TarjetaAlertaFuerte
        tono="critico"
        glifo="⚠"
        titulo="Datos faltantes"
        descripcion={
          <>
            <span className="font-data">{summary.data.total.discosFaltantes}</span> disco(s) del
            catálogo esperado, en <span className="font-data">{trenesConFaltantes.length}</span>{' '}
            tren(es), nunca tuvieron ninguna medición confirmada.
          </>
        }
        acciones={
          <button
            type="button"
            onClick={() => setDetalleAbierto(true)}
            className="rounded-full border border-white/50 bg-white/15 px-4 py-1.5 font-body text-xs font-semibold text-white transition-colors hover:bg-white/25"
          >
            Ver detalle
          </button>
        }
      />

      {detalleAbierto && (
        <ModalDetalleFlota
          trenes={trenesConFaltantes}
          trenInicial={trenesConFaltantes[0].tren}
          onCerrar={() => setDetalleAbierto(false)}
        />
      )}
    </>
  )
}
