import {
  ClipboardList,
  History,
  LayoutDashboard,
  LineChart,
  PackageSearch,
  Settings,
  TrainFront,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type ItemSidebar = {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  // Migración de Excel es exclusiva de administrador (ver CLAUDE.md /
  // RolesGuard del backend) — el ítem se oculta para el resto de roles en
  // vez de mostrarse deshabilitado, mismo criterio que el resto del nav.
  soloAdministrador?: boolean
}

export type SeccionSidebar = {
  titulo: string
  items: ItemSidebar[]
}

// Agrupación propia de EVA (no la genérica "Operación/Análisis/
// Administración" del styles.md de referencia, que no mapea a los módulos
// reales de la app) — ver Inicio.tsx para la misma lista de módulos
// funcionales en formato bento.
export const SECCIONES_SIDEBAR: SeccionSidebar[] = [
  {
    titulo: 'Mediciones',
    items: [
      { etiqueta: 'Dashboard', ruta: '/', icono: LayoutDashboard },
      { etiqueta: 'Mediciones', ruta: '/mediciones', icono: ClipboardList },
      { etiqueta: 'Flota', ruta: '/fleet', icono: TrainFront, soloAdministrador: true },
    ],
  },
  {
    titulo: 'Análisis',
    items: [
      { etiqueta: 'Trazabilidad', ruta: '/trazabilidad', icono: LineChart },
      { etiqueta: 'Proyección', ruta: '/proyeccion', icono: TrendingUp },
      { etiqueta: 'Historial', ruta: '/historial', icono: History },
    ],
  },
  {
    titulo: 'Operaciones',
    items: [
      { etiqueta: 'Operaciones', ruta: '/operaciones', icono: Wrench },
      { etiqueta: 'Inventario', ruta: '/inventario', icono: PackageSearch },
      { etiqueta: 'Configuración', ruta: '/configuracion', icono: Settings, soloAdministrador: true },
    ],
  },
]
