import { useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { ClasificarDiscosProyeccion } from './ClasificarDiscosProyeccion'
import { ResumenAnalisisProyeccion } from './ResumenAnalisisProyeccion'
import { TrenesCriticosProyeccion } from './TrenesCriticosProyeccion'

type SubTab = 'analisis' | 'trenes-criticos' | 'clasificar-discos'
const SUBTABS: { valor: SubTab; etiqueta: string }[] = [
  { valor: 'analisis', etiqueta: 'Análisis' },
  { valor: 'trenes-criticos', etiqueta: 'Trenes Críticos' },
  { valor: 'clasificar-discos', etiqueta: 'Clasificar Discos' },
]

// Bloque bajo el gráfico de barras + detalle mensual (ProyeccionGraficoBarras)
// — inspirado en el módulo de Análisis de EVA-Aldy, adaptado al modelo de
// EVA (5 estados de disco, discos individuales, sin reprogramación). Los 3
// subtabs son siempre fleet-wide, igual que el gráfico de arriba.
export function AnalisisProyeccion() {
  const [subtab, setSubtab] = useState<SubTab>('analisis')

  return (
    <div className="mt-4">
      <GlassSurface fuerte className="rounded-glass p-4">
        <SegmentedControl
          ariaLabel="Vista de Análisis"
          opciones={SUBTABS}
          valor={subtab}
          onCambiar={(v) => setSubtab(v)}
        />
      </GlassSurface>

      <div className="mt-4">
        {subtab === 'analisis' && <ResumenAnalisisProyeccion />}
        {subtab === 'trenes-criticos' && <TrenesCriticosProyeccion />}
        {subtab === 'clasificar-discos' && <ClasificarDiscosProyeccion />}
      </div>
    </div>
  )
}
