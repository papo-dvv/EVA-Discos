import { Check, MousePointerClick } from 'lucide-react'
import type { EstadoDisco } from '../../scan-records/types'
import type { FleetCocheDetalle } from '../../fleet/types'

const COLOR_ESTADO: Record<EstadoDisco, string> = {
  OK: '#15a36d',
  SEGUIMIENTO: '#e6a82d',
  CAMBIO: '#ee7b32',
  CRITICO: '#dc4055',
  REPERFILADO: '#7656d6',
}

export function BogieEjeVisual({ coche, asignados, onClickEje }: {
  coche: FleetCocheDetalle
  asignados: Set<string>
  onClickEje: (bogieCodigo: string, ejeNumero: number) => void
}) {
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
              </div>
            </header>

            <div className="flex flex-col gap-3 p-3 sm:p-4">
              {bogie.ejes.map((eje) => {
                const key = `${bogie.bogie}:${eje.eje}`
                const asignado = asignados.has(key)
                const izquierdo = eje.discos.find((disco) => disco.lado === 'izquierdo')
                const derecho = eje.discos.find((disco) => disco.lado === 'derecho')
                const colorIzq = izquierdo?.estadoCalculado ? COLOR_ESTADO[izquierdo.estadoCalculado] : '#94a3b8'
                const colorDer = derecho?.estadoCalculado ? COLOR_ESTADO[derecho.estadoCalculado] : '#94a3b8'
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onClickEje(bogie.bogie, eje.eje)}
                    aria-pressed={asignado}
                    className={`group relative grid min-h-32 w-full grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 sm:grid-cols-[95px_minmax(19rem,1fr)_115px] ${asignado ? 'border-emerald-500 bg-emerald-50/90 shadow-[0_10px_24px_rgba(16,163,111,0.17)] ring-2 ring-emerald-500/15' : 'border-slate-200 bg-white/85 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg'}`}
                  >
                    <div className="hidden sm:block">
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400">Posición</p>
                      <p className="mt-1 font-display text-lg font-bold text-slate-800">Eje {eje.eje}</p>
                      <p className="mt-0.5 text-[0.68rem] text-slate-500">{bogie.bogie}</p>
                    </div>
                    <div className="min-w-0 py-3">
                      <div className="relative mx-auto flex h-[5.7rem] w-full min-w-56 max-w-[26rem] items-center justify-center">
                        <span className="absolute inset-x-0 h-3 rounded-full bg-gradient-to-b from-slate-300 via-slate-500 to-slate-700 shadow-[0_3px_7px_rgba(15,23,42,0.26)]" />
                        <span className="absolute inset-x-3 top-[calc(50%-0.25rem)] h-px rounded-full bg-white/55" />
                        <span className="relative z-10 grid h-[4.45rem] w-[4.45rem] place-items-center rounded-full border-4 border-white shadow-[0_8px_16px_rgba(15,23,42,0.22)]" style={{ background: `conic-gradient(${colorIzq} 0deg 180deg, ${colorDer} 180deg 360deg)` }}>
                          <span className="grid h-8 w-8 place-items-center rounded-full border-[3px] border-slate-100 bg-slate-700 shadow-inner"><span className="h-3 w-3 rounded-full border-2 border-slate-400 bg-slate-950" /></span>
                        </span>
                        <span className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 translate-y-[3.1rem] whitespace-nowrap rounded-full bg-slate-950 px-3 py-1 text-[0.62rem] font-bold text-white shadow-md">EJE {eje.eje}</span>
                      </div>
                      <div className="mx-auto mt-1 flex w-full max-w-[26rem] justify-between gap-3 font-data text-[0.62rem] text-slate-600"><span className="min-w-0 truncate">IZQ. {izquierdo?.codigoDisco ?? 'Sin código'}</span><span className="min-w-0 truncate text-right">DER. {derecho?.codigoDisco ?? 'Sin código'}</span></div>
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
