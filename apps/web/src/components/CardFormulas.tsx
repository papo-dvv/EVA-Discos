import { Lock } from 'lucide-react'
import { GlassSurface } from './GlassSurface'

// Card estática de referencia (styles.md §2/§4.1) — NUNCA editable, ningún
// input: solo texto explicando las fórmulas/reglas ya definidas en el motor
// de reglas real (BrakeDiscRulesEngine/WearRateCalculatorService — ver
// backend, única fuente de verdad). Se ubica siempre ARRIBA de la card de
// Parámetros (mismos números que acá pueden ajustarse ahí abajo).
type Variante = 'mediciones' | 'tasaDesgaste' | 'proyeccion'

export function CardFormulas({ variante }: { variante: Variante }) {
  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-concreto-oscuro">Fórmulas</h3>
        <span className="flex items-center gap-1 rounded-full bg-white/50 px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-concreto">
          <Lock size={11} strokeWidth={2.5} />
          Solo referencia
        </span>
      </div>

      {variante === 'mediciones' && <ContenidoMediciones />}
      {variante === 'tasaDesgaste' && <ContenidoTasaDesgaste />}
      {variante === 'proyeccion' && <ContenidoProyeccion />}
    </GlassSurface>
  )
}

function ContenidoMediciones() {
  return (
    <div className="space-y-2.5 font-body text-xs text-concreto-oscuro">
      <p>
        <span className="font-data font-semibold">Rd = T − H</span> — profundidad remanente del disco.
      </p>
      <ul className="list-disc space-y-1 pl-4 text-concreto">
        <li>
          <span className="font-data text-concreto-oscuro">OK</span> — Rd por encima del umbral de OK.
        </li>
        <li>
          <span className="font-data text-concreto-oscuro">Seguimiento</span> — Rd entre el umbral de
          Cambio y el de OK.
        </li>
        <li>
          <span className="font-data text-concreto-oscuro">Cambio</span> — Rd entre el umbral crítico y
          el de Seguimiento.
        </li>
        <li>
          <span className="font-data text-concreto-oscuro">Crítico</span> — Rd en o por debajo del
          umbral crítico (manda siempre, incluso sobre Reperfilado).
        </li>
        <li>
          <span className="font-data text-concreto-oscuro">Reperfilado</span> — H alcanza el umbral de
          reperfilado y, tras restar el descuento de reperfilado a Rd, el resultado sigue sin caer en
          zona de Cambio: H manda sobre Rd, reemplaza a OK/Seguimiento en el estado.
        </li>
      </ul>
      <p className="text-concreto">
        Los umbrales y descuentos exactos usados hoy están abajo, en Parámetros.
      </p>
    </div>
  )
}

function ContenidoTasaDesgaste() {
  return (
    <div className="space-y-2.5 font-body text-xs text-concreto-oscuro">
      <p>
        <span className="font-data font-semibold">Tasa = (Rd₁ − Rd₂) / (Km₂ − Km₁)</span> — desgaste
        de Rd por kilómetro recorrido, entre dos mediciones consecutivas del mismo disco.
      </p>
      <p>
        <span className="font-data font-semibold">Tasa mensual = Tasa × Km mensual</span> — extrapola
        la tasa a un mes típico de uso (parámetro Km mensual, ver Parámetros).
      </p>
      <p className="text-concreto">Un par se marca inválido (tasa no se calcula) cuando:</p>
      <ul className="list-disc space-y-1 pl-4 text-concreto">
        <li>Rd de la fecha 2 es mayor que el de la fecha 1 (no hubo desgaste real).</li>
        <li>El motivo de la fecha 2 es Reperfilado, un Cambio de disco, o un giro de pares montados.</li>
        <li>El kilometraje de la fecha 2 es menor o igual al de la fecha 1.</li>
      </ul>
    </div>
  )
}

function ContenidoProyeccion() {
  return (
    <div className="space-y-2.5 font-body text-xs text-concreto-oscuro">
      <p>
        <span className="font-data font-semibold">Meses hasta reperfilado = (H umbral reperfilado − H) / tasa mensual</span>{' '}
        — tasa mensual = tasa promedio de desgaste del tipo de coche del disco (ver "Promedio por tipo
        de coche" arriba).
      </p>
      <p className="text-concreto">
        Cada reperfilado viable resetea <span className="font-data text-concreto-oscuro">H</span> a{' '}
        <span className="font-data text-concreto-oscuro">0</span> y descuenta el descuento de
        reperfilado de <span className="font-data text-concreto-oscuro">T</span> (nunca de Rd
        directamente) —{' '}
        <span className="font-data font-semibold">Rd = T − H</span> se recalcula igual en todo
        momento, incluidos los ciclos siguientes.
      </p>
      <p className="text-concreto">
        Si Rd cae al o por debajo del umbral de cambio en cualquier punto (antes o después de aplicar
        el descuento), se proyecta un Cambio en vez de otro reperfilado. Al quinto ciclo de reperfilado
        sin llegar a esa condición, la proyección se corta ahí (badge "5+ ciclos") y pide revisión
        manual.
      </p>
    </div>
  )
}
