import {
  ClipboardList,
  Database,
  FolderUp,
  Gauge,
  LineChart,
  PackageSearch,
  PenLine,
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
      { etiqueta: 'Nuevas mediciones', ruta: '/nuevas-mediciones', icono: PenLine },
      { etiqueta: 'Mediciones', ruta: '/mediciones', icono: ClipboardList },
      { etiqueta: 'Flota', ruta: '/fleet', icono: TrainFront, soloAdministrador: true },
      { etiqueta: 'Relación de bogies', ruta: '/relacion-bogies', icono: Database },
      { etiqueta: 'Migración', ruta: '/migracion', icono: FolderUp, soloAdministrador: true },
    ],
  },
  {
    titulo: 'Análisis',
    items: [
      { etiqueta: 'Trazabilidad', ruta: '/trazabilidad', icono: LineChart },
      { etiqueta: 'Tasa de desgaste', ruta: '/tasa-desgaste', icono: Gauge },
      { etiqueta: 'Proyección', ruta: '/proyeccion', icono: TrendingUp },
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
