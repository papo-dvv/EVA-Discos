import { Check, MousePointerClick } from 'lucide-react'
import { useState } from 'react'
import type { EstadoDisco } from '../../scan-records/types'
import type { FleetCocheDetalle, FleetDiscoDetalle } from '../../fleet/types'

const COLOR_ESTADO: Record<EstadoDisco, string> = {
  OK: '#15a36d',
  SEGUIMIENTO: '#e6a82d',
  CAMBIO: '#ee7b32',
  CRITICO: '#dc4055',
  REPERFILADO: '#7656d6',
}

function DiscoVisual({ disco, lado, vista }: { disco?: FleetDiscoDetalle; lado: 'Izq.' | 'Der.'; vista: '2d' | '3d' }) {
  const color = disco?.estadoCalculado ? COLOR_ESTADO[disco.estadoCalculado] : '#94a3b8'
  return (
    <div className="flex min-w-20 flex-col items-center gap-1">
      <div
        className={`${vista === '3d' ? 'relative h-16 w-8 rounded-[50%] border border-white/80 shadow-[7px_9px_15px_rgba(15,23,42,0.22),inset_-5px_-4px_8px_rgba(0,0,0,0.28),inset_4px_3px_7px_rgba(255,255,255,0.5)]' : 'relative h-14 w-14 rounded-full border-4 border-slate-200 shadow-md'} eva-disco-anim`}
        style={{ background: vista === '3d' ? `linear-gradient(105deg, ${color}, color-mix(in_srgb, ${color} 48%, #172033))` : `radial-gradient(circle, #0f172a 0 22%, ${color} 24% 43%, #e2e8f0 45% 58%, ${color} 60% 66%, #334155 68%)` }}
      >
        {vista === '3d' && <><span className="absolute left-1/2 top-1/2 h-5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-slate-800/75 shadow-inner" /><span className="absolute inset-y-1.5 left-1 w-1 rounded-full bg-white/35" /></>}
      </div>
      <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">{lado}</span>
      <span className="max-w-24 truncate font-data text-[0.62rem] text-slate-700">{disco?.codigoDisco ?? 'Sin código'}</span>
    </div>
  )
}

export function BogieEjeVisual({ coche, asignados, onClickEje }: {
  coche: FleetCocheDetalle
  asignados: Set<string>
  onClickEje: (bogieCodigo: string, ejeNumero: number) => void
}) {
  const [vista, setVista] = useState<'2d' | '3d'>('3d')
  return (
    <div className="flex flex-col gap-4">
      {coche.bogies.map((bogie, indice) => {
        const seleccionados = bogie.ejes.filter((eje) => asignados.has(`${bogie.bogie}:${eje.eje}`)).length
        return (
          <section key={bogie.bogie} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-emerald-50/50 shadow-[0_14px_32px_rgba(15,23,42,0.09),inset_0_1px_0_white]">
            <header className="flex items-center justify-between border-b border-slate-200/70 bg-white/65 px-4 py-3">
              <div>
                <p className="font-display text-sm font-bold text-slate-800">Bogie {bogie.bogie}</p>
                <p className="text-[0.68rem] text-slate-500">Conjunto {indice + 1} · {bogie.ejes.length} ejes</p>
              </div>
              <div className="flex items-center gap-2">
                {seleccionados > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-bold text-emerald-700">{seleccionados} asignado(s)</span>}
                <div className="flex rounded-full bg-slate-800 p-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white">
                  {(['3d', '2d'] as const).map((opcion) => <button key={opcion} type="button" aria-pressed={vista === opcion} onClick={() => setVista(opcion)} className={`rounded-full px-2 py-1 transition ${vista === opcion ? 'bg-white text-slate-800' : 'text-slate-300'}`}>{opcion}</button>)}
                </div>
              </div>
            </header>

            <div className="flex flex-col gap-3 p-3 sm:p-4">
              {bogie.ejes.map((eje) => {
                const key = `${bogie.bogie}:${eje.eje}`
                const asignado = asignados.has(key)
                const izquierdo = eje.discos.find((disco) => disco.lado === 'izquierdo')
                const derecho = eje.discos.find((disco) => disco.lado === 'derecho')
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onClickEje(bogie.bogie, eje.eje)}
                    aria-pressed={asignado}
                    className={`group relative grid min-h-32 w-full grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 sm:grid-cols-[95px_1fr_115px] ${asignado ? 'border-emerald-500 bg-emerald-50/90 shadow-[0_10px_24px_rgba(16,163,111,0.17)] ring-2 ring-emerald-500/15' : 'border-slate-200 bg-white/85 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg'}`}
                  >
                    <div className="hidden sm:block">
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400">Posición</p>
                      <p className="mt-1 font-display text-lg font-bold text-slate-800">Eje {eje.eje}</p>
                      <p className="mt-0.5 text-[0.68rem] text-slate-500">{bogie.bogie}</p>
                    </div>
                    <div className="flex min-w-0 items-center justify-center gap-1 py-2 [perspective:700px]">
                      <DiscoVisual disco={izquierdo} lado="Izq." vista={vista} />
                      <div className={`relative h-6 min-w-14 flex-1 max-w-40 rounded-md bg-gradient-to-b from-slate-300 via-slate-600 to-slate-900 shadow-[0_9px_12px_rgba(15,23,42,0.3)] ${vista === '3d' ? '-skew-y-2' : ''}`}>
                        <span className="absolute inset-x-3 top-1 h-1 rounded-full bg-white/30" />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-slate-950 px-2 py-1 text-[0.58rem] font-bold text-white">EJE {eje.eje}</span>
                      </div>
                      <DiscoVisual disco={derecho} lado="Der." vista={vista} />
                    </div>
                    <div className={`flex items-center justify-end gap-2 text-xs font-semibold ${asignado ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {asignado ? <Check size={18} className="rounded-full bg-emerald-600 p-0.5 text-white" /> : <MousePointerClick size={17} />}
                      <span>{asignado ? 'Asignado' : 'Asignar'}</span>
                    </div>
                    {asignado && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-emerald-500" />}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
