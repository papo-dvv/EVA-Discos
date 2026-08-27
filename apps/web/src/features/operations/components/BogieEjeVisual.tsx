import type { FleetCocheDetalle } from '../../fleet/types'

// Preview del coche seleccionado: 1 caja por bogie real (código real, no
// "Bogie 1/2" hardcodeado), con sus ejes reales apilados. Por eje se dibuja
// una "rueda-disco-rueda" simple con <div>s (mismo criterio que el gráfico
// de Cambio de Par Montado de EVA-Aldy, que tampoco usa SVG) — sin asignar
// queda atenuado, asignado se resalta en verde institucional. El clic en el
// óvalo del disco NO abre nada acá: solo avisa al padre qué slot tocaron,
// que se encarga de resaltar/scrollear al dropdown correspondiente (decisión
// confirmada con el usuario, ver plan de Operaciones).
export function BogieEjeVisual({
  coche,
  asignados,
  onClickEje,
}: {
  coche: FleetCocheDetalle
  asignados: Set<string>
  onClickEje: (bogieCodigo: string, ejeNumero: number) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {coche.bogies.map((bogie) => {
        const total = bogie.ejes.length
        const completos = bogie.ejes.filter((eje) => asignados.has(`${bogie.bogie}:${eje.eje}`)).length
        return (
          <div key={bogie.bogie} className="rounded-2xl border border-concreto/15 bg-white/45 p-3">
            <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
              Bogie {bogie.bogie}
            </p>
            <div className="space-y-3">
              {bogie.ejes.map((eje) => {
                const key = `${bogie.bogie}:${eje.eje}`
                const asignado = asignados.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onClickEje(bogie.bogie, eje.eje)}
                    className="flex w-full items-center justify-center gap-1.5"
                    title={`Bogie ${bogie.bogie} · Eje ${eje.eje}`}
                  >
                    <span className="h-6 w-6 rounded-full border-2 border-concreto-oscuro/70 bg-[color:var(--color-arena-suave)]" />
                    <span
                      className={`flex h-6 w-14 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white transition-colors ${
                        asignado ? 'bg-verde-institucional' : 'bg-concreto/40 opacity-40'
                      }`}
                    >
                      Eje {eje.eje}
                    </span>
                    <span className="h-6 w-6 rounded-full border-2 border-concreto-oscuro/70 bg-[color:var(--color-arena-suave)]" />
                  </button>
                )
              })}
            </div>
            <p
              className={`mt-3 rounded-full px-2 py-1 text-center font-body text-[0.65rem] font-semibold ${
                completos === total ? 'bg-verde-institucional/15 text-verde-institucional' : 'bg-amber-500/15 text-amber-700'
              }`}
            >
              {completos === total ? 'Completo' : `${total - completos} eje(s) sin asignar`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
