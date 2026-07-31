// Datos estáticos de la galería de componentes (ver /styles.md en la raíz).
// Vive separado de los componentes de presentación para que la página en sí
// (src/pages/Galeria.tsx) quede como pura composición.

export type Swatch = { nombre: string; variable: string; hex: string }

export const paletaDominante: Swatch[] = [
  { nombre: 'Verde institucional', variable: '--color-verde-institucional', hex: '#1B8A56' },
  { nombre: 'Verde oscuro', variable: '--color-verde-oscuro', hex: '#0F5C39' },
  { nombre: 'Verde claro', variable: '--color-verde-claro', hex: '#DCEFE2' },
  { nombre: 'Blanco', variable: '--color-blanco', hex: '#FFFFFF' },
]

export const paletaApoyo: Swatch[] = [
  { nombre: 'Arena', variable: '--color-arena', hex: '#E7DDC9' },
  { nombre: 'Arena suave', variable: '--color-arena-suave', hex: '#F3EEE2' },
  { nombre: 'Gris concreto', variable: '--color-gris-concreto', hex: '#8C897F' },
  { nombre: 'Gris concreto oscuro', variable: '--color-gris-concreto-oscuro', hex: '#55524A' },
]

export const paletaSemantica: Swatch[] = [
  { nombre: 'Estado OK', variable: '--color-estado-ok', hex: '#1B8A56' },
  { nombre: 'Seguimiento', variable: '--color-estado-seguimiento', hex: '#C79A3E' },
  { nombre: 'Cambio', variable: '--color-estado-cambio', hex: '#C2703C' },
  { nombre: 'Crítico', variable: '--color-estado-critico', hex: '#B33B3B' },
]

export type TarjetaEstado = {
  clase: string
  span: string
  color: string
  label: string
  desc: string
  pulso: boolean
}

export const tarjetasEstado: TarjetaEstado[] = [
  { clase: 'glass-card--estado-ok', span: 'lg:col-span-2', color: 'var(--color-estado-ok)', label: 'OK', desc: '288 discos dentro de rango', pulso: false },
  { clase: 'glass-card--estado-seguim', span: '', color: 'var(--color-estado-seguimiento)', label: 'Seguimiento', desc: '14 discos a observar', pulso: false },
  { clase: 'glass-card--estado-cambio', span: '', color: 'var(--color-estado-cambio)', label: 'Cambio', desc: '5 discos para reemplazo', pulso: false },
  { clase: 'glass-card--estado-critico', span: 'lg:col-span-4', color: 'var(--color-estado-critico)', label: 'Crítico', desc: '2 discos fuera de norma', pulso: true },
]

// Estados de la tabla de mediciones (§6.1) — anulan los semánticos §6 dentro
// de la tabla, drawer de detalle y export a Excel. Nombres alineados 1:1 con
// los sufijos de .tabla-chip--* para que el mapeo sea directo.
export type EstadoTabla = 'ok' | 'seguimiento' | 'cambio' | 'critico'

export const etiquetaEstadoTabla: Record<EstadoTabla, string> = {
  ok: 'OK',
  seguimiento: 'Seguimiento',
  cambio: 'Cambio',
  critico: 'Crítico',
}

export type FilaTabla = {
  disco: string
  t: string
  h: string
  rd: string
  estado: EstadoTabla
  reperfilado?: boolean
}

export const filasTabla: FilaTabla[] = [
  { disco: 'D-1042', t: '12.4', h: '3.8', rd: '0.62', estado: 'ok' },
  { disco: 'D-1043', t: '9.1', h: '5.2', rd: '0.41', estado: 'seguimiento' },
  { disco: 'D-1044', t: '6.3', h: '6.7', rd: '0.18', estado: 'cambio' },
  { disco: 'D-1045', t: '4.1', h: '6.9', rd: '0.22', estado: 'seguimiento', reperfilado: true },
  { disco: 'D-1046', t: '3.0', h: '7.9', rd: '0.05', estado: 'critico' },
]

// Escala tipográfica de styles.md §3 — 72/96 son exclusivos de piezas hero.
export const escalaTipografica = [12, 14, 16, 20, 28, 40, 56, 72, 96] as const

export type NavItem = { href: string; label: string }

export const navItems: NavItem[] = [
  { href: '#tipografia', label: 'Tipografía' },
  { href: '#liquid-glass', label: 'Liquid Glass' },
  { href: '#widgets', label: 'Widgets' },
  { href: '#tarjetas-estado', label: 'Tarjetas de estado' },
  { href: '#movimiento', label: 'Movimiento' },
  { href: '#paleta', label: 'Paleta' },
  { href: '#tabla', label: 'Tabla' },
  { href: '#fondos', label: 'Fondos' },
  { href: '#aviso', label: 'Aviso' },
  { href: '#drawer', label: 'Drawer' },
]
