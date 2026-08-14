import { useState } from 'react'
import { BotonVolverInicio } from '../../components/BotonVolverInicio'
import { GlassField } from '../../components/GlassField'
import { GlassSurface } from '../../components/GlassSurface'
import { Marca } from '../../components/Marca'
import { PantallaFondo } from '../../components/PantallaFondo'
import { Switch } from '../../components/Switch'
import { FondoTuercas } from './components/FondoTuercas'
import { GloboComentario, GloboEstado } from './components/Globos'
import './dev-componentes.css'

// RUTA TEMPORAL DE DESARROLLO — eliminar tras periodo de pruebas de UI.
// No está enlazada desde el nav principal ni desde Inicio a propósito: solo
// se llega escribiendo /dev/componentes en la URL, estando logueado. Sirve
// para comparar en vivo variantes de fondo animado y el tratamiento Liquid
// Glass en "globos" de comentario/estado antes de aprobarlas para el resto de
// la app — ver styles.md antes de tocar cualquiera de estos estilos. Nada de
// lo que hay en esta pantalla se aplicó a ninguna pantalla real todavía.

export function DevComponentes() {
  const [tuercasActivo, setTuercasActivo] = useState(true)
  const [semilla, setSemilla] = useState(7)
  const [auraActivo, setAuraActivo] = useState(true)

  return (
    <PantallaFondo className="px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <GlassSurface className="sticky top-4 z-10 flex items-center justify-between rounded-glass px-5 py-3">
          <Marca tono="oscuro" tamano="condensado" />
          <BotonVolverInicio />
        </GlassSurface>

        <header className="mt-8">
          <span className="glass-chip inline-flex text-verde-oscuro">Vista temporal de desarrollo</span>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-concreto-oscuro sm:text-5xl">
            Muestra de componentes — vista temporal de desarrollo
          </h1>
          <p className="mt-3 max-w-2xl font-body text-sm text-concreto">
            No forma parte de la navegación de la app — se eliminará tras el periodo de pruebas de UI. Sirve para
            comparar en vivo dos variantes de fondo animado y unos globos con tratamiento Liquid Glass antes de
            decidir si se incorporan al sistema de diseño (styles.md).
          </p>
        </header>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-concreto-oscuro">Fondo animado — dos variantes</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {/* Variante A: tuercas cayendo ("meteoritos") */}
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <Switch checked={tuercasActivo} onChange={setTuercasActivo} label='Tuercas cayendo ("meteoritos")' />
                <div className="flex items-end gap-2">
                  <GlassField
                    label="Semilla"
                    type="number"
                    value={semilla}
                    onChange={(e) => setSemilla(Number(e.target.value) || 0)}
                    contenedorClassName="w-24"
                    className="py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setSemilla(Math.floor(Math.random() * 100000))}
                    className="glass-surface glass-button-secondary px-3 py-2 font-body text-xs text-concreto-oscuro"
                  >
                    🎲 Nueva
                  </button>
                </div>
              </div>
              {tuercasActivo ? (
                <FondoTuercas semilla={semilla} className="relative h-72 overflow-hidden rounded-glass" />
              ) : (
                <div className="bg-cuadricula flex h-72 items-center justify-center rounded-glass bg-arena-suave">
                  <p className="font-body text-xs text-concreto">Desactivado — .bg-cuadricula actual, sin animación</p>
                </div>
              )}
              <p className="mt-2 font-body text-xs text-concreto">
                Misma semilla = mismo arreglo (reproducible para debug). Tamaño, opacidad y velocidad salen de un PRNG
                por instancia, no de pasos fijos — y la cuadrícula de fondo suma una capa fina extra para que los
                tramos sin tuerca no se sientan vacíos.
              </p>
            </div>

            {/* Variante B: fondo reactivo (.bg-aura animado) */}
            <div>
              <div className="mb-3 flex items-end">
                <Switch checked={auraActivo} onChange={setAuraActivo} label="Fondo reactivo (aura animada)" />
              </div>
              <div
                className={`bg-aura ${auraActivo ? 'dev-aura-reactiva' : ''} flex h-72 items-center justify-center rounded-glass`}
              >
                <div className="glass-surface rounded-glass p-6 text-center">
                  <p className="font-body text-sm text-concreto-oscuro">
                    .bg-aura {auraActivo ? '+ .dev-aura-reactiva' : '(estático, sin cambios)'}
                  </p>
                </div>
              </div>
              <p className="mt-2 font-body text-xs text-concreto">
                Desplazamiento lento del gradiente + pulso sutil de opacidad sobre el mismo .bg-aura existente — sin
                reemplazarlo.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 pb-16">
          <h2 className="font-display text-lg font-semibold text-concreto-oscuro">Globos — tratamiento Liquid Glass</h2>
          <p className="mt-1 max-w-2xl font-body text-sm text-concreto">
            Datos ficticios — disc_comments todavía no existe como módulo. Solo para revisión visual, no conecta a
            ningún endpoint real.
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-2">
            <div className="bg-textura-concreto rounded-glass bg-arena-suave p-6">
              <p className="mb-4 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">
                Globo de comentario
              </p>
              <div className="space-y-4">
                <GloboComentario autor="Marco Injante" iniciales="MI" cuando="hace 12 min">
                  Revisé el disco D-1042 en el bogie PB3 — el desgaste cóncavo ya está cerca del umbral de
                  reperfilado.
                </GloboComentario>
                <GloboComentario autor="Lucía Farfán" iniciales="LF" cuando="hace 2 h">
                  Confirmado, lo agendamos para la próxima ronda de mantenimiento.
                </GloboComentario>
              </div>
            </div>

            <div className="bg-textura-concreto rounded-glass bg-arena-suave p-6">
              <p className="mb-4 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">
                Globo de estado
              </p>
              <div className="flex flex-wrap gap-3">
                <GloboEstado estado="ok" disco="D-1042" texto="Rd 1.24 — dentro de rango" />
                <GloboEstado estado="seguimiento" disco="D-0871" texto="Rd 0.68 — a revisar" />
                <GloboEstado estado="cambio" disco="D-0933" texto="Rd 0.31 — programar cambio" />
                <GloboEstado estado="critico" disco="D-0512" texto="Rd -0.04 — intervención inmediata" />
                <GloboEstado estado="reperfilado" disco="D-0699" texto="H 1.8 — reperfilado viable" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </PantallaFondo>
  )
}
