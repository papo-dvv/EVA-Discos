import { GlassModal } from '../../../components/GlassModal'
import { CargaInicialFicha } from './CargaInicialFicha'

type Props = {
  tren: number
  modoInicial: 'csv' | 'manual'
  onCerrar: () => void
  onCreada: (fichaId: string, autoVerificar?: boolean) => void
}

// Primer paso de una ficha nueva de Medición, abierto desde los botones
// CSV/Manual de TrenSemaforoCard (vista "Tarjetas" de Mediciones) — mismo
// contenido que la carga inicial embebida en NuevasMediciones.tsx
// (CargaInicialFicha), pero en un modal con el tren y el modo ya
// preseleccionados (el usuario ya los eligió en la card, no tiene sentido
// pedírselos de nuevo). Al crearse la ficha, MedicionesTarjetas.tsx navega a
// /nuevas-mediciones/:fichaId — la misma pantalla completa de vista previa
// que usa el flujo existente, no una nueva.
export function ModalCargaInicialMedicion({
  tren,
  modoInicial,
  onCerrar,
  onCreada,
}: Props) {
  return (
    <GlassModal
      titulo={`Nueva medición — Tren ${tren}`}
      onCerrar={onCerrar}
      ancho={480}
    >
      <CargaInicialFicha
        modoInicial={modoInicial}
        trenInicial={tren}
        onCreada={onCreada}
      />
    </GlassModal>
  )
}
