# Identidad visual — Metro Lima L1 (frontend-ts)

Guía de estilo extraída del código en `src/`. Documenta tokens, componentes y
patrones tal como están implementados hoy — no es un ideal aspiracional.

## 1. Stack de estilos

- **Tailwind CSS v4** (`@import "tailwindcss"` en [src/index.css](src/index.css)), sin `tailwind.config.*` — todo el theming vive en CSS (`@theme inline`) y en variables custom.
- **shadcn/ui** como base de componentes (`components.json`: style `base-nova`, baseColor `neutral`, iconLibrary `lucide`, sin prefijo de clases).
- **Base UI** (`@base-ui/react`) como capa de primitives sin estilo debajo de shadcn (Button, Dialog, Select, Tabs, Input, Toggle...).
- `class-variance-authority` (cva) para variantes de componentes, `tailwind-merge` + `clsx` vía el helper `cn()` ([src/lib/utils.ts](src/lib/utils.ts)).
- `tw-animate-css` para utilidades de animación de entrada/salida (`data-open:animate-in`, `zoom-in-95`, etc.).
- `framer-motion` para transiciones de página.
- `lucide-react` como única librería de iconos.
- `recharts` para gráficos del dashboard.

## 2. Paleta de color

Todos los tokens están definidos como custom properties en `:root` dentro de
[src/index.css](src/index.css) y expuestos a Tailwind vía `@theme inline`
(`bg-primary`, `text-muted-foreground`, `border-border`, etc.).

### 2.1 Tokens semánticos shadcn (modo claro — el único activo en la app)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#f8fafc` (slate-50) | Fondo general de la app |
| `--foreground` | `#1e293b` (slate-800) | Texto principal |
| `--card` / `--popover` | `#ffffff` | Fondo de cards, modales, dropdowns |
| `--card-foreground` / `--popover-foreground` | `#1e293b` | Texto sobre card/popover |
| `--primary` | `#059669` (emerald-600) | Color de marca — botones primarios, focus, acentos |
| `--primary-foreground` | `#ffffff` | Texto sobre primary |
| `--secondary` / `--muted` | `#f1f5f9` (slate-100) | Fondos secundarios, hover suave |
| `--secondary-foreground` | `#1e293b` | Texto sobre secondary |
| `--muted-foreground` | `#64748b` (slate-500) | Texto secundario / descripciones |
| `--accent` | `#ecfdf5` (emerald-50) | Fondo de acento suave |
| `--accent-foreground` | `#047857` (emerald-700) | Texto de acento |
| `--destructive` | `#dc2626` (red-600) | Errores, acciones destructivas |
| `--border` | `#e2e8f0` (slate-200) | Bordes por defecto |
| `--input` | `#cbd5e1` (slate-300) | Borde de inputs |
| `--ring` | `#10b981` (emerald-500) | Focus ring |

**Modo oscuro (`.dark`)**: existe como scaffold genérico de shadcn (escala de
grises en OKLCH, sin acentos de marca) pero **no está cableado**: no hay
`ThemeProvider` ni toggle de tema en la UI — `next-themes` solo se usa dentro
de `sonner.tsx` para que los toasts hereden `theme="system"`. En la práctica
toda la app se renderiza en modo claro.

### 2.2 Radios (`--radius: 0.75rem` = 12px, base)

| Token | Fórmula | Valor |
|---|---|---|
| `--radius-sm` | `radius * 0.6` | 7.2px |
| `--radius-md` | `radius * 0.8` | 9.6px |
| `--radius-lg` | `radius * 1` | 12px |
| `--radius-xl` | `radius * 1.4` | 16.8px |
| `--radius-2xl` | `radius * 1.8` | 21.6px |
| `--radius-3xl` | `radius * 2.2` | 26.4px |
| `--radius-4xl` | `radius * 2.6` | 31.2px |

La UI tiende a redondeos generosos: cards `rounded-xl`, botones/inputs
`rounded-lg`, badges y tabs/segmented-control `rounded-4xl`/`rounded-full`,
metric cards del dashboard `rounded-[28px]`.

### 2.3 Sidebar (paleta propia, siempre oscura)

| Token | Valor |
|---|---|
| `--sidebar` | `#0f172a` (slate-900) |
| `--sidebar-foreground` | `#e2e8f0` |
| `--sidebar-primary` | `#10b981` |
| `--sidebar-accent` | `rgba(16,185,129,0.14)` |
| `--sidebar-border` | `rgba(148,163,184,0.18)` |

La sidebar **no** sigue el token `--sidebar` plano en producción: usa la
clase `.metro-sidebar-cinematic` (ver §5.1), un fondo mucho más elaborado
(gradientes radiales + scanlines) que corre por encima de estos tokens base.

### 2.4 Tokens "Metro" (marca, no shadcn)

```
--metro-primary:        #059669
--metro-primary-light:  #10b981
--metro-primary-dark:   #047857
--metro-sidebar-from:   #02050b
--metro-sidebar-mid:    #050914
--metro-sidebar-to:     #0a1220
--metro-sidebar-glow:   #7fb8c9
--metro-bg-secondary:   #f8fafc
--metro-bg-tertiary:    #f1f5f9
--metro-text-secondary: #64748b
--metro-text-tertiary:  #94a3b8
--metro-shadow-sm: 0 1px 3px rgba(15,23,42,.08)
--metro-shadow-md: 0 8px 24px rgba(15,23,42,.10)
```

### 2.5 Colores de estado del ciclo de vida de ruedas

Tokens declarados en `:root` para el dominio (fase/estado de una rueda):

| Estado | Color | Fondo |
|---|---|---|
| Nuevo | `#1976d2` (azul) | `#eff6ff` |
| Óptimo | `#10b981` (emerald) | `#ecfdf5` |
| Monitoreo | `#f59e0b` (amber) | `#fffbeb` |
| Alerta | `#f97316` (orange) | `#fff7ed` |
| Crítico | `#dc2626` (red) | `#fef2f2` |

**Nota de consistencia**: los componentes que renderizan estos estados
(`estado-badge.tsx`, `semaforo-badge.tsx`, `rueda-cell.tsx`) **no** consumen
estos tokens CSS directamente — usan utilidades Tailwind del palette estándar
(`green-500`, `yellow-400`, `orange-500`, `red-500`) con la misma semántica
de color pero sin ser la misma fuente de verdad. Al tocar estos componentes,
tené en cuenta que hay dos definiciones paralelas de la misma escala
semántica.

Escala de 5 niveles (semáforo de mediciones, ver `semaforo-utils.ts`):
`NORMAL` (verde) → `ALERTA` (naranja) → `CRITICO` (rojo, pulsa) →
`PRIORIDAD` (rojo, pulsa) → `BLOQUEADO` (rojo oscuro + ícono de candado).

### 2.6 Theming bicolor por fabricante

Canal de acento **subordinado** al sistema shadcn (no reemplaza
primary/secondary), pensado para pintar selectivamente bordes, badges y
estados activos ligados a un fabricante de tren:

```
:root                        → --fabricante-accent: oklch(0.546 0.038 230)  /* slate neutro */
:root[data-fabricante='alstom']  → oklch(0.602 0.156 165)  /* verde esmeralda Alstom */
:root[data-fabricante='ansaldo'] → oklch(0.583 0.218 25)   /* rojo Ansaldo */
```

Reglas de uso documentadas in-line en `index.css`:
- ✔ `border-l` de 2–3px en cards/secciones de un fabricante
- ✔ Badges sutiles (`bg-accent` + `text-accent-foreground`)
- ✔ Active state en `FabricanteSelector`, líneas de charts
- ✘ Fondos completos de cards o páginas
- ✘ Bordes "principales" (esos van con `--border` neutro)

Ver también `DASHBOARD_THEME` en
[src/components/dashboard/dashboard-theme.ts](src/components/dashboard/dashboard-theme.ts):
cada tipo de tren (`ALSTOM` / `ANSALDO`) define su propio set de acentos
(`text-emerald-700` / `text-red-700`), glow de sombra y colores de charts —
usado en las KPI cards y gráficos del Dashboard.

## 3. Tipografía

- Fuente única: **Inter**, vía stack de sistema —
  `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  (declarada en `body` y en `--font-sans`/`--font-heading`, que apunta al
  mismo stack). No hay `@font-face` ni carga de webfont: si el SO no tiene
  Inter instalada, se degrada a la fuente del sistema.
  - `@fontsource-variable/geist` está en `package.json` pero **no se
    importa en ningún lado** — dependencia sin usar.
- Sin escala tipográfica centralizada: los tamaños se aplican inline con
  utilidades Tailwind (`text-xs` a `text-3xl`) según el componente.
- Clases de página reutilizables (`index.css`):
  - `.metro-page-title` → `font-size: 2rem; font-weight: 700; line-height: 1.2` — título H1 de cada pantalla.
  - `.metro-page-subtitle` → `font-size: 0.938rem; line-height: 1.5rem; color: var(--metro-text-secondary)` — bajada debajo del título.
- `CardTitle` usa `font-heading` (= Inter) `text-lg font-semibold`.
- Números destacados (KPIs) suelen ir en `text-3xl font-bold tracking-tight`
  o, en las metric cards con imagen de fondo, tamaños fluidos con
  `clamp()` (`text-[clamp(1.05rem,11cqw,1.875rem)]`) para adaptarse al
  contenedor.
- Microcopy (badges, labels de sección de sidebar) usa
  `text-[10px]`–`text-xs`, a menudo `uppercase tracking-[0.14em] font-semibold`.

## 4. Layout de la aplicación

Estructura fija de shell (`MainLayout`, [src/components/layout/main-layout.tsx](src/components/layout/main-layout.tsx)):

```
h-svh flex overflow-hidden
├── <Sidebar />              — columna fija, alto completo, no scrollea
└── flex-1 flex-col
    ├── <TopBar />           — h-16, breadcrumbs + acciones
    └── <main overflow-auto> — único elemento que scrollea, p-6 lg:p-8
```

- **Transiciones de ruta**: `framer-motion`, fade + slide-y de 4px, 150ms
  `easeOut`, keyed por `location.pathname` — sutil, sin rebote.
- **Sidebar** (`Sidebar`, 256px expandida / 80px colapsada, colapso
  persistido en `localStorage`):
  - Fondo `.metro-sidebar-cinematic`: gradiente vertical oscuro
    (`#080b13` → `#0a1020` → `#0d1728` → `#14283a`) + radiales verdes tenues
    simulando iluminación ambiental + capa de scanlines (`repeating-linear-gradient`
    con `mix-blend-mode: screen`) — busca una estética "sala de control /
    cinemática" coherente con el dominio (operación de Metro).
  - Logo (`/images/linea1logo.png`) + wordmark "Metro Lima / Gestión".
  - Toggle de colapso: botón circular negro flotante en el borde derecho
    (`translate-x-1/2`), sale del contenedor.
  - Ítems de navegación agrupados en 3 secciones fijas: **Operación** →
    **Análisis** → **Administración** (ver `sidebar-items.ts`), con headers
    de sección en mayúsculas/tracking ancho, ocultos en modo colapsado.
  - Item activo: `translate-x-1`, línea indicadora animada a la izquierda
    (`metroSidebarIndicatorIn` + glow), ícono con `drop-shadow`.
  - Footer: `UserMenu` envuelto en `GlassSurface` (ver §5.2).
- **TopBar**: fondo `bg-card`, breadcrumbs (`Metro Lima L1 › Módulo › Sub-ítem`)
  a la izquierda, 3 botones-ícono circulares a la derecha (manual, notificaciones,
  logout) con hover `-translate-y-0.5 scale-110`.
- **Fondo de página**: `bg-background` (`#f8fafc`) en toda la superficie de contenido.

## 5. Efectos visuales de marca (signature)

### 5.1 Liquid glass (glassmorphism)

Dos utilidades CSS reutilizables, usadas en cards y paneles que quieren
sensación "premium" / flotante:

- `.liquid-glass-card` — fondo semitransparente en gradiente diagonal,
  `backdrop-filter: blur(18px) saturate(145%)`, sombra + inset highlights.
  **Es la clase base de `<Card>`** (`components/ui/card.tsx`), o sea que
  *toda* card de la app tiene este efecto por defecto.
- `.liquid-glass-panel` — variante más oscura/saturada con un sweep de
  brillo diagonal en `:hover` (`::after`, transición de `left`), pensada
  para paneles sobre fondos oscuros.

### 5.2 `GlassSurface` (componente)

[src/components/ui/glass-surface.tsx](src/components/ui/glass-surface.tsx) —
implementación "liquid glass" avanzada con distorsión real vía SVG
(`feDisplacementMap` + `feImage` generado dinámicamente según el tamaño del
contenedor), con fallback a `backdrop-filter` CSS plano en navegadores sin
soporte (Safari/Firefox) y fallback adicional sin blur si tampoco hay
`backdrop-filter`. Se usa en el footer de la sidebar para envolver el
`UserMenu`. Detecta dark mode vía `matchMedia`.

### 5.3 Banda operacional

`.metro-operational-band` — banda hero con imagen de fondo
(`/images/wallpapercentrooperaciones.png`) + overlay en gradiente
`135deg, #047857 → #0f172a`, altura fluida `clamp(220px, 15vw, 420px)` y
glow verde (`box-shadow: 0 12px 28px rgba(10,253,176,.22)`). Usada en
pantallas de bienvenida/portal.

### 5.4 Micro-animaciones de estado

- `animate-breathe-critico` — pulso de opacidad + shadow rojo (1.8s loop)
  para llamar la atención sobre elementos en estado **CRÍTICO** sin marear.
- `animate-flota-train-glow` / `animate-flota-train-tint` — glow pulsante
  (2.4s) aplicado a trenes en las vistas de flota, color parametrizado por
  `--flota-train-glow`.
- Indicador activo de sidebar: `metroSidebarIndicatorIn` (entrada con blur +
  scale) + `metroSidebarIndicatorGlow` (pulso de box-shadow celeste).
- Botón de notificaciones: `metroBellShake` en hover.
- Valores numéricos de KPIs (`DashboardMetricCard`): count-up animado con
  `requestAnimationFrame` y easing cúbico (900ms) al cargar el dato.

## 6. Componentes UI (`src/components/ui`, shadcn + Base UI)

Todos siguen el patrón: primitive de Base UI + `cva` para variantes +
`cn()` para merge de clases + `data-slot` para hooks de estilo externos.

- **Button** — variantes `default` (primary, hover `bg-emerald-500` +
  `-translate-y-0.5`), `outline`, `secondary`, `ghost`, `destructive`
  (glow rojo en hover: `hover:shadow-[0_0_14px_rgba(239,68,68,.92)]`),
  `link`. Tamaños `xs/sm/default/lg` + variantes `icon-*` cuadradas.
  Al hacer click, se desplaza `translate-y-px` (sensación de "press").
- **Badge** — `rounded-4xl` (píldora), variantes `default/secondary/
  destructive/outline/ghost/link`, altura fija `h-5`, texto `text-xs`.
- **Card** — `liquid-glass-card` + `rounded-xl border shadow-sm`;
  subcomponentes `CardHeader/CardTitle/CardDescription/CardAction/
  CardContent/CardFooter` (footer con `bg-muted/50` y borde superior).
- **Input / Textarea** — controlados vía selector global en `index.css`
  (no vía el componente shadcn): borde `#cbd5e1`, `rounded-[0.95rem]`,
  focus → borde `#10b981` + halo `box-shadow rgba(16,185,129,.22)`.
- **Select** — trigger y contenido **siempre en negro** (`bg-black
  text-white`, incluso en light mode) con ítems que iluminan en hover
  (`drop-shadow` blanco sutil) — es el componente con look más
  distintivo/oscuro de toda la librería, contrastando con el resto de
  la UI en claro. Ícono chevron y checks siempre blancos.
- **Tabs** — lista con thumb animado (`data-active` trackeado con
  `MutationObserver`/`ResizeObserver`), thumb negro (`bg-black`),
  transición `cubic-bezier(0.22,1,0.36,1)` 300ms. Variante `line` para
  tabs subrayados sin fondo.
- **SegmentedControl** (custom, no shadcn) — mismo lenguaje visual que
  Tabs: cápsula `rounded-full border bg-card`, thumb negro animado.
- **Dialog** — overlay `bg-black/10` + blur, popup centrado
  `rounded-lg border shadow-lg`, animaciones `zoom-in-95`/`fade-in-0`
  vía `data-open`/`data-closed` (tw-animate-css). Footer con
  `bg-muted/50` + borde superior, botones alineados a la derecha.
- **Tooltip, DropdownMenu, ToggleGroup, Toggle, Avatar, DateInput,
  Table, Label** — siguen el mismo lenguaje (`rounded-lg`/`rounded-md`,
  `border-border`, `shadow-sm`, focus ring `ring-3 ring-ring/50`).
- **EmptyState / ErrorState** — icono en círculo `bg-muted` (o
  `bg-destructive/10` para error) + título + descripción + acción
  opcional, centrado. Patrón único para "sin datos" y "algo salió mal"
  en toda la app.
- **Skeleton** — `animate-pulse bg-muted`, duración 2s.

### 6.1 Selectores/inputs "oscuros" fuera del kit

Existe una variante manual `.ops-light-select` (chevron SVG inline,
`color: #334155`) para selects nativos que necesitan verse claros — convive
con el estilo negro global de `select` en `index.css`, así que es la
excepción explícita al patrón oscuro.

## 7. Iconografía e imágenes

- **Iconos**: exclusivamente `lucide-react`, tamaño por defecto `size-4`
  dentro de botones/badges (`[&_svg:not([class*='size-'])]:size-4`), stroke
  por defecto de Lucide.
- **Imágenes de marca** (`public/images/`):
  - `linea1logo.png` — logo institucional (sidebar).
  - `wallpapercentrooperaciones.png` — wallpaper del "centro de operaciones" (banda hero).
  - `alstomicon.png` / `ansaldoicon.png` — íconos de fabricante.
  - `cardcochealstom{1..6}.png` / `cardcocheab{1..6}.png` — ilustraciones
    de coche de tren usadas como fondo de las KPI cards del dashboard,
    una serie distinta por fabricante (Alstom vs. Ansaldo/AB).
  - `mediciones-tren-alerta-{alstom,ansaldo}.png` — ilustraciones de
    alerta en el flujo de mediciones.
  - `ruedaiconparesmontados.png` — ícono de par montado de ruedas.

## 8. Elevación y bordes

- Sombras casi siempre **compuestas** (no solo `box-shadow` de Tailwind):
  combinación de sombra difusa + glow de color + insets para el efecto
  glass (ver `.liquid-glass-card`, `GlassSurface`).
- Glows de color con semántica de marca: verde/emerald para éxito y marca
  (`rgba(34,197,94,*)`, `rgba(16,185,129,*)`), rojo para crítico/destructivo
  (`rgba(239,68,68,*)`), específicos por fabricante en el dashboard.
- Bordes por defecto en `--border` (`#e2e8f0`, gris muy claro); casi todo
  componente interactivo define su propio `focus-visible:ring-3
  ring-ring/50` (halo verde de 3px) — consistente en Button, Input, Badge,
  Tabs, Dialog.

## 9. Idioma y tono de contenido

Toda la UI está en **español (es-PE/es-AR mixto en formateo numérico)**,
con textos de dominio ferroviario/mantenimiento (ruedas, bogies, ejes,
reperfilado, semáforo de mediciones). Números y fechas se formatean con
`Intl.NumberFormat`/`toLocaleString` (`es-PE`, `es-AR` aparecen ambos en el
código — sin un locale único centralizado).

## 10. Resumen de principios de diseño (inferidos del código)

1. **Verde esmeralda (`#059669`/`#10b981`) como color de marca** — botones
   primarios, focus rings, glow de éxito, identidad de Alstom.
2. **Rojo como semántica exclusiva de "crítico/destructivo"** — nunca se
   usa decorativamente; siempre implica alerta o coincide con Ansaldo.
3. **Sidebar oscura cinemática vs. resto de la app en claro** — fuerte
   contraste intencional entre "sala de control" (sidebar) y "mesa de
   trabajo" (contenido).
4. **Glassmorphism como lenguaje transversal** — cards, panel de usuario y
   overlays comparten blur + saturate + gradiente diagonal, no solo la
   sidebar.
5. **Redondeos generosos y consistentes** — de `rounded-lg` (botones/inputs)
   a full-pill (badges, tabs, segmented control), casi nunca esquinas vivas.
6. **Feedback de estado por color + forma**, no solo color: los estados de
   rueda combinan color, ícono (candado en `BLOQUEADO`) y animación
   (pulso en crítico) para redundancia accesible.
7. **Motion sutil, nunca "bouncy"**: easing `easeOut`/`cubic-bezier(0.22,1,0.36,1)`,
   duraciones cortas (150–300ms) en casi todas las transiciones de UI.
