import { useMemo, useState, type FormEvent } from 'react'
import { Database, MousePointer2, Pencil, Plus, Rotate3D, Save, Search, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassButton } from '../components/GlassButton'
import { GlassField } from '../components/GlassField'
import { GlassSelect } from '../components/GlassSelect'
import { GlassSurface } from '../components/GlassSurface'
import { ScrollArea } from '../components/ScrollArea'
import { SegmentedControl } from '../components/SegmentedControl'
import {
  useActualizarRelacionBogie,
  useCatalogoBogies,
  useCrearRelacionBogie,
  useEliminarRelacionBogie,
} from '../features/new-measurement/queries'
import type { RelacionBogieCatalogo, RelacionBogieInput } from '../features/new-measurement/api'

type Flota = 'todo' | 'alstom' | 'ansaldo'

const FORM_INICIAL: RelacionBogieInput = {
  trenNumero: 6,
  coche: '',
  posicion: '',
  serieBogie: '',
  ejeActual: '',
  fechaUltimoCambio: '',
}

export function RelacionBogies() {
  const catalogo = useCatalogoBogies()
  const crear = useCrearRelacionBogie()
  const actualizar = useActualizarRelacionBogie()
  const eliminar = useEliminarRelacionBogie()
  const [flota, setFlota] = useState<Flota>('todo')
  const [tren, setTren] = useState<string | undefined>()
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState<RelacionBogieInput>(FORM_INICIAL)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [filaEliminar, setFilaEliminar] = useState<RelacionBogieCatalogo | null>(null)
  const [bogieEnVista, setBogieEnVista] = useState<RelacionBogieCatalogo | null>(null)

  const filas = useMemo(() => catalogo.data ?? [], [catalogo.data])
  const trenes = useMemo(
    () =>
      [...new Set(filas.map((fila) => fila.trenNumero))]
        .sort((a, b) => a - b)
        .map((numero) => ({ valor: String(numero), etiqueta: `Tren ${numero}` })),
    [filas],
  )

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter((fila) => {
      const coincideFlota =
        flota === 'todo' || (flota === 'alstom' && fila.trenNumero >= 6) || (flota === 'ansaldo' && fila.trenNumero <= 5)
      const coincideTren = tren === undefined || fila.trenNumero === Number(tren)
      const coincideBusqueda =
        q === '' ||
        [
          fila.trenCodigo,
          fila.coche,
          fila.numeroCoche ?? '',
          fila.posicion,
          fila.serieBogie,
          fila.bogieActual,
          fila.ejeActual ?? '',
          fila.fechaUltimoCambio ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      return coincideFlota && coincideTren && coincideBusqueda
    })
  }, [filas, flota, tren, busqueda])

  const totalTrenes = trenes.length
  const totalSeries = new Set(filas.map((fila) => fila.bogieActual)).size
  const guardando = crear.isPending || actualizar.isPending
  const bogieActivo = bogieEnVista ?? filtradas[0] ?? null

  function limpiarForm() {
    setEditandoId(null)
    setForm(FORM_INICIAL)
  }

  function editar(fila: RelacionBogieCatalogo) {
    setBogieEnVista(fila)
    setEditandoId(fila.id)
    setForm({
      trenNumero: fila.trenNumero,
      coche: fila.coche,
      posicion: fila.posicion,
      serieBogie: fila.serieBogie,
      ejeActual: fila.ejeActual ?? '',
      fechaUltimoCambio: fila.fechaUltimoCambio ?? '',
    })
  }

  async function guardar(event: FormEvent) {
    event.preventDefault()
    const dto = {
      ...form,
      trenNumero: Number(form.trenNumero),
      coche: form.coche.trim().toUpperCase(),
      posicion: form.posicion.trim().toUpperCase(),
      serieBogie: form.serieBogie.trim(),
      ejeActual: form.ejeActual?.trim() || null,
      fechaUltimoCambio: form.fechaUltimoCambio?.trim() || null,
    }
    if (editandoId) await actualizar.mutateAsync({ id: editandoId, dto })
    else await crear.mutateAsync(dto)
    limpiarForm()
  }

  return (
    <div className="space-y-4 pb-8">
      <GlassSurface fuerte className="relative isolate overflow-hidden rounded-glass-lg bg-[linear-gradient(120deg,rgba(255,255,255,0.94),rgba(236,253,245,0.9),rgba(239,246,255,0.9))] p-5 sm:p-6">
        <div aria-hidden className="absolute -left-16 top-1/3 h-56 w-56 rounded-full bg-emerald-400/18 blur-3xl" />
        <div className="relative grid items-center gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div>
            <div className="mb-3 max-w-md">
              <SegmentedControl<Flota>
                ariaLabel="Flota"
                valor={flota}
                onCambiar={setFlota}
                opciones={[
                  { valor: 'todo', etiqueta: 'Todo' },
                  { valor: 'alstom', etiqueta: 'ALSTOM' },
                  {
                    valor: 'ansaldo',
                    etiqueta: 'ANSALDO',
                    deshabilitada: true,
                    tooltip: 'La relación Ansaldo queda pendiente de carga.',
                    tooltipPosicion: 'abajo',
                  },
                ]}
              />
            </div>
            <p className="mb-1 flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">
              <Database size={15} aria-hidden />
              Catálogo ALSTOM
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-concreto-oscuro">
              Relación de bogies
            </h1>
            <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-concreto">Explora la composición técnica de la flota. Selecciona una fila de la tabla para cargar su bogie, serie y eje en el esquema visual.</p>
            <div className="mt-5 grid max-w-md grid-cols-2 gap-2">
              <Indicador etiqueta="Trenes" valor={catalogo.isLoading ? '—' : String(totalTrenes)} />
              <Indicador etiqueta="Series" valor={catalogo.isLoading ? '—' : String(totalSeries)} />
            </div>
          </div>
          <BogieEsquema3D bogie={bogieActivo} />
        </div>
      </GlassSurface>

      <GlassSurface fuerte className="rounded-glass p-4">
        <form onSubmit={guardar} className="grid gap-3 xl:grid-cols-[7rem_8rem_8rem_8rem_9rem_10rem_auto]">
          <GlassField
            label="Tren"
            type="number"
            min={1}
            value={form.trenNumero}
            onChange={(e) => setForm((f) => ({ ...f, trenNumero: Number(e.target.value) }))}
          />
          <GlassField
            label="Coche"
            value={form.coche}
            placeholder="MA1"
            onChange={(e) => setForm((f) => ({ ...f, coche: e.target.value }))}
            required
          />
          <GlassField
            label="Bogie"
            value={form.posicion}
            placeholder="PB3"
            onChange={(e) => setForm((f) => ({ ...f, posicion: e.target.value }))}
            required
          />
          <GlassField
            label="Serie"
            value={form.serieBogie}
            placeholder="017"
            onChange={(e) => setForm((f) => ({ ...f, serieBogie: e.target.value }))}
            required
          />
          <GlassField
            label="Eje actual"
            value={form.ejeActual ?? ''}
            placeholder="M146"
            onChange={(e) => setForm((f) => ({ ...f, ejeActual: e.target.value }))}
          />
          <GlassField
            label="Último cambio"
            type="date"
            value={form.fechaUltimoCambio ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, fechaUltimoCambio: e.target.value }))}
          />
          <div className="flex items-end gap-2">
            <GlassButton type="submit" cargando={guardando} className="px-4 py-2.5 text-xs">
              {editandoId ? <Save size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
              {editandoId ? 'Guardar' : 'Agregar'}
            </GlassButton>
            {editandoId && (
              <GlassButton type="button" variante="secundario" onClick={limpiarForm} className="px-3 py-2.5 text-xs">
                <X size={15} aria-hidden />
              </GlassButton>
            )}
          </div>
        </form>
      </GlassSurface>

      <GlassSurface fuerte className="rounded-glass p-4">
        <div className="grid gap-3 lg:grid-cols-[16rem_minmax(18rem,1fr)]">
          <GlassSelect
            label="Tren"
            opciones={trenes}
            seleccion={tren}
            onCambiar={setTren}
            placeholder="Todos"
            disabled={catalogo.isLoading}
          />
          <div className="relative">
            <GlassField
              label="Buscar"
              type="search"
              placeholder="Coche, 004, PB4, M146, fecha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
            <Search size={17} aria-hidden className="pointer-events-none absolute bottom-3.5 left-3.5 text-concreto" />
          </div>
        </div>
      </GlassSurface>

      <GlassSurface fuerte className="overflow-hidden rounded-glass">
        <div className="flex items-center justify-between border-b border-concreto/15 px-4 py-3">
          <p className="font-body text-sm font-semibold text-concreto-oscuro">
            {catalogo.isLoading ? 'Cargando relación...' : `${filtradas.length} registro(s)`}
          </p>
          {catalogo.isError && (
            <p className="font-body text-sm font-semibold text-[color:var(--color-estado-critico)]">
              No se pudo cargar el catálogo.
            </p>
          )}
        </div>

        <ScrollArea ejes="both" viewportClassName="max-h-[calc(100dvh-25rem)]">
          <table className="min-w-[72rem] w-full table-fixed border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-concreto/20 bg-[color:var(--color-arena-suave)] text-left">
                <Encabezado className="w-20">Tren</Encabezado>
                <Encabezado>Coche</Encabezado>
                <Encabezado>N° Coche</Encabezado>
                <Encabezado>Bogie</Encabezado>
                <Encabezado>Serie Bogie</Encabezado>
                <Encabezado>Eje actual</Encabezado>
                <Encabezado>Último cambio</Encabezado>
                <Encabezado className="w-28">Acciones</Encabezado>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((fila) => (
                <tr key={fila.id} onMouseEnter={() => setBogieEnVista(fila)} onClick={() => setBogieEnVista(fila)} className={`tabla-fila--glass cursor-pointer border-b border-concreto/10 transition-colors ${bogieActivo?.id === fila.id ? 'bg-emerald-50/70' : ''}`}>
                  <Celda mono>{fila.trenCodigo}</Celda>
                  <Celda>{fila.coche}</Celda>
                  <Celda mono>{fila.numeroCoche ?? '—'}</Celda>
                  <Celda>{fila.posicion}</Celda>
                  <Celda mono>{fila.serieBogie}</Celda>
                  <Celda mono>{fila.ejeActual ?? '—'}</Celda>
                  <Celda mono>{fila.fechaUltimoCambio ?? '—'}</Celda>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(evento) => { evento.stopPropagation(); editar(fila) }}
                        className="rounded-full border border-concreto/25 bg-white/60 p-2 text-concreto-oscuro transition-colors hover:bg-white"
                        title="Editar"
                      >
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={(evento) => { evento.stopPropagation(); setFilaEliminar(fila) }}
                        className="rounded-full border border-[color:var(--color-estado-critico)]/35 bg-white/60 p-2 text-[color:var(--color-estado-critico)] transition-colors hover:bg-white"
                        title="Eliminar"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!catalogo.isLoading && filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-body text-sm text-concreto">
                    Sin registros para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </GlassSurface>

      {filaEliminar && (
        <ConfirmDialog
          titulo="Eliminar relación"
          mensaje={`¿Eliminar ${filaEliminar.trenCodigo} · ${filaEliminar.coche} · ${filaEliminar.posicion}/${filaEliminar.serieBogie}?`}
          textoConfirmar="Eliminar"
          variante="danger"
          onCerrar={() => setFilaEliminar(null)}
          onConfirm={async () => {
            await eliminar.mutateAsync(filaEliminar.id)
          }}
        />
      )}
    </div>
  )
}

function BogieEsquema3D({ bogie }: { bogie: RelacionBogieCatalogo | null }) {
  const [giro, setGiro] = useState(-12)
  const [vista, setVista] = useState<'2d' | '3d'>('3d')
  const titulo = bogie ? `${bogie.posicion} · serie ${bogie.serieBogie}` : 'Selecciona un bogie'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/75 bg-slate-950 px-4 py-3 text-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.8)]">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(52,211,153,0.32),transparent_42%),linear-gradient(135deg,#10231c,#0f172a_62%,#12372a)]" />
      <div className="relative flex items-center justify-between gap-3"><div><p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-emerald-300">Esquema técnico {vista.toUpperCase()}</p><p className="mt-0.5 font-display text-base font-bold">{titulo}</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-white/15 bg-slate-950/40 p-0.5 text-[0.6rem] font-bold"><button type="button" onClick={() => setVista('3d')} aria-pressed={vista === '3d'} className={`rounded-md px-2 py-1 ${vista === '3d' ? 'bg-white text-slate-900' : 'text-white/70'}`}>3D</button><button type="button" onClick={() => setVista('2d')} aria-pressed={vista === '2d'} className={`rounded-md px-2 py-1 ${vista === '2d' ? 'bg-white text-slate-900' : 'text-white/70'}`}>2D</button></div><Rotate3D size={19} className="text-emerald-300" /></div></div>
      <button type="button" onClick={() => vista === '3d' && setGiro((valor) => valor + 18)} className={`relative mt-3 block w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:bg-white/10 ${vista === '3d' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`} aria-label={vista === '3d' ? 'Rotar vista del bogie' : 'Vista bidimensional del bogie'}>
        <svg viewBox="0 0 360 160" className="h-32 w-full overflow-visible" role="img" aria-label={`Esquema ${vista.toUpperCase()} del bogie ${titulo}`}>
          <defs><linearGradient id="marco-bogie" x1="0" x2="1"><stop stopColor="#5ee9ad"/><stop offset=".45" stopColor="#16895a"/><stop offset="1" stopColor="#0a342a"/></linearGradient><radialGradient id="rueda-bogie"><stop stopColor="#dbeafe"/><stop offset=".4" stopColor="#64748b"/><stop offset="1" stopColor="#0f172a"/></radialGradient></defs>
          <g style={{ transform: vista === '3d' ? `perspective(500px) rotateY(${giro}deg)` : 'none', transformOrigin: '180px 80px', transition: 'transform 420ms cubic-bezier(.2,.8,.2,1)' }}>
            <path d="M70 54 L286 42 L315 72 L100 90 Z" fill="url(#marco-bogie)" opacity=".95" />
            <path d="M100 90 L315 72 L315 97 L100 116 Z" fill="#0a3025" />
            <path d="M70 54 L100 90 L100 116 L70 80 Z" fill="#0c513b" />
            <rect x="126" y="47" width="100" height="16" rx="7" fill="#c7f9df" opacity=".85" />
            {[112, 174, 255, 309].map((cx) => <g key={cx}><circle cx={cx} cy="112" r="25" fill="url(#rueda-bogie)" stroke="#cbd5e1" strokeWidth="2"/><circle cx={cx} cy="112" r="8" fill="#e2e8f0"/></g>)}
            <path d="M110 77 L290 63" stroke="#ecfdf5" strokeWidth="3" opacity=".75" />
          </g>
        </svg>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/30 px-2 py-1 font-body text-[0.6rem] text-white/80">{vista === '3d' ? <><MousePointer2 size={10} className="mr-1 inline" />Presiona para girar</> : 'Vista de planta · ruedas y ejes'}</span>
      </button>
      <div className="relative mt-3 grid grid-cols-3 gap-2 text-center"><MiniDato etiqueta="Bogie" valor={bogie?.posicion ?? '—'} /><MiniDato etiqueta="Eje" valor={bogie?.ejeActual ?? '—'} /><MiniDato etiqueta="Coche" valor={bogie?.coche ?? '—'} /></div>
    </div>
  )
}

function MiniDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"><p className="font-body text-[0.55rem] uppercase tracking-wide text-white/55">{etiqueta}</p><p className="mt-0.5 font-data text-xs font-bold text-white">{valor}</p></div>
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-white/55 bg-white/45 px-4 py-3">
      <p className="font-body text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-concreto">{etiqueta}</p>
      <p className="mt-1 font-data text-xl font-bold text-concreto-oscuro">{valor}</p>
    </div>
  )
}

function Encabezado({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto ${className}`.trim()}>
      {children}
    </th>
  )
}

function Celda({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`truncate px-3 py-2.5 text-concreto-oscuro ${mono ? 'font-data' : ''}`.trim()}>
      {children}
    </td>
  )
}
