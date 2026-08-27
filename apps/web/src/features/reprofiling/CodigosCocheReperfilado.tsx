import { WandSparkles } from 'lucide-react'
import { GlassSurface } from '../../components/GlassSurface'
import type { CodigosCoche, PosicionEsqueleto, TipoCoche } from '../new-measurement/types'

const TIPOS: TipoCoche[] = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2']

function sugeridos(tren: number): CodigosCoche {
  return {
    MA1: tren * 4 + 77, MB1: tren * 4 + 78, MB3: tren + 495,
    REM: tren + 395, MB2: tren * 4 + 79, MA2: tren * 4 + 80,
  }
}

export function CodigosCocheReperfilado({ trenNumero, esqueleto, codigos, deshabilitado = false, onGuardar }: {
  trenNumero: number
  esqueleto: PosicionEsqueleto[]
  codigos: CodigosCoche | null
  deshabilitado?: boolean
  onGuardar: (codigos: CodigosCoche) => void
}) {
  const desdeFicha = Object.fromEntries(TIPOS.map((tipo) => [tipo, esqueleto.find((fila) => fila.tipoCoche === tipo)?.numeroCoche])) as CodigosCoche
  const actuales = { ...sugeridos(trenNumero), ...desdeFicha, ...(codigos ?? {}) }
  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-display text-base font-semibold text-concreto-oscuro">Códigos de coches</h2><p className="mt-1 text-xs text-concreto">La IA propone los códigos que reconoce; podés reemplazar cualquier valor desde esta lista antes de bloquear.</p></div>
        <button type="button" disabled={deshabilitado} onClick={() => onGuardar(sugeridos(trenNumero))} className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-50"><WandSparkles size={14} />Completar sugeridos</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TIPOS.map((tipo) => <label key={tipo} className="text-xs font-semibold text-concreto">{tipo}<input type="number" min="1" disabled={deshabilitado} value={actuales[tipo] ?? ''} onChange={(e) => onGuardar({ ...actuales, [tipo]: e.target.value === '' ? undefined : Number(e.target.value) })} className="glass-field mt-1 block w-full px-3 py-2 font-data text-sm text-concreto-oscuro" /></label>)}
      </div>
    </GlassSurface>
  )
}
