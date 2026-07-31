import { FondoEngranajes } from '../components/FondoEngranajes'
import { Marca } from '../components/Marca'
import { NavGaleria } from '../components/NavGaleria'
import { Seccion } from '../components/Seccion'
import { TarjetaColor } from '../components/TarjetaColor'
import { Widget } from '../components/Widget'
import {
  escalaTipografica,
  etiquetaEstadoTabla,
  filasTabla,
  navItems,
  paletaApoyo,
  paletaDominante,
  paletaSemantica,
  tarjetasEstado,
} from '../data/showcase'

// Vista puramente demostrativa del sistema de diseño (ver /styles.md).
// No implementa navegación de la app real ni lógica de negocio: solo exhibe
// cómo lucen los componentes que se usarán en el resto de EVA, siguiendo el
// orden de prioridades de styles.md §2 — glass y movimiento primero, la
// tabla de mediciones como única excepción funcional (§6.1).

export function Galeria() {
  return (
    <div className="bg-cuadricula bg-aura min-h-screen">
      <NavGaleria items={navItems} />

      <header className="relative isolate overflow-hidden px-6 pb-32 pt-14 sm:px-10 sm:pt-20">
        <div className="bg-degradado-transformacion bg-difuminado-inferior absolute inset-0 -z-10" />

        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <Marca tono="sobreVerde" />
            <span className="glass-chip mt-8 inline-flex text-verde-oscuro">Vista demostrativa — no funcional</span>
            <h1 className="mt-6 font-display text-6xl font-semibold tracking-tight text-verde-oscuro sm:text-7xl">
              Sistema de Diseño
            </h1>
            <p className="mt-2 max-w-xl font-display text-lg text-concreto-oscuro">
              &ldquo;Del gris de la arena al verde de la acción&rdquo;
            </p>
            <p className="mt-5 max-w-xl text-sm text-concreto-oscuro">
              Catálogo de los componentes visuales de EVA. Esta pantalla solo exhibe estilo —
              tipografía, glass, movimiento, colores, tarjetas y fondos — para validar el
              lenguaje visual antes de construir las pantallas reales. Especificación completa
              en <code className="rounded bg-white/50 px-1.5 py-0.5 font-data text-xs">styles.md</code>.
            </p>
          </div>

          {/* Pieza hero de la pantalla: la única con --vivo + flotar combinados
              (styles.md §5, presupuesto de motion continuo). El resto de la
              galería referencia estas dos animaciones en vez de repetirlas. */}
          <div className="glass-surface glass-surface--vivo glass-surface--iris eva-anim-flotar rounded-glass-lg p-8">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-concreto">Discos evaluados hoy</p>
            <p className="mt-2 font-display text-7xl font-semibold tracking-tight text-concreto-oscuro">288</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="glass-chip" data-active="true">OK</span>
              <span className="glass-chip">Seguimiento</span>
              <span className="glass-chip">Crítico</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-24">
        <Seccion
          id="tipografia"
          numero="§3"
          titulo="Tipografía"
          nota="La jerarquía la decide primero el tamaño y el peso — antes que el color. Escala completa, incluidas las piezas hero (72/96px)."
        >
          <div className="glass-surface rounded-glass p-8">
            <div className="divide-y divide-concreto/10">
              {escalaTipografica.map((tam) => (
                <div key={tam} className="flex items-baseline justify-between gap-6 py-4">
                  <p className="font-display font-semibold tracking-tight text-concreto-oscuro" style={{ fontSize: `${tam}px` }}>
                    Aa
                  </p>
                  <p className="font-data text-xs text-concreto">{tam}px</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 border-t border-concreto/10 pt-6 sm:grid-cols-2">
              <p className="font-body text-sm text-concreto-oscuro">
                Texto de interfaz en Inter — labels, descripciones y contenido general de la app.
              </p>
              <p className="font-data text-sm text-concreto-oscuro">T: 12.4&nbsp;&nbsp;H: 3.8&nbsp;&nbsp;Rd: 0.62</p>
            </div>
          </div>

          {/* §1.1 — wordmark: relación mínima 3:1 entre "EVA" y la línea de
              contexto, con los dos tratamientos de color que existen. */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="glass-surface rounded-glass p-6">
              <p className="mb-4 font-body text-xs uppercase tracking-[0.14em] text-concreto">Wordmark — sobre claro</p>
              <Marca tono="oscuro" />
            </div>
            <div className="bg-degradado-transformacion rounded-glass p-6">
              <p className="mb-4 font-body text-xs uppercase tracking-[0.14em] text-verde-oscuro/70">Wordmark — sobre degradado</p>
              <Marca tono="sobreVerde" />
            </div>
          </div>
        </Seccion>

        <Seccion
          id="liquid-glass"
          numero="§4"
          titulo="Liquid Glass — burbuja pronunciada"
          nota="Mucho más transparente que un panel opaco: blur 32-44px, saturación 190%, doble brillo especular. Necesita textura o color detrás — nunca sobre blanco liso."
        >
          <div className="bg-textura-concreto rounded-glass bg-arena-suave p-8">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="glass-surface eva-elevar eva-brillo rounded-glass p-6">
                <span className="eva-brillo__barrido" aria-hidden="true" />
                <p className="font-body text-sm font-medium text-concreto-oscuro">.glass-surface</p>
                <p className="mt-1 font-body text-xs text-concreto">Blur 32px, saturate 190%, doble highlight, sombra en 2 capas.</p>
              </div>
              <div className="glass-surface glass-surface--strong eva-elevar eva-brillo rounded-glass p-6">
                <span className="eva-brillo__barrido" aria-hidden="true" />
                <p className="font-body text-sm font-medium text-concreto-oscuro">.glass-surface--strong</p>
                <p className="mt-1 font-body text-xs text-concreto">Blur 44px — compensa la mayor opacidad. Drawers y formularios.</p>
              </div>
              <div className="glass-surface glass-surface--vivo eva-elevar rounded-glass p-6">
                <p className="font-body text-sm font-medium text-concreto-oscuro">.glass-surface--vivo</p>
                <p className="mt-1 font-body text-xs text-concreto">Borde de gradiente cónico animado — opt-in, piezas hero.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="button" className="glass-button-primary px-6 py-3 font-body text-sm font-medium">
                Botón primario
              </button>
              <button type="button" className="glass-surface glass-button-secondary px-6 py-3 font-body text-sm font-medium text-concreto-oscuro">
                Botón secundario
              </button>
              <span className="glass-chip">Chip filtro</span>
              <span className="glass-chip" data-active="true">Chip activo</span>
            </div>
          </div>
        </Seccion>

        <Seccion
          id="widgets"
          numero="§4.1"
          titulo="Widgets estilo Apple"
          nota="La unidad de composición primaria: tiles glass texturados en grilla bento (S/M/L). Cabecera con glifo, valor grande protagonista y pie opcional. El hero suma tilt 3D reactivo — pasa el cursor por encima."
        >
          <div className="bg-textura-concreto grid gap-5 rounded-glass bg-arena-suave p-8 sm:grid-cols-2 lg:grid-cols-4">
            <Widget
              tamano="l"
              tilt
              vivo
              etiqueta="Discos evaluados hoy"
              glifo="◉"
              valor="288"
              pie={<span className="glass-chip" data-active="true">+12 vs ayer</span>}
              className="sm:col-span-2 lg:row-span-2"
            />
            <Widget
              tamano="m"
              estado="ok"
              etiqueta="Estado OK"
              glifo="✓"
              valor="241"
              pie={<span className="font-body text-xs text-concreto">83.7% de la flota</span>}
            />
            <Widget
              tamano="m"
              estado="critico"
              pulso
              etiqueta="Críticos"
              glifo="!"
              valor="4"
              pie={<span className="font-body text-xs text-concreto">Requieren cambio</span>}
            />
            <Widget tamano="s" etiqueta="Tren activo" glifo="⇄" valor="T-15" />
            <Widget tamano="s" etiqueta="Seguimiento" glifo="◐" valor="43" />
          </div>
        </Seccion>

        <Seccion
          id="tarjetas-estado"
          numero="§4"
          titulo="Tarjetas de estado"
          nota="Composición bento: OK ocupa el doble de ancho (calma), Crítico ocupa el ancho completo (no se puede pasar por alto) y además pulsa."
        >
          <div className="bg-cuadricula grid gap-5 rounded-glass bg-arena-suave p-8 sm:grid-cols-2 lg:grid-cols-4">
            {tarjetasEstado.map((t) => (
              <div
                key={t.label}
                className={`glass-surface eva-elevar eva-brillo ${t.clase} ${t.span} ${t.pulso ? 'eva-anim-pulso' : ''} rounded-glass p-6`}
              >
                <span className="eva-brillo__barrido" aria-hidden="true" />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                <p className="mt-2 font-body text-sm font-semibold text-concreto-oscuro">{t.label}</p>
                <p className="mt-1 font-body text-xs text-concreto">{t.desc}</p>
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion
          id="movimiento"
          numero="§5"
          titulo="Movimiento"
          nota="Motion reactivo en casi todo lo interactivo; motion continuo (idle) limitado a un par de piezas simultáneas como mucho, para que se sienta vivo, no ruidoso. Pasa el cursor sobre las tarjetas."
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="glass-surface eva-elevar eva-brillo rounded-glass p-6">
              <span className="eva-brillo__barrido" aria-hidden="true" />
              <p className="font-body text-sm font-medium text-concreto-oscuro">.eva-elevar + .eva-brillo</p>
              <p className="mt-1 font-body text-xs text-concreto">Lift, sombra más profunda y barrido de luz al pasar el cursor.</p>
            </div>
            <div className="glass-surface glass-surface--vivo rounded-glass p-6">
              <p className="font-body text-sm font-medium text-concreto-oscuro">.glass-surface--vivo</p>
              <p className="mt-1 font-body text-xs text-concreto">Borde animado continuo — opt-in, nunca en grillas repetidas.</p>
            </div>
            <div className="glass-surface glass-card--estado-critico eva-anim-pulso rounded-glass p-6">
              <p className="font-body text-sm font-medium text-concreto-oscuro">.eva-anim-pulso</p>
              <p className="mt-1 font-body text-xs text-concreto">Pulso sutil, exclusivo del borde-glow crítico.</p>
            </div>
          </div>
          <p className="mt-5 font-body text-xs text-concreto">
            Las otras dos primitivas del catálogo ya están en vivo en esta misma pantalla, sin
            sumarse a las de arriba (el presupuesto es 2 piezas continuas a la vez):{' '}
            <code className="rounded bg-white/50 px-1.5 py-0.5 font-data text-[11px]">.eva-anim-flotar</code> en la
            tarjeta hero del encabezado, y{' '}
            <code className="rounded bg-white/50 px-1.5 py-0.5 font-data text-[11px]">.eva-revelar</code> en la
            entrada de cada sección al hacer scroll — incluida esta.
          </p>
        </Seccion>

        <Seccion id="paleta" numero="§6" titulo="Paleta de color" nota="Dos dominantes (verde, blanco), dos de apoyo (arena, gris) y cuatro semánticos subordinados.">
          <div className="space-y-8">
            <div>
              <p className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">Dominante</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {paletaDominante.map((s) => <TarjetaColor key={s.variable} s={s} />)}
              </div>
            </div>
            <div>
              <p className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">Apoyo</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {paletaApoyo.map((s) => <TarjetaColor key={s.variable} s={s} />)}
              </div>
            </div>
            <div>
              <p className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">Semántico (UI general)</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {paletaSemantica.map((s) => <TarjetaColor key={s.variable} s={s} />)}
              </div>
            </div>
          </div>
        </Seccion>

        <Seccion
          id="tabla"
          numero="§6.1 / §9"
          titulo="Tabla de mediciones — alto contraste"
          nota="Excepción funcional a la prioridad Apple de §2: cero glass, cero motion nuevo. Colores sólidos saturados (≥4.5:1 WCAG AA), pensados para lectura rápida a distancia — anulan la paleta tierra de §6 solo dentro de esta tabla."
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-concreto/25 bg-white/50 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-estado-critico)]" aria-hidden="true" />
            <span className="font-body text-xs text-concreto-oscuro">
              Única sección de la galería sin tratamiento Apple — es intencional, ver styles.md §6.1
            </span>
          </div>
          <div className="overflow-hidden rounded-glass bg-arena-suave">
            <table className="w-full text-left">
              <thead>
                <tr className="font-body text-xs uppercase tracking-wide text-concreto">
                  <th className="px-4 py-3">Disco</th>
                  <th className="px-4 py-3 text-right">T</th>
                  <th className="px-4 py-3 text-right">H</th>
                  <th className="px-4 py-3 text-right">Rd</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasTabla.map((f) => (
                  <tr
                    key={f.disco}
                    className="border-t border-concreto/10 transition-colors duration-200"
                    style={{ background: `color-mix(in srgb, var(--tabla-estado-${f.estado}-bg) 8%, var(--color-arena-suave))` }}
                  >
                    <td className="px-4 py-3 font-data text-sm text-concreto-oscuro">{f.disco}</td>
                    <td className="px-4 py-3 text-right font-data text-sm text-concreto-oscuro">{f.t}</td>
                    <td className="px-4 py-3 text-right font-data text-sm text-concreto-oscuro">{f.h}</td>
                    <td className="px-4 py-3 text-right font-data text-sm text-concreto-oscuro">{f.rd}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`tabla-chip tabla-chip--${f.estado}`}>{etiquetaEstadoTabla[f.estado]}</span>
                        {f.reperfilado && <span className="tabla-chip tabla-chip--reperfilado">Reperfilado</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>

        <Seccion id="fondos" numero="§7" titulo="Fondos y texturas" nota="Elementos estructurales: cuadrícula de manzanas, textura de concreto, degradado tierra → verde y el aura de fondo.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="eva-elevar bg-cuadricula flex h-32 items-end rounded-glass bg-arena-suave p-4">
              <p className="font-data text-xs text-concreto-oscuro">.bg-cuadricula</p>
            </div>
            <div className="eva-elevar bg-textura-concreto flex h-32 items-end rounded-glass bg-arena-suave p-4">
              <p className="font-data text-xs text-concreto-oscuro">.bg-textura-concreto</p>
            </div>
            <div className="eva-elevar bg-degradado-transformacion flex h-32 items-end rounded-glass p-4">
              <p className="font-data text-xs text-verde-oscuro">.bg-degradado-transformacion</p>
            </div>
            <div className="eva-elevar bg-aura bg-cuadricula flex h-32 items-end rounded-glass p-4">
              <p className="font-data text-xs text-concreto-oscuro">.bg-aura</p>
            </div>
          </div>
        </Seccion>

        <Seccion
          id="aviso"
          numero="§7.1"
          titulo="Fondo de solo aviso — engranajes cayendo"
          nota="Exclusivo de pantallas sin más contenido que un aviso. Densidad alta de engranajes en gris concreto, cayendo de esquina a esquina, con el mensaje en una tarjeta glass fuerte y viva por encima."
        >
          <FondoEngranajes cantidad={30} className="relative h-96">
            <div className="glass-surface glass-surface--strong glass-surface--vivo absolute inset-0 m-auto flex h-fit w-72 flex-col items-center gap-2 rounded-glass-lg p-6 text-center">
              <p className="font-display text-base font-semibold text-concreto-oscuro">Sin novedades</p>
              <p className="font-body text-sm text-concreto">No tienes avisos pendientes por ahora.</p>
            </div>
          </FondoEngranajes>
        </Seccion>

        <Seccion id="drawer" numero="§9" titulo="Drawer de detalle" nota="Vista estática — en la app real desliza desde la derecha sobre el contenido (.eva-revelar--derecha).">
          <div className="bg-degradado-transformacion relative h-56 overflow-hidden rounded-glass">
            <div className="glass-surface glass-surface--strong absolute inset-y-4 right-4 w-64 rounded-glass p-6">
              <p className="font-body text-sm font-semibold text-concreto-oscuro">Detalle del disco</p>
              <p className="mt-2 font-data text-xs text-concreto-oscuro">D-1042 · T 12.4 · H 3.8</p>
              <p className="mt-3 font-body text-xs text-concreto">Contenido de ejemplo del drawer.</p>
            </div>
          </div>
        </Seccion>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <div className="border-t border-concreto/15 pt-16 text-center">
          <p className="font-display text-4xl font-semibold tracking-tight text-concreto-oscuro">EVA</p>
          <p className="mt-2 font-body text-xs uppercase tracking-[0.14em] text-concreto">de Línea 1 de Lima</p>
          <p className="mt-6 font-data text-[11px] text-concreto">Sistema de Diseño — vista demostrativa</p>
        </div>
      </footer>
    </div>
  )
}
