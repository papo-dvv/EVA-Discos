import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { ETIQUETA_FABRICANTE, ETIQUETA_STAGE, type Fabricante, type InventoryRow, type LadoInventario } from '../types'

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  retiro_masivo: 'Retiro masivo',
  cambio_disco: 'Cambio de disco',
  devolucion_almacen: 'Devolución a almacén',
}

function numero(v: number | null): string {
  return v === null ? '—' : v.toFixed(2)
}

function BloqueLado({ titulo, lado }: { titulo: string; lado: LadoInventario | null }) {
  return (
    <div className="rounded-2xl border border-concreto/10 bg-white/45 p-3">
      <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">{titulo}</p>
      {!lado ? (
        <p className="font-body text-sm text-concreto">Sin disco de este lado.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-body text-sm">
          <dt className="text-concreto">Estado</dt>
          <dd className="text-right font-semibold text-concreto-oscuro">{lado.estadoCalculado ?? '—'}</dd>
          <dt className="text-concreto">T</dt>
          <dd className="text-right font-data">{numero(lado.tValue)}</dd>
          <dt className="text-concreto">H</dt>
          <dd className="text-right font-data">{numero(lado.hValue)}</dd>
          <dt className="text-concreto">Rd</dt>
          <dd className="text-right font-data">{numero(lado.rdValue)}</dd>
        </dl>
      )}
    </div>
  )
}

// Ver detalles — calcado del "ver detalle de rueda" de EVA-Aldy (ver
// styles-eva/inventario-styles.md), adaptado: acá es un eje completo
// (izquierdo + derecho), no una sola pieza.
export function ModalVerDetalleEje({ eje, onCerrar }: { eje: InventoryRow; onCerrar: () => void }) {
  const mov = eje.ultimoMovimiento

  return (
    <GlassModal
      titulo={eje.serie ? `Eje ${eje.serie}-D` : 'Eje sin serie'}
      onCerrar={onCerrar}
      ancho={560}
      altoMaximo="85vh"
      footer={
        <div className="mt-4 flex justify-end">
          <GlassButton type="button" variante="secundario" onClick={onCerrar}>
            Cerrar
          </GlassButton>
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-body text-sm">
          <dt className="text-concreto">Etapa</dt>
          <dd className="text-right font-semibold text-concreto-oscuro">{ETIQUETA_STAGE[eje.stage]}</dd>
          <dt className="text-concreto">Fase</dt>
          <dd className="text-right capitalize text-concreto-oscuro">{eje.fase}</dd>
          <dt className="text-concreto">Lote</dt>
          <dd className="text-right text-concreto-oscuro">{eje.lote ?? '—'}</dd>
          <dt className="text-concreto">Fabricante</dt>
          <dd className="text-right text-concreto-oscuro">{eje.fabricante ? ETIQUETA_FABRICANTE[eje.fabricante as Fabricante] : '—'}</dd>
          <dt className="text-concreto">Marca de disco</dt>
          <dd className="text-right text-concreto-oscuro">{eje.marcaRueda ?? '—'}</dd>
          <dt className="text-concreto">Asociación</dt>
          <dd className="text-right text-concreto-oscuro">{eje.asociacion}</dd>
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <BloqueLado titulo="Izquierdo" lado={eje.izquierdo} />
          <BloqueLado titulo="Derecho" lado={eje.derecho} />
        </div>

        <div className="rounded-2xl border border-concreto/10 bg-white/45 p-3">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Último movimiento</p>
          {!mov ? (
            <p className="font-body text-sm text-concreto">Sin movimientos registrados.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-body text-sm">
              <dt className="text-concreto">Tipo</dt>
              <dd className="text-right font-semibold text-concreto-oscuro">{ETIQUETA_MOVIMIENTO[mov.tipo]}</dd>
              <dt className="text-concreto">Fecha</dt>
              <dd className="text-right text-concreto-oscuro">{mov.fecha}</dd>
              <dt className="text-concreto">Solicitado por</dt>
              <dd className="text-right text-concreto-oscuro">{mov.encargadoNombre}</dd>
              {mov.supervisorNombre && (
                <>
                  <dt className="text-concreto">Supervisor</dt>
                  <dd className="text-right text-concreto-oscuro">{mov.supervisorNombre}</dd>
                </>
              )}
              {mov.numeroPt && (
                <>
                  <dt className="text-concreto">N° PT</dt>
                  <dd className="text-right text-concreto-oscuro">{mov.numeroPt}</dd>
                </>
              )}
              {mov.justificacion && (
                <>
                  <dt className="col-span-2 text-concreto">Justificación</dt>
                  <dd className="col-span-2 text-concreto-oscuro">{mov.justificacion}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>
    </GlassModal>
  )
}
