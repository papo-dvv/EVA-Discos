import { useEffect, useMemo, useRef, useState } from 'react'
import { GlassSurface } from './GlassSurface'

// Selector de fecha glass (styles.md §4/§9): reemplaza el <input type="date">
// nativo por un calendario propio — mes/año navegable, día seleccionado en
// verde institucional, hover suave. Sin librería de fechas: el proyecto no
// tiene ninguna instalada y el cálculo de grilla mensual con Date nativo es
// simple. Trabaja con fechas LOCALES (no UTC) para que el día elegido nunca
// se corra por husario horario.
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function aFechaLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function aISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// getDay() nativo: Domingo=0…Sábado=6. La grilla empieza en Lunes.
function offsetLunes(diaSemana: number): number {
  return (diaSemana + 6) % 7
}

// Grilla de 6 semanas (42 días) que cubre el mes visible completo, con los
// días de relleno de los meses adyacentes.
function construirGrilla(mesVisible: Date): Date[] {
  const primero = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1)
  const inicio = new Date(primero)
  inicio.setDate(primero.getDate() - offsetLunes(primero.getDay()))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    return d
  })
}

type Props = {
  label: string
  value: string // ISO 'YYYY-MM-DD' o '' (sin fecha)
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function GlassDatePicker({
  label,
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  className = '',
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const seleccionada = useMemo(() => (value ? aFechaLocal(value) : null), [value])
  const [mesVisible, setMesVisible] = useState<Date>(() => seleccionada ?? new Date())
  const contenedor = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!abierto) return
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  // Al abrir, el calendario arranca en el mes de la fecha elegida (o el mes
  // actual si no hay ninguna) — se fija en el propio handler de apertura, no
  // en un efecto, para no disparar un setState extra en cada render.
  function alternarAbierto() {
    if (!abierto) setMesVisible(seleccionada ?? new Date())
    setAbierto((a) => !a)
  }

  const grilla = useMemo(() => construirGrilla(mesVisible), [mesVisible])
  const hoy = useMemo(() => new Date(), [])

  function elegir(d: Date) {
    onChange(aISO(d))
    setAbierto(false)
  }

  const textoTrigger = seleccionada
    ? `${String(seleccionada.getDate()).padStart(2, '0')}/${String(seleccionada.getMonth() + 1).padStart(2, '0')}/${seleccionada.getFullYear()}`
    : placeholder

  return (
    <div ref={contenedor} className={`relative ${className}`.trim()}>
      <label className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={alternarAbierto}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-white/55 px-4 py-2.5 text-left font-body text-sm text-concreto-oscuro transition-colors hover:bg-white/70 disabled:opacity-50"
      >
        <span className={seleccionada ? 'font-data' : 'text-concreto'}>{textoTrigger}</span>
        <span aria-hidden className="text-concreto">
          ◔
        </span>
      </button>

      {abierto && (
        <GlassSurface
          fuerte
          className="absolute z-30 mt-2 w-[17rem] rounded-glass-sm p-4"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full font-body text-sm text-concreto-oscuro transition-colors hover:bg-white/60"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <p className="font-display text-sm font-semibold text-concreto-oscuro">
              {MESES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full font-body text-sm text-concreto-oscuro transition-colors hover:bg-white/60"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="font-body text-[0.7rem] font-semibold uppercase text-concreto">
                {d}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grilla.map((d, i) => {
              const delMesVisible = d.getMonth() === mesVisible.getMonth()
              const esSeleccionado = seleccionada !== null && mismoDia(d, seleccionada)
              const esHoy = mismoDia(d, hoy)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => elegir(d)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-data text-xs transition-colors ${
                    esSeleccionado
                      ? 'bg-verde-institucional font-semibold text-white'
                      : delMesVisible
                        ? 'text-concreto-oscuro hover:bg-verde-claro'
                        : 'text-concreto/40 hover:bg-white/50'
                  } ${esHoy && !esSeleccionado ? 'ring-1 ring-inset ring-verde-institucional/50' : ''}`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setAbierto(false)
              }}
              className="mt-3 w-full rounded-xl px-2.5 py-1.5 text-left font-body text-xs text-concreto transition-colors hover:bg-white/60"
            >
              Limpiar fecha
            </button>
          )}
        </GlassSurface>
      )}
    </div>
  )
}
