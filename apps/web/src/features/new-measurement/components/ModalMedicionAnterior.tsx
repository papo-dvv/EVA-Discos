import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { useReferenciaFicha } from '../queries'
import type {
  FichaInstrumento,
  FichaTecnico,
  ReferenciaUltimaFicha,
  ResultadoReferencia,
  TipoReferencia,
} from '../types'
import { TablaFichaEspejo } from './TablaFichaEspejo'

type Props = {
  fichaId: string
  trenNumero: number
  onCerrar: () => void
}

// Narrowing manual: 'fechaFicha' in data (con tipo='ultima_ficha' ya fijo,
// eso alcanza para distinguir ReferenciaUltimaFicha) no se resuelve bien
// dentro de una expresión ternaria con optional chaining encadenado — TS
// pierde el narrowing. Como función aparte, el control flow narrowing sí
// funciona.
function comoFichaCompleta(
  tipo: TipoReferencia,
  data: ResultadoReferencia | undefined,
): ReferenciaUltimaFicha | null {
  if (tipo !== 'ultima_ficha' || !data || data.disponible === false) return null
  if (!('fechaFicha' in data)) return null
  return data
}

// Punto 6 del enunciado: comparativa histórica de solo lectura. "Última
// Ficha" arranca deshabilitada mientras no se sepa si el tren tiene alguna
// ficha CONFIRMADA previa — se decide con su propia query (independiente de
// cuál pestaña esté activa), así el toggle refleja la disponibilidad real
// desde el primer render sin esperar a que el usuario la elija para recién
// enterarse de que no hay datos.
export function ModalMedicionAnterior({ fichaId, trenNumero, onCerrar }: Props) {
  const [tipo, setTipo] = useState<TipoReferencia>('ultima_medicion')
  const disponibilidadFicha = useReferenciaFicha(trenNumero, 'ultima_ficha')
  const activa = useReferenciaFicha(trenNumero, tipo)

  const ultimaFichaNoDisponible = disponibilidadFicha.data?.disponible === false
  // Punto 7 del enunciado: "Ficha Anterior" (a diferencia de "Última
  // Medición", que no proviene de ninguna ficha real) sí tiene detrás una
  // ficha histórica completa — acá se muestran también Instrumentos y
  // Realizado por/Ing. MR/Responsable, en modo solo lectura.
  const esFichaCompleta = comoFichaCompleta(tipo, activa.data)

  return (
    <GlassModal
      titulo={`Medición anterior — Tren ${trenNumero}`}
      onCerrar={onCerrar}
      ancho={1240}
      altoMaximo="min(88dvh, 56rem)"
      footer={
        <div className="mt-5 flex justify-end">
          <GlassButton type="button" variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
            Cerrar
          </GlassButton>
        </div>
      }
    >
      <SegmentedControl
        ariaLabel="Tipo de referencia"
        opciones={[
          { valor: 'ultima_medicion', etiqueta: 'Última Medición' },
          {
            valor: 'ultima_ficha',
            etiqueta: 'Última Ficha',
            deshabilitada: ultimaFichaNoDisponible,
            tooltip: ultimaFichaNoDisponible ? 'No hay fichas previas de este tren' : undefined,
          },
        ]}
        valor={tipo}
        onCambiar={setTipo}
        className="mt-1"
      />

      <ScrollArea ejes="both" className="mt-4 flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1 pr-3 pb-3">
        <div className="min-w-[68rem]">
        {activa.isLoading ? (
          <p className="font-body text-sm text-concreto">Cargando…</p>
        ) : activa.isError ? (
          <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar la comparativa.
          </p>
        ) : !activa.data || activa.data.disponible === false ? (
          <p className="font-body text-sm text-concreto">
            {tipo === 'ultima_medicion'
              ? 'Este tren todavía no tiene mediciones confirmadas.'
              : 'Este tren todavía no tiene fichas confirmadas.'}
          </p>
        ) : (
          <>
            <GlassSurface fuerte className="grid grid-cols-2 gap-3 rounded-glass p-4 sm:grid-cols-5">
              {/* Punto 4 de la ampliación: P.T. exclusivo de "Ficha Anterior"
                  — "Última Medición" no tiene, no viene de ninguna ficha real. */}
              {esFichaCompleta && <CampoCard etiqueta="P.T." valor={esFichaCompleta.ptCodigo || '—'} />}
              <CampoCard etiqueta="Tren" valor={String(activa.data.tren)} />
              <CampoCard
                etiqueta="Fecha"
                valor={'fecha' in activa.data ? activa.data.fecha : activa.data.fechaFicha}
              />
              <CampoCard etiqueta="Kilometraje" valor={`${activa.data.kilometraje} km`} />
              <CampoCard etiqueta="Responsable" valor={activa.data.responsable || '—'} />
            </GlassSurface>

            <TablaFichaEspejo
              fichaId={fichaId}
              esqueleto={activa.data.esqueleto}
              rows={activa.data.rows}
              deshabilitada
            />

            {esFichaCompleta && (
              <>
                <SeccionInstrumentosSoloLectura instrumentos={esFichaCompleta.instrumentos} />
                <SeccionRealizadoPorSoloLectura tecnicos={esFichaCompleta.tecnicos} />
                <SeccionResponsablesSoloLectura data={esFichaCompleta} />
              </>
            )}
          </>
        )}
        </div>
      </ScrollArea>
    </GlassModal>
  )
}

function CampoCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">{etiqueta}</p>
      <p className="font-data text-sm text-concreto-oscuro">{valor}</p>
    </div>
  )
}

// 3 secciones de solo lectura, exclusivas de "Ficha Anterior" (punto 7) —
// mismos datos/estructura que FooterFicha (editable, para la ficha EN
// CURSO), pero acá nunca hay inputs ni onGuardar: es historial confirmado,
// no se puede tocar.
function SeccionInstrumentosSoloLectura({ instrumentos }: { instrumentos: FichaInstrumento[] }) {
  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <h3 className="mb-3 font-display text-base font-semibold text-concreto-oscuro">Lista de instrumentos</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left font-body text-xs">
          <thead>
            <tr className="border-b border-concreto/20 text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
              <th className="px-2 py-2">Código</th>
              <th className="px-2 py-2">Descripción</th>
              <th className="px-2 py-2">Modelo/Marca</th>
              <th className="px-2 py-2">Fecha de calibración</th>
              <th className="px-2 py-2">Fecha de vencimiento</th>
              <th className="px-2 py-2">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {instrumentos.map((inst) => (
              <tr key={inst.posicion} className="border-b border-concreto/10">
                <td className="px-2 py-1.5 text-concreto-oscuro">{inst.codigo || '—'}</td>
                <td className="px-2 py-1.5 text-concreto-oscuro">{inst.descripcion || '—'}</td>
                <td className="px-2 py-1.5 text-concreto-oscuro">{inst.modeloMarca || '—'}</td>
                <td className="px-2 py-1.5 font-data text-concreto-oscuro">{inst.fechaCalibracion ?? '—'}</td>
                <td className="px-2 py-1.5 font-data text-concreto-oscuro">
                  {inst.fechaVencimientoCalibracion ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-concreto-oscuro">{inst.observaciones || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassSurface>
  )
}

function SeccionRealizadoPorSoloLectura({ tecnicos }: { tecnicos: FichaTecnico[] }) {
  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <h3 className="mb-3 font-display text-base font-semibold text-concreto-oscuro">Realizado por</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tecnicos.map((t) => (
          <div key={t.posicion} className="rounded-2xl border border-[color:var(--glass-border)] bg-white/40 p-3.5">
            <p className="mb-1.5 font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
              Técnico {t.posicion}
            </p>
            <p className="font-body text-sm text-concreto-oscuro">{t.nombre || '—'}</p>
            <p className="mt-0.5 font-body text-xs text-concreto">
              Firma: {t.firma || '—'} · Fecha: {t.fecha ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}

function SeccionResponsablesSoloLectura({ data }: { data: ReferenciaUltimaFicha }) {
  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BloqueResponsableSoloLectura
          titulo="Ing. MR / Técnico Especialista"
          nombre={data.ingMrNombre}
          firma={data.ingMrFirma}
          fecha={data.ingMrFecha}
        />
        <BloqueResponsableSoloLectura
          titulo="Responsable de Mantenimiento"
          nombre={data.responsable}
          firma={data.responsableMantenimientoFirma}
          fecha={data.responsableMantenimientoFecha}
        />
      </div>
    </GlassSurface>
  )
}

function BloqueResponsableSoloLectura({
  titulo,
  nombre,
  firma,
  fecha,
}: {
  titulo: string
  nombre: string | null
  firma: string | null
  fecha: string | null
}) {
  return (
    <div>
      <p className="mb-2 font-body text-sm font-semibold text-concreto-oscuro">{titulo}</p>
      <p className="font-body text-sm text-concreto-oscuro">{nombre || '—'}</p>
      <p className="mt-0.5 font-body text-xs text-concreto">
        Firma: {firma || '—'} · Fecha: {fecha ?? '—'}
      </p>
    </div>
  )
}
