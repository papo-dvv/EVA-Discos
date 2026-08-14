// Mismo texto en la card principal (PanelPromedioPorTren) y en cada celda del
// modal (ModalPromedioPorTren) — un tren/combinación con menos de 20 pares
// igual calcula su promedio (ver CONTEO_MINIMO_CALCULABLE_POR_TREN en el
// backend), solo que con menos respaldo estadístico. Archivo aparte (en vez
// de vivir en PanelPromedioPorTren.tsx) porque un export no-componente ahí
// rompe react-refresh/only-export-components.
export function textoAdvertenciaDatosLimitados(conteoParesUsados: number): string {
  return `⚠ Solo ${conteoParesUsados} pares en este rango — se necesitan 20 para límites confiables. Los valores de abajo se calcularon igual, tómalos como referencia.`
}
