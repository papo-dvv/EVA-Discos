import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { Marca } from '../components/Marca'
import { SegmentedControl } from '../components/SegmentedControl'
import { subirMigracion } from '../features/migration/api'
import { PanelHistorialMigracion } from '../features/migration/components/PanelHistorialMigracion'
import { useInvalidarHistorialMigracion } from '../features/migration/queries'
import { extraerMensajeError } from '../lib/extraerMensajeError'

type ModoCarga = 'todos' | 'marca' | 'tren'
type MarcaTren = 'ansaldo' | 'alstom'
type TrenCarga = `T${number}` | 'ansaldo-reserva'

const TRENES = Array.from({ length: 44 }, (_, i) => `T${i + 1}` as TrenCarga)

// Entrada a la migración masiva: sube una tabla compatible y navega a la vista previa.
export function MigracionUpload() {
  const navigate = useNavigate();
  const invalidarHistorial = useInvalidarHistorialMigracion()
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<ModoCarga | undefined>()
  const [marca, setMarca] = useState<MarcaTren | undefined>()
  const [tren, setTren] = useState<TrenCarga | undefined>()

  const alcanceListo =
    (modo === 'marca' && marca === 'alstom') ||
    (modo === 'tren' && tren !== undefined && !esTrenAnsaldo(tren))

  function cambiarModo(valor: ModoCarga) {
    setModo(valor)
    setMarca(undefined)
    setTren(undefined)
    setFile(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !alcanceListo) return;
    setError(null);
    setCargando(true);
    try {
      const resumen = await subirMigracion(file);
      invalidarHistorial()
      navigate(`/migracion/${resumen.fileId}`);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo procesar el archivo."));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="px-3 py-6 sm:px-5">
      <div className="mx-auto grid max-w-[90rem] gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <PanelHistorialMigracion />
        </aside>

        <main className="min-w-0">
          <GlassSurface fuerte iris className="rounded-glass-lg p-8 sm:p-10">
            <Marca tono="oscuro" tamano="condensado" />
            <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-concreto-oscuro">
              Migración masiva
            </h1>
            <p className="mt-1.5 font-body text-sm text-concreto">
              Sube un archivo tabular para revisarlo antes de confirmar. Se admiten
              Excel, OpenDocument, CSV y texto delimitado.
            </p>

            <div className="mt-7 space-y-4">
              <div>
                <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
                  Alcance
                </p>
                <SegmentedControl<ModoCarga>
                  ariaLabel="Alcance de migración"
                  valor={modo}
                  onCambiar={cambiarModo}
                  opciones={[
                    {
                      valor: 'todos',
                      etiqueta: 'Todos',
                      deshabilitada: true,
                      tooltip: 'Todos exige los 44 trenes. Se habilitará cuando Ansaldo esté activo.',
                      tooltipPosicion: 'abajo',
                    },
                    { valor: 'marca', etiqueta: 'Por Marca de Tren' },
                    { valor: 'tren', etiqueta: 'Por Tren' },
                  ]}
                />
              </div>

              {modo === 'marca' && (
                <div>
                  <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
                    Marca de tren
                  </p>
                  <SegmentedControl<MarcaTren>
                    ariaLabel="Marca de tren"
                    valor={marca}
                    onCambiar={(v) => {
                      setMarca(v)
                      setFile(null)
                    }}
                    opciones={[
                      {
                        valor: 'ansaldo',
                        etiqueta: 'ANSALDO',
                        deshabilitada: true,
                        tooltip: 'Trenes 1-5 y reserva. Pendiente de implementación.',
                        tooltipPosicion: 'abajo',
                      },
                      { valor: 'alstom', etiqueta: 'ALSTOM' },
                    ]}
                  />
                </div>
              )}

              {modo === 'tren' && (
                <div>
                  <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
                    Tren
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-11">
                    {TRENES.map((opcion) => (
                      <button
                        key={opcion}
                        type="button"
                        disabled={esTrenAnsaldo(opcion)}
                        data-active={tren === opcion ? 'true' : undefined}
                        onClick={() => {
                          setTren(opcion)
                          setFile(null)
                        }}
                        className="rounded-full border border-concreto/20 bg-white/55 px-2.5 py-1.5 font-data text-xs text-concreto-oscuro transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:border-verde-institucional data-[active=true]:bg-verde-claro data-[active=true]:font-semibold data-[active=true]:text-verde-oscuro"
                        title={esTrenAnsaldo(opcion) ? 'Ansaldo pendiente de implementación' : undefined}
                      >
                        {opcion}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-concreto/20 bg-white/55 px-2.5 py-1.5 font-body text-xs text-concreto-oscuro opacity-45"
                      title="Reserva Ansaldo pendiente de implementación"
                    >
                      Reserva
                    </button>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="mt-7">
              <label
                className={`glass-field flex flex-col items-center gap-2 border-dashed py-8 text-center transition-colors ${
                  alcanceListo
                    ? 'cursor-pointer hover:border-[color:var(--color-verde-institucional)]'
                    : 'cursor-not-allowed opacity-55'
                }`}
              >
                <span className="font-display text-3xl text-verde-oscuro">⇪</span>
                <span className="font-body text-sm font-semibold text-concreto-oscuro">
                  {file ? file.name : "Elegir archivo tabular"}
                </span>
                <span className="font-body text-xs text-concreto">
                  {file ? "Clic para cambiar" : "Clic para seleccionar"}
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xls,.xlsb,.xlsx,.xlsm,.ods"
                  className="hidden"
                  disabled={!alcanceListo}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="mt-4 font-body text-sm text-[color:var(--color-estado-critico)]"
                >
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-4">
                <GlassButton type="submit" cargando={cargando} disabled={!file || !alcanceListo}>
                  {cargando ? "Procesando…" : "Subir y revisar"}
                </GlassButton>
              </div>
            </form>
          </GlassSurface>
        </main>
      </div>
    </div>
  )
}

function esTrenAnsaldo(tren: TrenCarga): boolean {
  if (tren === 'ansaldo-reserva') return true
  return Number(tren.slice(1)) <= 5
}
