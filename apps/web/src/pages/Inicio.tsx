import { Link } from 'react-router-dom'
import { Widget } from '../components/Widget'
import { useAuth } from '../auth/useAuth'

// Inicio real de la app: dashboard de widgets estilo Apple (styles.md §4.1).
// La grilla bento mezcla el widget hero (saludo) con las tarjetas de módulo.
// Los módulos funcionales hoy son la migración masiva, la vista permanente de
// mediciones confirmadas, la tasa de desgaste, la trazabilidad y la
// proyección de reperfilado y cambio; el resto se muestran como
// "Próximamente" sin fingir que ya existen.
const MODULOS_PROXIMOS = [
  { etiqueta: 'Reportes', glifo: '▤', desc: 'Panel docente y administrativo.' },
  { etiqueta: 'Calendario', glifo: '◲', desc: 'Cambios y reperfilados programados.' },
]

export function Inicio() {
  const { sesion } = useAuth()
  const nombreCompleto = sesion?.usuario.nombresCompletos ?? 'Invitado'
  const primerNombre = nombreCompleto.split(' ')[0]

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Grilla bento de widgets */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Widget hero — saludo personalizado, con tilt (§4.1) */}
          <Widget
            tamano="l"
            tilt
            vivo
            etiqueta="Sesión activa"
            glifo="◉"
            className="sm:col-span-2 lg:row-span-2"
          >
            <p className="font-body text-sm text-concreto">Hola,</p>
            <p className="font-display text-6xl font-semibold leading-none tracking-tight text-concreto-oscuro">
              {primerNombre}
            </p>
            <div className="eva-widget__pie">
              {sesion && (
                <>
                  <span className="glass-chip" data-active="true">
                    {sesion.usuario.rol}
                  </span>
                  <span className="glass-chip">{nombreCompleto}</span>
                </>
              )}
            </div>
          </Widget>

          {/* Módulo funcional: migración masiva */}
          <Link to="/migracion" className="block">
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Módulo disponible"
              glifo="⇪"
              valor="Migración"
              pie={
                <span className="font-body text-sm font-semibold text-verde-oscuro">
                  Subir Excel histórico →
                </span>
              }
            />
          </Link>

          {/* Módulo funcional: ficha de medición individual (CSV o manual) */}
          <Link to="/nuevas-mediciones" className="block">
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Módulo disponible"
              glifo="✎"
              valor="Nuevas mediciones"
              pie={
                <span className="font-body text-sm font-semibold text-verde-oscuro">
                  Registrar una ficha →
                </span>
              }
            />
          </Link>

          {/* Módulo funcional: vista permanente de mediciones confirmadas */}
          <Link to="/mediciones" className="block">
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Módulo disponible"
              glifo="▦"
              valor="Mediciones"
              pie={
                <span className="font-body text-sm font-semibold text-verde-oscuro">
                  Ver datos confirmados →
                </span>
              }
            />
          </Link>

          {/* Módulo funcional: tasa de desgaste */}
          <Link to="/tasa-desgaste" className="block">
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Módulo disponible"
              glifo="⤵"
              valor="Tasa de desgaste"
              pie={
                <span className="font-body text-sm font-semibold text-verde-oscuro">
                  Tendencia y proyección →
                </span>
              }
            />
          </Link>

          {/* Módulo funcional: trazabilidad */}
          <Link to="/trazabilidad" className="block">
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Módulo disponible"
              glifo="⌁"
              valor="Trazabilidad"
              pie={
                <span className="font-body text-sm font-semibold text-verde-oscuro">
                  Historial y evolución de cada disco →
                </span>
              }
            />
          </Link>

          {/* Módulo funcional: proyección de reperfilado y cambio */}
          <Link to="/proyeccion" className="block">
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Módulo disponible"
              glifo="◈"
              valor="Proyección"
              pie={
                <span className="font-body text-sm font-semibold text-verde-oscuro">
                  Reperfilado y cambio a futuro →
                </span>
              }
            />
          </Link>

          {/* Módulos planificados — honestos: "Próximamente", sin link */}
          {MODULOS_PROXIMOS.map((m) => (
            <Widget
              key={m.etiqueta}
              tamano="m"
              elevar={false}
              etiqueta={m.etiqueta}
              glifo={m.glifo}
              className="opacity-80"
            >
              <p className="font-body text-sm text-concreto-oscuro">{m.desc}</p>
              <div className="eva-widget__pie">
                <span className="glass-chip">Próximamente</span>
              </div>
            </Widget>
          ))}
        </div>
      </div>
    </div>
  )
}
