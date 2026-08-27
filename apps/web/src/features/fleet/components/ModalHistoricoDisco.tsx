import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { useFleetHistorico } from '../queries'
import type { FleetDiscoDetalle, FleetHistoricoPunto } from '../types'

type Props = {
  disco: FleetDiscoDetalle
  onCerrar: () => void
}

function formato(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : valor.toFixed(2)
}

export function ModalHistoricoDisco({ disco, onCerrar }: Props) {
  const historico = useFleetHistorico(disco.codigoDisco, disco.lado)

  return (
    <GlassModal
      titulo={`Disco ${disco.codigoDisco ?? 'sin código'} · ${disco.lado}`}
      onCerrar={onCerrar}
      ancho={820}
      altoMaximo="min(760px, calc(100dvh - 1.5rem))"
    >
      <ScrollArea className="min-h-0 flex-1" viewportClassName="min-h-0 flex-1">
        {historico.isLoading && <p className="py-8 text-center font-body text-sm text-concreto">Cargando histórico...</p>}
        {historico.isError && (
          <p role="alert" className="py-8 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar el histórico del disco.
          </p>
        )}
        {historico.data && (
          <div className="space-y-4 pr-2">
            {/* La pieza se abre primero como objeto técnico 3D; debajo se
                separan lectura actual, evolución y registro para no mezclar
                toda la información de mantenimiento en una sola vista. */}
            <div className="flex flex-col items-center gap-4 rounded-glass border border-concreto/15 bg-[radial-gradient(circle_at_50%_0%,rgba(63,169,95,0.18),transparent_58%)] p-4 sm:flex-row">
              <div
                aria-hidden
                className="h-28 w-28 shrink-0 rounded-full border-[10px] border-slate-700 shadow-[inset_10px_10px_14px_rgba(255,255,255,0.65),inset_-11px_-11px_16px_rgba(15,23,42,0.68),0_16px_24px_rgba(15,92,57,0.25)]"
                style={{
                  background: 'repeating-conic-gradient(#dbe4dc 0 7deg, #637267 7deg 12deg)',
                  transform: 'perspective(260px) rotateX(52deg) rotateZ(-18deg)',
                }}
              >
                <span className="m-auto block h-8 w-8 rounded-full bg-slate-200 shadow-[inset_4px_4px_6px_rgba(71,85,105,0.55),inset_-3px_-3px_5px_white]" />
              </div>
              <div className="text-center sm:text-left">
                <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-verde-oscuro">
                  Vista 3D del disco
                </p>
                <p className="mt-1 font-body text-sm text-concreto">
                  Seleccionaste el lado {disco.lado}. Revisa primero su condición actual y luego su evolución.
                </p>
              </div>
            </div>

            <section aria-label="Lectura actual">
              <p className="mb-2 font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">
                1. Lectura actual
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <DatoActual etiqueta="Rd actual" valor={historico.data.actual.rd} />
                <DatoActual etiqueta="H actual" valor={historico.data.actual.h} />
                <DatoActual etiqueta="T actual" valor={historico.data.actual.t} />
              </div>
            </section>

            {historico.data.historico.length === 0 ? (
              <div className="rounded-glass border border-concreto/15 bg-white/35 px-4 py-8 text-center font-body text-sm text-concreto">
                Este disco no tiene mediciones confirmadas.
              </div>
            ) : (
              <>
                <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">
                  2. Registro
                </p>
                <TablaHistorico puntos={historico.data.historico} />
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </GlassModal>
  )
}

function DatoActual({ etiqueta, valor }: { etiqueta: string; valor: number | null | undefined }) {
  return (
    <div className="rounded-glass border border-concreto/15 bg-white/40 px-4 py-3">
      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">{etiqueta}</p>
      <p className="mt-1 font-data text-2xl font-semibold text-concreto-oscuro">{formato(valor)}</p>
    </div>
  )
}

function TablaHistorico({ puntos }: { puntos: FleetHistoricoPunto[] }) {
  return (
    <div className="overflow-hidden rounded-glass border border-concreto/15 bg-white/35">
      <table className="w-full border-collapse text-left font-body text-sm">
        <thead>
          <tr className="border-b border-concreto/15 bg-[color:var(--color-arena-suave)]">
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-concreto">Fecha</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">Rd</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">H</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">T</th>
          </tr>
        </thead>
        <tbody>
          {puntos.map((punto, idx) => (
            <tr key={`${punto.fecha}-${idx}`} className="border-b border-concreto/10 last:border-b-0">
              <td className="px-3 py-2 text-concreto-oscuro">{punto.fecha ?? '—'}</td>
              <td className="px-3 py-2 text-right font-data text-concreto-oscuro">{formato(punto.rd)}</td>
              <td className="px-3 py-2 text-right font-data text-concreto-oscuro">{formato(punto.h)}</td>
              <td className="px-3 py-2 text-right font-data text-concreto-oscuro">{formato(punto.t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
