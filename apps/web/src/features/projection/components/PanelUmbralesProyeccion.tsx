import { PanelParametros } from '../../system-params/components/PanelParametros'

// Conserva el punto de montaje de la pantalla de Proyección, pero su
// contenido es la misma card de Parámetros filtrada para este módulo.
export function PanelUmbralesProyeccion() {
  return <PanelParametros modulo="proyeccion" />
}
