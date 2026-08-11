import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSurface } from '../../../components/GlassSurface'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { useReferenciaFicha } from '../queries'
import type { TipoReferencia } from '../types'
import { TablaFichaEspejo } from './TablaFichaEspejo'

type Props = {
  fichaId: string
  trenNumero: number
  onCerrar: () => void
}

// Punto 6 del enunciado: comparativa histórica de solo lectura. "Última
// Ficha" arranca deshabilitada mientras no se sepa si el tren tiene alguna
// ficha CONFIRMADA previa — se decide con su propia query (independiente de
// cuál pestaña esté activa), así el toggle refleja la disponibilidad real
// desde el primer render sin esperar a que el usuario la elija para recién
// enterarse de que no hay datos.
export function ModalMedicionAnterior({ fichaId, trenNumero, onCerrar }: Props) {
  const [tipo, setTipo] = useState<TipoReferencia>('ultima_medicion')
  const disponibilidadFicha = useReferenciaFicha(trenNumero, 'ultima_ficha')
  const activa = useReferenciaFicha(trenNumero, tipo)

  const ultimaFichaNoDisponible = disponibilidadFicha.data?.disponible === false

  return (
    <GlassModal titulo={`Medición anterior — Tren ${trenNumero}`} onCerrar={onCerrar} ancho={960}>
      <SegmentedControl
        ariaLabel="Tipo de referencia"
        opciones={[
          { valor: 'ultima_medicion', etiqueta: 'Última Medición' },
          {
            valor: 'ultima_ficha',
            etiqueta: 'Última Ficha',
            deshabilitada: ultimaFichaNoDisponible,
            tooltip: ultimaFichaNoDisponible ? 'No hay fichas previas de este tren' : undefined,
          },
        ]}
        valor={tipo}
        onCambiar={setTipo}
        className="mt-1"
      />

      <div className="mt-4">
        {activa.isLoading ? (
          <p className="font-body text-sm text-concreto">Cargando…</p>
        ) : activa.isError ? (
          <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar la comparativa.
          </p>
        ) : !activa.data || activa.data.disponible === false ? (
          <p className="font-body text-sm text-concreto">
            {tipo === 'ultima_medicion'
              ? 'Este tren todavía no tiene mediciones confirmadas.'
              : 'Este tren todavía no tiene fichas confirmadas.'}
          </p>
        ) : (
          <>
            <GlassSurface fuerte className="grid grid-cols-2 gap-3 rounded-glass p-4 sm:grid-cols-4">
              <CampoCard etiqueta="Tren" valor={String(activa.data.tren)} />
              <CampoCard
                etiqueta="Fecha"
                valor={'fecha' in activa.data ? activa.data.fecha : activa.data.fechaFicha}
              />
              <CampoCard etiqueta="Kilometraje" valor={`${activa.data.kilometraje} km`} />
              <CampoCard etiqueta="Responsable" valor={activa.data.responsable || '—'} />
            </GlassSurface>

            <TablaFichaEspejo
              fichaId={fichaId}
              esqueleto={activa.data.esqueleto}
              rows={activa.data.rows}
              deshabilitada
            />
          </>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <GlassButton type="button" variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
          Cerrar
        </GlassButton>
      </div>
    </GlassModal>
  )
}

function CampoCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">{etiqueta}</p>
      <p className="font-data text-sm text-concreto-oscuro">{valor}</p>
    </div>
  )
}
