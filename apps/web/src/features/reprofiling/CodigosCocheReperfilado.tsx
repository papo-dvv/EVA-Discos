import { GlassSurface } from '../../components/GlassSurface'
import type { CodigosCoche, PosicionEsqueleto, TipoCoche } from '../new-measurement/types'

const TIPOS: TipoCoche[] = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2']

const rango = (inicio: number, fin: number, paso = 1) => {
  const valores: number[] = []
  for (let valor = inicio; valor <= fin; valor += paso) valores.push(valor)
  return valores
}

const OPCIONES: Record<TipoCoche, number[]> = {
  MA1: rango(101, 253, 4),
  MB1: rango(102, 254, 4),
  MB3: rango(501, 539),
  REM: rango(401, 439),
  MB2: rango(103, 255, 4),
  MA2: rango(104, 256, 4),
}

type Props = {
  trenNumero: number
  esqueleto: PosicionEsqueleto[]
  codigos: CodigosCoche | null
  deshabilitado?: boolean
  onGuardar: (codigos: CodigosCoche) => void
}

export function CodigosCocheReperfilado({
  trenNumero,
  esqueleto,
  codigos,
  deshabilitado = false,
  onGuardar,
}: Props) {
  const desdeEsqueleto = Object.fromEntries(TIPOS.map((tipo) => {
    const fila = esqueleto.find((item) => item.tipoCoche === tipo)
    return [tipo, fila?.numeroCoche ?? undefined]
  })) as CodigosCoche
  const automaticos: CodigosCoche = trenNumero >= 6
    ? {
        MA1: trenNumero * 4 + 77,
        MB1: trenNumero * 4 + 78,
        MB3: trenNumero + 495,
        REM: trenNumero + 395,
        MB2: trenNumero * 4 + 79,
        MA2: trenNumero * 4 + 80,
      }
    : desdeEsqueleto
  const actuales = { ...automaticos, ...desdeEsqueleto, ...(codigos ?? {}) }

  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-concreto-oscuro">
            Códigos de coches
          </h2>
          <p className="mt-1 text-xs text-concreto">
            Se completan según el tren. Puedes corregir cada código desde su lista antes de bloquear.
          </p>
        </div>
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => onGuardar(automaticos)}
          className="rounded-full border border-emerald-700/20 bg-emerald-700/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
        >
          Autocompletar según tren
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TIPOS.map((tipo) => (
          <label key={tipo} className="text-xs font-semibold text-concreto">
            {tipo}
            <select
              className="glass-field mt-1 block w-full px-3 py-2 font-data text-sm text-concreto-oscuro"
              value={actuales[tipo] ?? ''}
              disabled={deshabilitado}
              onChange={(event) =>
                onGuardar({ ...actuales, [tipo]: Number(event.target.value) })
              }
            >
              <option value="">Seleccionar</option>
              {OPCIONES[tipo].map((codigo) => (
                <option key={codigo} value={codigo}>{codigo}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </GlassSurface>
  )
}
