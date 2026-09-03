import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassSurface } from '../../../components/GlassSurface'
import { DetalleMesProyeccion } from './DetalleMesProyeccion'
import { GraficoBarrasPronostico } from './GraficoBarrasPronostico'
import { datosMensuales, type VistaBarras } from '../lib/pronosticoBarras'
import { useProyeccionDiscos, usePronostico } from '../queries'

const ANIO_INICIAL = 2026

function CardCritico({ total, cargando }: { total: number | undefined; cargando: boolean }) {
  return (
    <GlassSurface
      fuerte
      className="flex items-center gap-4 rounded-glass border-l-4 p-4"
      style={{ borderLeftColor: 'var(--color-estado-critico)' }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'color-mix(in srgb, var(--color-estado-critico) 15%, transparent)' }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--color-estado-critico)' }} aria-hidden />
      </span>
      <div>
        <p className="font-body text-xs font-semibold uppercase tracking-[0.08em] text-concreto">
          Discos en estado Crítico ahora
        </p>
        <p className="font-data text-2xl font-bold" style={{ color: 'var(--color-estado-critico)' }}>
          {cargando ? '…' : (total ?? 0)}
        </p>
      </div>
    </GlassSurface>
  )
}

// Pestaña "Gráfico de Barras" de Proyección — siempre fleet-wide (sin
// alcance por tren, ver Proyeccion.tsx: el toggle Global/Por tren vive solo
// en la pestaña Tabla). Combina el gráfico de barras Por año/Por mes que ya
// existía (GraficoBarrasPronostico) con el KPI de Crítico actual y, debajo,
// el detalle por mes expandible (solo visible en vista "Por mes").
export function ProyeccionGraficoBarras() {
  const [vistaBarras, setVistaBarras] = useState<VistaBarras>('mes')
  const [anioBarras, setAnioBarras] = useState(ANIO_INICIAL)

  const pronostico = usePronostico(undefined, 77)
  // pageSize=1: solo interesa el total, reutilizando /projection/discos tal
  // como ya lo hace TablaProyeccion, filtrando por el estado real actual.
  const criticos = useProyeccionDiscos({ page: 1, pageSize: 1, estado: ['CRITICO'] })

  return (
    <div className="mt-4 space-y-4">
      <CardCritico total={criticos.data?.total} cargando={criticos.isLoading} />

      <GlassSurface fuerte className="rounded-glass p-4">
        <GraficoBarrasPronostico
          meses={pronostico.data ?? []}
          cargando={pronostico.isLoading}
          vista={vistaBarras}
          onCambiarVista={setVistaBarras}
          anio={anioBarras}
          onCambiarAnio={setAnioBarras}
        />
      </GlassSurface>

      {vistaBarras === 'mes' && (
        <DetalleMesProyeccion meses={datosMensuales(pronostico.data ?? [], anioBarras)} />
      )}
    </div>
  )
}
