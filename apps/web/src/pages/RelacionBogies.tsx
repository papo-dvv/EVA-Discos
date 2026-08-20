import { useMemo, useState, type FormEvent } from 'react'
import { Database, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
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

  const filas = catalogo.data ?? []
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

  function limpiarForm() {
    setEditandoId(null)
    setForm(FORM_INICIAL)
  }

  function editar(fila: RelacionBogieCatalogo) {
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
      <GlassSurface fuerte className="rounded-glass-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
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
            <h1 className="font-display text-2xl font-bold tracking-tight text-concreto-oscuro">
              Relación de bogies
            </h1>
          </div>
          <div className="grid min-w-[18rem] grid-cols-2 gap-2">
            <Indicador etiqueta="Trenes" valor={catalogo.isLoading ? '—' : String(totalTrenes)} />
            <Indicador etiqueta="Series" valor={catalogo.isLoading ? '—' : String(totalSeries)} />
          </div>
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
                <tr key={fila.id} className="tabla-fila--glass border-b border-concreto/10">
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
                        onClick={() => editar(fila)}
                        className="rounded-full border border-concreto/25 bg-white/60 p-2 text-concreto-oscuro transition-colors hover:bg-white"
                        title="Editar"
                      >
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilaEliminar(fila)}
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
