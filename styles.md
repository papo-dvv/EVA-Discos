# Sistema de Diseño — UNNA Trazabilidad
### "Del gris de la arena al verde de la acción"

Frontend: React + Vite. Tema único claro (no se implementa modo oscuro). Dirección de arte: **una app de widgets estilo Apple** construida sobre Liquid Glass con **efecto burbuja marcada y textura** (vidrio esmerilado, doble brillo especular, curvatura de burbuja e iridiscencia sutil de jabón). La unidad de composición primaria es el **widget** (§4.1); el material que lo sostiene es el glass texturado (§4) — ver §2 para el orden de prioridades de todo este documento.

---

## 1. Concepto

El tren de la Línea 1 (verde institucional + franja blanca) es el hilo conductor visual, no un acento decorativo. La identidad se construye en dos capas:

- **Capa base — origen:** arena suave y gris concreto. Representan la tierra de Villa El Salvador y la autoconstrucción vecinal. Es el fondo, el punto de partida, siempre discreto.
- **Capa de transformación — acción:** verde esperanza y blanco. Representan el tren, los parques y las bermas que florecieron en el desierto. Es el color que aparece en lo que importa: estados OK, acciones primarias, datos destacados.

**Elementos estructurales que refuerzan el concepto (apoyo, no protagonismo — ver §2 para la dirección de arte completa):**
- **Cuadrícula de manzanas:** patrón de líneas finas de fondo, evoca el trazado urbano ordenado del distrito.
- **Textura de concreto:** puntillado sutil, aporta peso urbano sin ensuciar la superficie.
- **Degradado tierra → verde:** de opacidad a brillo. Se usa en piezas grandes (portadas, separadores de sección, fondo del login), no en componentes pequeños.
- **Engranajes cayendo:** animación de fondo exclusiva de pantallas de solo aviso (ver §7.1). Evoca el mecanismo siempre en marcha detrás de la app, incluso cuando la pantalla no tiene más que un mensaje para el usuario.

**Señal de identidad (elemento distintivo de la app):** las tarjetas de estado usan siempre un borde-glow sutil en el color semántico correspondiente en vez de un fondo sólido de color — así el verde/blanco del tren queda reservado para lo positivo y lo activo, y los demás estados se leen como "todavía no llegamos a la meta", no como alarmas agresivas.

### 1.1 Nombre y wordmark

**EVA** — de Línea 1 de Lima

- "EVA" es el nombre del producto: siempre en `--font-display`, peso 700, protagonista absoluto. Color `--color-verde-oscuro` sobre fondos claros/degradado, `--color-gris-concreto-oscuro` si el fondo es muy claro.
- "de Línea 1 de Lima" es la línea de contexto, nunca el nombre en sí: siempre en `--font-body`, tamaño pequeño (11–12px), peso 400-500, mayúsculas con tracking amplio (`letter-spacing: 0.14em`), color `--color-gris-concreto` (o `--color-verde-oscuro` al 70% sobre el degradado). Va inmediatamente debajo o al lado de "EVA", nunca con el mismo peso visual.
- Relación de tamaño mínima 3:1 entre "EVA" y la línea de contexto — igual que un título grande de Apple con su línea de producto chiquita debajo (ej. "iPhone" / "16 Pro"). El wordmark funciona como marca persistente: aparece en el header, en un nav flotante sticky (ver §9) y en el splash, siempre con el mismo tratamiento.

---

## 2. Dirección de arte — prioridad Apple

Esta sección manda sobre el resto del documento cuando hay tensión entre "quedarse corto" y "ir a fondo" con la ejecución. El concepto de marca (§1) no cambia — lo que cambia es cuánto se nota la ejecución:

1. **Transparencia y profundidad primero.** Todo elemento flotante (tarjeta, botón, chip, drawer, nav) es glass por default — ver §4. El panel opaco es la excepción, no la norma.
2. **Tipografía como jerarquía primaria.** El tamaño y el peso comunican qué es importante antes que el color. Los números grandes (`--font-display`) son el elemento más protagonista de cualquier pantalla — ver §3.
3. **Movimiento con propósito.** Nada estático se debe sentir "muerto": todo lo interactivo responde al hover/press, el fondo respira. Pero nada compite por atención todo el tiempo — ver §5, regla de "vivo, no ruidoso".
4. **Espacio negativo generoso.** Más ritmo vertical entre secciones grandes que el que se sentiría "seguro" — el aire es parte del diseño, no un descuido.
5. **Forma orgánica sobre esquinas duras.** Interactivos siempre en píldora (`999px`). Superficies con radios squircle generosos (esquinas continuas, tipo widget de iOS): `--glass-radius: 34px`, `--glass-radius-lg: 44px` para piezas hero/drawers, `--glass-radius-sm: 26px` para widgets chicos.
6. **El widget como unidad de composición.** Las pantallas se arman como una grilla bento de widgets glass (§4.1), no como bloques de layout planos — igual que una home screen o el Centro de Control de Apple.

**Excepción explícita:** la tabla de mediciones (§6.1) queda **fuera** de esta prioridad estética. Ahí manda la legibilidad de accesibilidad — colores sólidos de alto contraste, cero glass, cero movimiento nuevo — porque es la herramienta de trabajo diaria de técnicos y supervisores, no una pieza de marca. Aplicar "más Apple" ahí sería, literalmente, peor producto.

Los elementos de fondo continuo (cuadrícula, textura de concreto, engranajes) se mantienen "con intención, no con ausencia": siguen siendo apoyo atmosférico, nunca protagonismo — no se les sube la opacidad ni el movimiento solo porque el resto del sistema se vuelve más intenso.

---

## 3. Tipografía

Dos roles: una display con carácter geométrico-institucional (señalética de transporte) y una utilitaria para datos tabulares. Dentro del contenido, el tamaño y el peso tipográfico comunican qué es importante antes que el color (§2, prioridad #2) — pero el glass sigue siendo la capa de material que sostiene esa jerarquía (§2, prioridad #1): la tipografía manda sobre el color, no sobre el glass. Los números grandes flotan siempre sobre una superficie glass, nunca reemplazan su tratamiento.

```css
:root {
  --font-display: 'General Sans', 'Space Grotesk', system-ui, sans-serif; /* títulos, KPIs grandes */
  --font-body:    'Inter', system-ui, sans-serif;                        /* texto de interfaz */
  --font-data:    'IBM Plex Mono', 'JetBrains Mono', monospace;          /* valores T, H, Rd, tablas */
}
```

**Carga real de las fuentes (obligatoria):** sin `<link>`/`@font-face`, estos nombres caen a `system-ui` (Segoe UI en Windows) y se pierde por completo el carácter buscado — nunca se ve "tipo Apple" así. Cargar en `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://api.fontshare.com/v2/css?f[]=general-sans@500,600,700&display=swap" rel="stylesheet">
```

- **Display:** peso 600-700, tracking ajustado (`-0.01em` a `-0.02em` en tamaños grandes) — evoca la tipografía de señalética de estaciones. Los números KPI (ej. "288" discos evaluados) pueden subir hasta 72–96px en piezas hero; nunca bajan de 40px cuando son el protagonista de la pantalla.
- **Body:** peso 400-500, para todo el texto de interfaz, labels, descripciones.
- **Data (mono):** exclusiva para valores numéricos de medición (T, H, Rd) en tablas y tarjetas de detalle — el monoespaciado ayuda a comparar cifras de un vistazo y le da un carácter "de instrumento de medición" a los datos del escáner.

Escala tipográfica (rem): `12 / 14 / 16 / 20 / 28 / 40 / 56 / 72 / 96` — los dos últimos son nuevos, exclusivos de piezas hero.

---

## 4. Liquid Glass — burbuja marcada con textura

Sobre fondos claros, el glass funciona distinto que en dark mode: en vez de aclarar sobre oscuridad, el glass debe **enfriar y suavizar** sobre la calidez de la arena.

**Referencia: "burbuja de jabón", no "panel".** Mucho más transparente que un panel opaco, con blur/saturación/brillo altos para que se lea como vidrio y no como opacidad baja. Cuatro rasgos definen la burbuja marcada:

1. **Textura de vidrio esmerilado (grano).** Una capa de ruido (`--glass-grano`, SVG `fractalNoise` tileado) mezclada con `soft-light` sobre el fondo translúcido — le da grano real de vidrio, no una superficie plástica lisa.
2. **Doble brillo especular pronunciado.** Foco de luz superior-izquierdo + rim inferior-derecho (`::before`), más intensos que en un panel, para leer la curvatura.
3. **Menisco curvo del borde** (`--glass-menisco`, inset shadow) que simula el grosor y la curva del borde de la burbuja.
4. **Iridiscencia de jabón** (`--glass-iridiscencia`, opt-in `.glass-surface--iris`): un brillo cónico verde/blanco muy tenue en los bordes.

Regla dura: **cuanto más transparente, más blur y saturate hacen falta para compensar — nunca bajar uno sin subir el otro.**

```css
:root {
  --glass-bg:               rgba(255, 255, 255, 0.20); /* muy transparente a propósito */
  --glass-bg-strong:        rgba(255, 255, 255, 0.36);
  --glass-border:           rgba(255, 255, 255, 0.60);
  --glass-blur:             34px;
  --glass-blur-strong:      48px; /* drawers, hero — compensa la mayor transparencia de --strong */
  --glass-saturate:         200%;
  --glass-brightness:       1.07;
  --glass-shadow-ambient:   0 44px 96px -26px rgba(15, 92, 57, 0.18); /* sombra larga, tinte verde */
  --glass-shadow-contact:   0 12px 28px rgba(85, 82, 74, 0.12); /* sombra corta, de contacto */
  --glass-highlight-top:    rgba(255, 255, 255, 0.95);
  --glass-highlight-bottom: rgba(255, 255, 255, 0.42); /* rim inferior — remata el efecto burbuja */
  --glass-radius:           34px;
  --glass-radius-lg:        44px;
  --glass-radius-sm:        26px;
  /* Textura, menisco e iridiscencia — ver tokens.css para los valores completos */
  --glass-grano:            url("data:image/svg+xml,..fractalNoise.."); /* tileado, soft-light */
  --glass-grano-size:       140px;
  --glass-grano-blend:      soft-light;
  --glass-menisco:          inset 0 0 20px 2px rgba(255,255,255,0.28), inset 0 -8px 18px -6px rgba(15,92,57,0.10);
  --glass-iridiscencia:     conic-gradient(from 200deg at 50% 50%, /* verde→transparente→blanco→verde */ ...);
}

.glass-surface {
  position: relative;
  overflow: hidden;
  /* Fondo translúcido + grano esmerilado mezclado = textura de burbuja */
  background-color: var(--glass-bg);
  background-image: var(--glass-grano);
  background-size: var(--glass-grano-size) var(--glass-grano-size);
  background-blend-mode: var(--glass-grano-blend);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow:
    var(--glass-shadow-ambient),
    var(--glass-shadow-contact),
    var(--glass-menisco),                          /* curva del borde de la burbuja */
    inset 0 1px 0 var(--glass-highlight-top),
    inset 0 -1px 0 var(--glass-highlight-bottom);
  transition: transform var(--duracion-base) var(--ease-apple), box-shadow var(--duracion-base) var(--ease-apple);
}

/* Doble brillo especular tipo burbuja: superior-izquierda (luz) + inferior-derecha (rim) */
.glass-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(135% 100% at 14% -8%, rgba(255, 255, 255, 0.80) 0%, rgba(255, 255, 255, 0) 46%),
    radial-gradient(95% 75% at 90% 112%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 52%);
}

/* El contenido va por encima del grano y los brillos */
.glass-surface > * { position: relative; z-index: 1; }

.glass-surface--strong {
  background-color: var(--glass-bg-strong); /* no usar el shorthand: conservaría el grano */
  backdrop-filter: blur(var(--glass-blur-strong)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
}

/* Iridiscencia jabón (opt-in) — suma el brillo cónico sobre los focos especulares */
.glass-surface--iris::before {
  background:
    radial-gradient(135% 100% at 14% -8%, rgba(255, 255, 255, 0.80) 0%, rgba(255, 255, 255, 0) 46%),
    radial-gradient(95% 75% at 90% 112%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 52%),
    var(--glass-iridiscencia);
}

/* Tarjeta de estado: borde-glow semántico en vez de fondo sólido */
.glass-card--estado-ok       { border-color: rgba(27, 138, 86, 0.35); box-shadow: var(--glass-shadow-ambient), 0 0 0 1px rgba(27, 138, 86, 0.15); }
.glass-card--estado-seguim   { border-color: rgba(199, 154, 62, 0.35); box-shadow: var(--glass-shadow-ambient), 0 0 0 1px rgba(199, 154, 62, 0.15); }
.glass-card--estado-cambio   { border-color: rgba(194, 112, 60, 0.35); box-shadow: var(--glass-shadow-ambient), 0 0 0 1px rgba(194, 112, 60, 0.15); }
.glass-card--estado-critico  { border-color: rgba(179, 59, 59, 0.35); box-shadow: var(--glass-shadow-ambient), 0 0 0 1px rgba(179, 59, 59, 0.15); }
.glass-card--estado-reperfilado { border-color: rgba(142, 94, 120, 0.35); box-shadow: var(--glass-shadow-ambient), 0 0 0 1px rgba(142, 94, 120, 0.15); }
```

**Borde animado — modificador opt-in `.glass-surface--vivo`.** Un anillo de gradiente cónico que gira lentamente, reservado para **1-2 piezas hero como mucho** (nunca en tarjetas repetidas de una grilla — ahí se vuelve ruido, no foco):

```css
@property --eva-angulo-borde {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.glass-surface--vivo { position: relative; }

.glass-surface--vivo::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: conic-gradient(
    from var(--eva-angulo-borde),
    rgba(255, 255, 255, 0.05),
    rgba(255, 255, 255, 0.85),
    color-mix(in srgb, var(--color-verde-claro) 55%, white 45%),
    rgba(255, 255, 255, 0.05)
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  animation: eva-borde-girar 14s linear infinite;
}

@keyframes eva-borde-girar { to { --eva-angulo-borde: 360deg; } }

@media (prefers-reduced-motion: reduce) {
  .glass-surface--vivo::after { animation: none; }
}
```

**Botón primario glass (verde, con glow, forma píldora):**

```css
.glass-button-primary {
  background: linear-gradient(180deg, #22A363 0%, #1B8A56 100%);
  color: var(--color-texto-invertido);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 999px;
  box-shadow:
    0 8px 24px rgba(27, 138, 86, 0.30),
    inset 0 1px 0 rgba(255,255,255,0.5);
  transition: transform var(--duracion-base) var(--ease-apple), box-shadow var(--duracion-base) var(--ease-apple);
}
.glass-button-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(27, 138, 86, 0.40), inset 0 1px 0 rgba(255,255,255,0.6);
}
.glass-button-primary:active {
  transform: scale(0.97);
  transition-duration: var(--duracion-rapida);
  transition-timing-function: var(--ease-apple-rebote);
}
```

**Chip glass (filtros, estados en tabla):**

```css
.glass-chip {
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  padding: 6px 14px;
  font-family: var(--font-body);
  font-size: 13px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: background var(--duracion-base) var(--ease-apple);
}
.glass-chip[data-active="true"] {
  background: var(--color-verde-claro);
  border-color: rgba(27,138,86,0.4);
  color: var(--color-verde-oscuro);
}
```

**Reglas de aplicación del glass:**
- Solo en elementos flotantes: tarjetas, drawers, chips, botones, barra de navegación. Nunca como fondo de página completa.
- El blur siempre necesita algo con textura o color detrás (la cuadrícula, el degradado, el aura de §7 o una foto del patio) — sobre un fondo blanco liso el efecto se pierde. Por eso el fondo de la app nunca debe ser blanco puro.
- Botones y CTAs primarios/secundarios: forma píldora (`border-radius: 999px`), nunca esquinas cuadradas ni radios pequeños.
- La transparencia alta es intencional, pero **nunca a costa de la legibilidad**: siempre verificar contraste de texto sobre el fondo real antes de dar por buena una superficie glass. Si el texto pierde nitidez, subir `--glass-bg-strong` en vez de forzar la variante translúcida.
- `.glass-surface--vivo` es opt-in y escaso a propósito — 1-2 piezas hero por pantalla, nunca dentro de una grilla repetida.

---

## 4.1 Widgets estilo Apple

La unidad de composición primaria de EVA es el **widget**: un tile glass texturado que se ordena en una **grilla bento**, igual que una home screen de iOS o el Centro de Control. Una pantalla no es una lista de bloques planos, es una grilla de widgets de distintos tamaños.

**Tamaños (S / M / L).** El tamaño define el radio, el padding y el cuerpo del valor grande. Se combinan con `.glass-surface` (siempre glass texturado):

| Tamaño | Uso | Radio | Valor |
|---|---|---|---|
| `.eva-widget--s` | dato suelto, chip-tile, item de lista | `--glass-radius-sm` (26px) | 32px |
| `.eva-widget--m` (default) | KPI, tarjeta de módulo, acción | `--glass-radius` (34px) | 40px |
| `.eva-widget--l` | pieza hero de la pantalla | `--glass-radius-lg` (44px) | 72px |

**Anatomía (de arriba a abajo):**
1. `.eva-widget__cabecera` — fila header con `.eva-widget__glifo` (ícono en pastilla verde-claro) + etiqueta en mayúsculas, `--font-body`, tracking `0.14em`, color gris concreto.
2. `.eva-widget__valor` — el número/dato protagonista en `--font-display`, el elemento más grande del tile (§2, prioridad #2).
3. `.eva-widget__pie` — pie opcional: chips, sparkline, mini-acción o descripción corta. Se ancla al fondo (`margin-top: auto`) para que la grilla quede alineada.

```html
<div class="glass-surface eva-widget eva-widget--m eva-elevar glass-card--estado-ok">
  <div class="eva-widget__cabecera"><span class="eva-widget__glifo">◷</span> Discos OK hoy</div>
  <div class="eva-widget__valor">288</div>
  <div class="eva-widget__pie"><span class="glass-chip" data-active="true">+12 vs ayer</span></div>
</div>
```

**Tilt 3D reactivo (press estilo Apple).** El widget hero puede seguir sutilmente el puntero en 3D con `.eva-tilt` y volver con rebote al soltar. Es **motion reactivo** (responde al puntero, no corre solo) — por eso **no cuenta contra el presupuesto de 2 motions continuos de §5**. El ángulo lo aplica JS vía `--tilt-x`/`--tilt-y` (máximo `--tilt-max: 9deg`, perspectiva `--tilt-perspectiva: 900px`); en `prefers-reduced-motion` el tilt se anula por completo.

**Reglas de los widgets:**
- Siempre glass texturado — un widget nunca es un rectángulo opaco.
- El valor grande manda la jerarquía; la etiqueta nunca compite con él en peso (§2, prioridad #2).
- Borde-glow semántico (`.glass-card--estado-*`) solo cuando el widget representa un estado; nunca decorativo.
- Tilt y `--vivo` reservados a la pieza hero, nunca en cada tile de la grilla.
- La grilla respira: gap generoso (§2, prioridad #4), tamaños mezclados para dar ritmo bento.

---

## 4.2 Controles de formulario y navegación

Piezas más chicas que un widget pero igual de sujetas a la prioridad Apple del §2: nunca el control nativo del navegador/sistema operativo (`<select>`, `<input type="date">`, checkbox/scrollbar del SO) cuando hay un dato que filtrar, elegir o recorrer — siempre una superficie glass propia, con el verde institucional como única señal de "activo/seleccionado".

- **Scrollbar propio** (`<ScrollArea>`/`<VirtualList>`, clases `.eva-scroll-*`) — reemplaza el scrollbar nativo en cualquier contenedor con overflow (listas largas, tablas, paneles). Thumb en verde institucional translúcido, track en arena suave, delgado tipo iOS, aparece solo en hover/scroll activo y hace fade out en reposo. `<VirtualList>` lo usa por default para virtualizar filas; `<ScrollArea>` solo (sin virtualizar) alcanza para paneles cortos con contenido variable, ej. la lista de parámetros ajustables.
- **Switch** (`.eva-switch`) — toggle binario en píldora; verde institucional con gradiente cuando está activo, perilla blanca con rebote (`--ease-apple-rebote`) al cambiar.
- **Segmentado** (`.eva-segmento` / `.eva-segmento__opcion`) — selector excluyente en línea (ej. modo de combinación Y/O de un panel de filtros); opción activa en `--color-verde-claro` con texto `--color-verde-oscuro`, nunca fondo sólido saturado (eso es solo para los chips de la tabla, §6.1).
- **Paginación numérica** (`.eva-pagina`) — botones píldora `1 2 3 …`; página activa en verde claro/oscuro igual que el segmentado. Los números van en `--font-data` (son datos, no texto de interfaz).
- **Selector de fecha** (`<GlassDatePicker>`) — reemplaza `<input type="date">`. Botón disparador con el mismo tratamiento que un `<MultiSelect>` cerrado (borde glass, texto o placeholder); al abrir, panel `glass-surface--strong` con mes/año navegable (`‹ Mes ›`), grilla de 7×6 días y el día elegido en `--color-verde-institucional` sólido con texto blanco. Sin librería de fechas — cálculo de grilla con `Date` nativo.
- **Dropdown de selección múltiple** (`<MultiSelect>`) — reemplaza el `<select multiple>` nativo. Botón disparador muestra un chip resumen ("3 seleccionados") en vez de la lista cruda; al abrir, panel `glass-surface--strong` con buscador (`.glass-field`) arriba de 8+ opciones, checkboxes propios en píldora (círculo verde institucional con check al marcar, nunca el checkbox del SO) y la lista interna corre sobre `<VirtualList>` — un solo componente reutilizado en cualquier filtro multi-opción del sistema (tipo de coche, bogie, etc.), nunca una implementación nueva por filtro.
- **Campo de contraseña** (`<GlassField type="password">`) — el propio `<GlassField>` detecta `type="password"` y agrega el ícono de mostrar/ocultar (`Eye`/`EyeOff` de `lucide-react`) dentro del input, alineado a la derecha: gris concreto en reposo, verde institucional al hover. Alterna el `type` real del `<input>` entre `password`/`text` (nunca retira el atributo, así el autocompletado del navegador sigue funcionando). Un solo lugar de implementación — cualquier input de contraseña de la app (login, cambio de contraseña obligatorio, futuros formularios) lo hereda automáticamente por usar `<GlassField>`, sin tocar cada pantalla.

Los cuatro primeros (scrollbar, switch, segmentado, paginación) comparten el mismo patrón visual de "botón/track glass translúcido + verde claro cuando está activo/seleccionado" — es intencional, para que un panel con varios controles distintos se siga leyendo como un solo lenguaje.

---

## 4.3 Diálogos y confirmaciones

Todo diálogo modal se apoya en `<GlassModal>` (portal a `<body>`, overlay con blur sobre el fondo, `glass-surface--strong`): resuelve la base común a cualquier modal de la app —

- **Entrada suave**: fade + scale-in sutil al montar (`--duracion-base`/`--ease-apple`), arranca ya visible sin transición si el usuario prefiere menos movimiento.
- **Cierre**: tecla Escape o clic fuera del modal (clic dentro nunca lo cierra).
- **Foco atrapado** (accesibilidad básica): al abrir, enfoca el primer elemento enfocable del modal; Tab/Shift+Tab ciclan dentro del modal sin escapar a la página de atrás; al cerrar, devuelve el foco a lo que estaba enfocado antes de abrirlo.

**`<ConfirmDialog>`** es la confirmación reutilizable construida sobre `<GlassModal>` — el único componente para pedir "¿confirmar esta acción?" en toda la app (guardar un parámetro, cancelar la migración masiva, eliminar una fila/tren, confirmar el commit): nunca una implementación de modal propia por pantalla.

- **Variante** `default` (botón de acción verde institucional, `.glass-button-primary`) para acciones normales, `danger` (mismo botón con fondo/borde en `--color-estado-critico`) para acciones destructivas — la única diferencia visual entre variantes es el botón de acción; el resto del diálogo no cambia.
- **Estado de carga**: el botón de acción entra en `cargando` (spinner + disabled, igual que `<GlassButton cargando>`) mientras la promesa de `onConfirm` no resuelve. Si la promesa rechaza, el error se muestra dentro del propio diálogo (`extraerMensajeError`) y el diálogo NO se cierra — permite reintentar sin perder contexto. Mientras carga, Escape/clic-fuera quedan bloqueados (no se puede "perder" una confirmación en curso).
- **Progreso opcional** (`progreso={{ actual, total, etiqueta }}`): barra de progreso en verde institucional en vez del spinner genérico — pensada para cuando el commit por lotes de la migración masiva tenga polling de avance real; la prop ya existe y el componente ya sabe pintarla, aunque hoy ningún call site la use todavía.

---

## 5. Movimiento

Nada estático se debe sentir "muerto" — pero tampoco todo puede moverse todo el tiempo, o se vuelve ruido en vez de vida. **Regla de balance: motion continuo (idle, en loop) limitado a máximo 2 elementos simultáneos en pantalla; todo lo demás es motion reactivo** (responde a hover/press/scroll, no corre solo).

```css
:root {
  --ease-apple:        cubic-bezier(0.16, 1, 0.3, 1);     /* salida suave — entradas, hover */
  --ease-apple-rebote: cubic-bezier(0.34, 1.56, 0.64, 1); /* leve overshoot — press/active */
  --duracion-rapida:   180ms;
  --duracion-base:     320ms;
  --duracion-lenta:    520ms;
}
```

**Catálogo de primitivas reutilizables:**

| Clase | Efecto | Dónde sí | Dónde no |
|---|---|---|---|
| `.eva-elevar` | lift + sombra más profunda al hover | Tarjetas KPI, tarjetas de estado, swatches de color, botones | — |
| `.eva-brillo` | barrido de luz diagonal al hover (necesita `<span class="eva-brillo__barrido">` hijo) | Tarjetas de estado, tarjetas de la sección Liquid Glass | Botones (ya tienen su propio hover), tabla de mediciones |
| `.glass-surface--vivo` | borde de gradiente cónico animado (§4) | 1-2 piezas hero como mucho | Cualquier grilla repetida |
| `.eva-tilt` | tilt 3D siguiendo el puntero (reactivo, §4.1) | Widget hero, card de login | Cada tile de una grilla, tabla de mediciones |
| `.eva-anim-flotar` | idle float continuo | Como mucho 1 elemento del hero | Texto de párrafo, cards repetidas |
| `.eva-anim-pulso` | pulso sutil en el borde-glow crítico | Solo `.glass-card--estado-critico` | Tabla de mediciones (§6.1) |
| `.eva-revelar` / `.eva-revelar--derecha` + `.is-visible` | fade + rise-in (o slide desde la derecha) al entrar en viewport | Cada sección de una pantalla larga, drawers | — |

```css
.eva-elevar {
  transition: transform var(--duracion-base) var(--ease-apple), box-shadow var(--duracion-base) var(--ease-apple);
}
.eva-elevar:hover {
  transform: translateY(-6px) scale(1.015);
  box-shadow: var(--glass-shadow-ambient), 0 18px 36px rgba(85, 82, 74, 0.16);
}

.eva-brillo { position: relative; overflow: hidden; }
.eva-brillo__barrido {
  position: absolute;
  inset: -50%;
  background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.55) 50%, transparent 60%);
  transform: translateX(-120%);
  transition: transform var(--duracion-lenta) var(--ease-apple);
  pointer-events: none;
}
.eva-brillo:hover .eva-brillo__barrido { transform: translateX(120%); }

@keyframes eva-flotar {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}
.eva-anim-flotar { animation: eva-flotar 6s var(--ease-apple) infinite; }

@keyframes eva-pulso {
  0%, 100% { box-shadow: var(--glass-shadow-ambient), 0 0 0 0 rgba(179, 59, 59, 0.35); }
  50%      { box-shadow: var(--glass-shadow-ambient), 0 0 0 8px rgba(179, 59, 59, 0); }
}
.eva-anim-pulso { animation: eva-pulso 2.4s ease-out infinite; }

.eva-revelar {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--duracion-lenta) var(--ease-apple), transform var(--duracion-lenta) var(--ease-apple);
  transition-delay: var(--reveal-delay, 0ms);
}
.eva-revelar.is-visible { opacity: 1; transform: translateY(0); }
.eva-revelar--derecha { transform: translateX(32px); }
.eva-revelar--derecha.is-visible { transform: translateX(0); }

@media (prefers-reduced-motion: reduce) {
  .eva-elevar, .eva-elevar:hover { transition: none; transform: none; }
  .eva-brillo__barrido { transition: none; display: none; }
  .eva-anim-flotar, .eva-anim-pulso { animation: none; }
  .eva-revelar, .eva-revelar--derecha {
    opacity: 1; transform: none; transition: none;
  }
}
```

`.eva-revelar` se activa agregando la clase `.is-visible` cuando el elemento entra en viewport (`IntersectionObserver`, una sola vez — no se re-anima al hacer scroll hacia arriba). El delay entre título y contenido de una misma sección se controla con la variable `--reveal-delay` (ej. `150ms` en el título, `280ms` en el contenido).

**La tabla de mediciones (§6.1) no recibe ninguna primitiva de esta sección** — cero glass, cero shimmer, cero pulso: ahí el requisito es velocidad de escaneo, no atmósfera.

---

## 6. Paleta de color

Dos colores dominantes (verde y blanco), dos de apoyo (arena y gris). Los semánticos son subordinados, nunca compiten en protagonismo con el verde institucional.

```css
:root {
  /* Dominantes — identidad del tren */
  --color-verde-institucional: #1B8A56; /* verde base, botones primarios, marca */
  --color-verde-oscuro:        #0F5C39; /* texto sobre verde claro, hover de botones */
  --color-verde-claro:         #DCEFE2; /* fondos de estado OK, tags suaves */
  --color-blanco:              #FFFFFF; /* franja del tren, superficies glass */

  /* Apoyo — la tierra de origen */
  --color-arena:                #E7DDC9; /* fondo base de la app */
  --color-arena-suave:          #F3EEE2; /* fondo de secciones internas */
  --color-gris-concreto:        #8C897F; /* texto secundario, iconos inactivos */
  --color-gris-concreto-oscuro: #55524A; /* texto principal sobre fondos claros */

  /* Semánticos — subordinados al verde, no compiten con él (uso general de UI, NO tabla) */
  --color-estado-ok:            #1B8A56; /* mismo verde institucional */
  --color-estado-seguimiento:   #C79A3E; /* ámbar tierra, no amarillo puro */
  --color-estado-cambio:        #C2703C; /* naranja terracota, cercano a la arena */
  --color-estado-critico:       #B33B3B; /* rojo apagado, no saturado */
  --color-estado-reperfilado:   #8E5E78; /* mauve tierra, versión desaturada del magenta de tabla (§6.1) */

  /* Superficies */
  --color-fondo-app:            var(--color-arena);
  --color-texto-principal:      var(--color-gris-concreto-oscuro);
  --color-texto-invertido:      #FFFFFF;
}
```

**Reglas de uso:**
- El fondo general de la app siempre es `.bg-aura` (arena/verde en manchas suaves, ver §7) o el degradado tierra→verde en piezas grandes. Nunca fondo oscuro, negro, ni un bloque de color plano parejo.
- El verde institucional se reserva para: acciones primarias, estado OK, marca/logo, elementos activos de navegación.
- Blanco puro se usa casi exclusivamente en superficies glass y franjas — no como fondo plano de página (perdería la identidad "arena").
- Seguimiento/Cambio/Crítico usan tonos tierra desaturados, no colores de semáforo genéricos — deben sentirse parte de la misma familia cromática, no alarmas ajenas al sistema.
- **Excepción explícita: la tabla de mediciones (§6.1) usa una paleta distinta y de mayor contraste, con prioridad sobre esta regla.** Fuera de la tabla, esta paleta "tierra" es la que manda.

### 6.1 Colores de tabla de mediciones (alto contraste — tienen prioridad)

**Esta sección es una excepción funcional a la prioridad estética de §2–§5: aquí manda la legibilidad de accesibilidad, no la ejecución Apple.** El contenedor de la tabla y su fila pueden llevar un **tinte glass muy tenue** (`.tabla-fila--glass`, un realce de fondo apenas perceptible al hover) para que se integre con el resto de la app — pero **los chips de estado siguen siendo sólidos y de alto contraste** (nada de glass en ellos) y **no se agrega ningún movimiento nuevo** más allá de ese realce reactivo de fila (ver §5). El "híbrido sutil" no puede bajar el contraste de lectura de los datos.

La tabla de mediciones es la superficie de trabajo diaria de técnicos y supervisores: ahí la legibilidad y la velocidad de lectura pesan más que la coherencia con la paleta "tierra" del resto de la app. Por eso estos colores **anulan** los semánticos de §6 dentro de la tabla, el drawer de detalle de un registro, y cualquier chip/etiqueta que muestre el estado de un disco.

**Regla de contraste:** cada color de estado debe superar un contraste de texto de al menos 4.5:1 (WCAG AA) contra su propio fondo y contra `--color-arena-suave`. Se usan fondos sólidos y saturados (no tintes translúcidos como en el resto del sistema) — la prioridad aquí es que un supervisor identifique el estado de un vistazo, incluso a distancia o en una pantalla de mala calidad, y que se note con más fuerza que el rosado/amarillo nativo de Excel que ya conocen los técnicos (para que la migración a la app se sienta como una mejora, no como una versión más pálida de lo mismo).

```css
:root {
  /* Estados de disco — tabla, drawer de detalle, export a Excel */
  --tabla-estado-ok-bg:            #1B8A56; /* verde institucional sólido */
  --tabla-estado-ok-text:          #FFFFFF;

  --tabla-estado-seguimiento-bg:   #E3A518; /* ámbar dorado saturado, más fuerte que el "ámbar tierra" de §6 */
  --tabla-estado-seguimiento-text: #3A2A00;

  --tabla-estado-cambio-bg:        #F2C90E; /* amarillo pleno — iguala/supera el resaltado nativo del Excel */
  --tabla-estado-cambio-text:      #3A2E00;

  --tabla-estado-critico-bg:       #D62828; /* rojo saturado, más intenso que el "rojo apagado" de §6 */
  --tabla-estado-critico-text:     #FFFFFF;

  /* Quinto estado de disco (Migración/Mediciones): Rd manda salvo que H llegue al umbral de reperfilado */
  --tabla-accion-reperfilado-bg:   #B23E96; /* magenta, equivalente de alto contraste al rosado nativo del Excel */
  --tabla-accion-reperfilado-text: #FFFFFF;
}

.tabla-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px; /* píldora, consistente con el resto del sistema */
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 12px;
}
.tabla-chip--ok           { background: var(--tabla-estado-ok-bg); color: var(--tabla-estado-ok-text); }
.tabla-chip--seguimiento  { background: var(--tabla-estado-seguimiento-bg); color: var(--tabla-estado-seguimiento-text); }
.tabla-chip--cambio       { background: var(--tabla-estado-cambio-bg); color: var(--tabla-estado-cambio-text); }
.tabla-chip--critico      { background: var(--tabla-estado-critico-bg); color: var(--tabla-estado-critico-text); }
.tabla-chip--reperfilado  { background: var(--tabla-accion-reperfilado-bg); color: var(--tabla-accion-reperfilado-text); }
```

**Dónde sí y dónde no aplican estos colores:**
- **Sí:** chip de estado en cada fila de la tabla, fila resaltada de fondo muy sutil (`color-mix(in srgb, var(--tabla-estado-X-bg) 8%, var(--color-arena-suave))` como fondo de fila completa, opcional, para escanear la tabla aún más rápido), tarjetas del drawer de detalle, celdas de estado en el Excel exportado.
- **No:** tarjetas KPI del dashboard, bordes-glow de tarjetas fuera de la tabla, badges de navegación — ahí sigue mandando la paleta "tierra" de §6, para no romper la identidad general de la app fuera del contexto de trabajo con datos.
- El chip `reperfilado` es un **quinto valor del chip de Estado** (Migración/Mediciones): Rd manda salvo que H llegue al umbral de reperfilado y el resultado post-descuento no caiga en zona de Cambio, en cuyo caso reemplaza a OK/Seguimiento en ese mismo chip — no se muestra junto a otro chip aparte.

---

## 7. Fondo, cuadrícula y degradado

**Cuadrícula de manzanas** (fondo sutil, opacidad baja, detrás del contenido):

```css
.bg-cuadricula {
  background-image:
    linear-gradient(rgba(140, 137, 127, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(140, 137, 127, 0.08) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

**Textura de concreto** (puntillado, usar en superficies grandes de arena, no dentro de tarjetas):

```css
.bg-textura-concreto {
  background-image: radial-gradient(rgba(140, 137, 127, 0.15) 1px, transparent 1px);
  background-size: 6px 6px;
}
```

**Degradado tierra → verde** (para portadas, login, separadores de sección — pieza grande, no micro-componentes). Usa paradas intermedias con `color-mix()` en vez de saltar directo entre tonos:

```css
.bg-degradado-transformacion {
  background: linear-gradient(
    135deg,
    var(--color-arena) 0%,
    var(--color-arena-suave) 30%,
    color-mix(in srgb, var(--color-arena-suave) 50%, var(--color-verde-claro) 50%) 55%,
    var(--color-verde-claro) 75%,
    color-mix(in srgb, var(--color-verde-claro) 45%, var(--color-verde-institucional) 55%) 90%,
    var(--color-verde-institucional) 100%
  );
}
```

**Aura de fondo** (base recomendada para el fondo de app completo, en vez de arena plana). Las 2 manchas verdes "respiran" — crecen/encogen y aclaran/oscurecen en bucle, cada una en su propio pseudo-elemento para poder desfasarlas entre sí (si no, "respirar" las dos exactamente igual se ve mecánico, no orgánico); la mancha de arena y el color base quedan estáticos:

```css
.bg-aura {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(60% 55% at 45% 100%, color-mix(in srgb, var(--color-arena) 70%, transparent) 0%, transparent 70%),
    var(--color-arena-suave);
}

.bg-aura::before,
.bg-aura::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  animation: eva-aura-respirar var(--duracion, 8s) ease-in-out infinite;
}

.bg-aura::before {
  background: radial-gradient(55% 40% at 15% 0%, color-mix(in srgb, var(--color-verde-claro) 65%, transparent) 0%, transparent 60%);
  transform-origin: 15% 0%;
}

.bg-aura::after {
  background: radial-gradient(50% 45% at 100% 15%, color-mix(in srgb, var(--color-verde-institucional) 16%, transparent) 0%, transparent 65%);
  transform-origin: 100% 15%;
  /* Duración propia (no un simple delay a mitad de ciclo de la de arriba):
     las 2 manchas se desfasan y además derivan de fase con el tiempo, en vez
     de repetir siempre la misma oposición — se ve orgánico, no mecánico. */
  --duracion: 9.5s;
  animation-delay: -2.5s;
}

@keyframes eva-aura-respirar {
  0%, 100% { transform: scale(0.95); opacity: 0.7; }
  50%      { transform: scale(1.05); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .bg-aura::before, .bg-aura::after { animation: none; transform: none; opacity: 1; }
}
```

**Difuminado inferior:**

```css
.bg-difuminado-inferior {
  -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
}
```

> **Importante:** `mask-image` difumina *todo* lo que esté dentro del elemento, incluido el texto. Aplicar `.bg-difuminado-inferior` siempre a una capa de fondo dedicada, nunca al contenedor que también tiene el texto encima.

Combinación recomendada para pantallas de portada y para el fondo general de la app: `.bg-aura` + `.bg-cuadricula` como base; encima, la pieza de portada usa `.bg-degradado-transformacion` + `.bg-difuminado-inferior` (en su propia capa de fondo), con una `.glass-surface` (o `.glass-surface--vivo` si es la pieza hero de la pantalla) flotando encima con el formulario.

**Dónde NO suavizar con degradado:** superficies con datos tabulares o texto denso (tablas, listas de detalle) se mantienen en `--color-arena-suave` plana.

### 7.1 Fondo animado — pantallas de solo aviso

Cuando una pantalla completa **no tiene más contenido que un aviso** (mensaje del sistema, estado vacío, pantalla de mantenimiento, error, "no tienes accesos", confirmación a pantalla completa, etc.), el fondo estático se reemplaza por un **fondo animado de engranajes cayendo en lluvia** — varios carriles diagonales en paralelo (superior izquierda → inferior derecha), no uno solo.

**Reglas:**
- Uso **exclusivo** de pantallas que solo muestran un aviso — nunca en dashboards, tablas o pantallas con datos.
- Los engranajes van en `--color-gris-concreto`, nunca en verde institucional.
- **Densidad alta:** 24–36 instancias, repartidas en **5-8 carriles paralelos** a lo ancho (misma diagonal de esquina a esquina, desplazada por carril en el eje perpendicular) — nunca todas por la misma línea.
- A mayor densidad, opacidad más baja por instancia (0.08–0.16).
- Tamaños en **3 categorías reconocibles** (no ruido continuo): pequeña (~60-75%), mediana (~85-105%) y grande (~120-140%) de un tamaño base — la categoría de cada instancia también sale del PRNG con semilla.
- Velocidad de caída variada por instancia (3-7s por trayecto) y con retraso de inicio propio (no sincronizadas) — carril, categoría de tamaño y velocidad/retraso salen de un PRNG con semilla fija (mulberry32 o similar, sin dependencias externas): reproducible entre recargas, no aleatoriedad real del navegador.
- El aviso en sí siempre va dentro de una `.glass-surface--strong` centrada (puede llevar `--vivo` — cuenta como la única pieza hero de esa pantalla).
- Respetar `prefers-reduced-motion`.

```css
/* `left` viaja de -12% a 112% (misma diagonal de siempre) + el offset propio
   de --carril: si `left` no incluyera --carril, la animación pisaría
   cualquier posición inicial fijada por style inline y todas las instancias
   caerían por la MISMA línea (con --carril, cada carril recorre una
   diagonal paralela desplazada). */
@keyframes eva-engranaje-caer {
  from { top: -12%; left: calc(-12% + var(--carril, 0%)); }
  to   { top: 112%; left: calc(112% + var(--carril, 0%)); }
}

@keyframes eva-engranaje-girar {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.bg-engranajes-cayendo {
  position: relative;
  overflow: hidden;
  background: var(--color-arena-suave);
}

.bg-engranajes-cayendo .engranaje {
  position: absolute;
  width: var(--size, 32px);
  height: var(--size, 32px);
  color: var(--color-gris-concreto);
  opacity: var(--opacidad, 0.14);
  animation:
    eva-engranaje-caer var(--duracion, 5s) linear infinite, /* fallback; cada instancia trae la suya vía --duracion */
    eva-engranaje-girar var(--giro, 9s) linear infinite;
  animation-delay: var(--retraso, 0s), 0s;
}

@media (prefers-reduced-motion: reduce) {
  .bg-engranajes-cayendo .engranaje {
    animation: none;
  }
}
```

Cada `.engranaje` es una instancia del ícono de engranaje (símbolo `#gear-icon` en `icons.svg`) con `--size`, `--opacidad`, `--duracion`, `--giro` y `--retraso` propios (PRNG con semilla fija, ver `FondoEngranajes.tsx`), más `--carril` — el offset perpendicular a la diagonal que separa cada una de las 5-8 líneas paralelas, con jitter propio para que no se vea una grilla perfectamente equiespaciada.

> **Catálogo (`/design-system`):** cada muestra de fondo/textura de §7 y §7.1 es clicable y abre un `<GlassModal>` con la misma estética a **tamaño real (1:1)**, en un cuadro cuadrado centrado — útil para inspeccionar la densidad real de un patrón sin la escala reducida del catálogo (ver nota de §9 sobre `data-densidad="compacta"`). Cierra con Escape, clic fuera o el botón ✕. No es un patrón a replicar en pantallas reales, es una herramienta del propio catálogo.

---

## 8. Configuración Tailwind (Vite)

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: {
          institucional: '#1B8A56',
          oscuro: '#0F5C39',
          claro: '#DCEFE2',
        },
        arena: {
          DEFAULT: '#E7DDC9',
          suave: '#F3EEE2',
        },
        concreto: {
          DEFAULT: '#8C897F',
          oscuro: '#55524A',
        },
        estado: {
          ok: '#1B8A56',
          seguimiento: '#C79A3E',
          cambio: '#C2703C',
          critico: '#B33B3B',
        },
      },
      fontFamily: {
        display: ['"General Sans"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: {
        glass: '32px',
        'glass-lg': '44px',
      },
      borderRadius: {
        'glass-sm': '26px',
        glass: '34px',
        'glass-lg': '44px',
      },
      boxShadow: {
        glass: '0 40px 90px -24px rgba(15, 92, 57, 0.16), 0 10px 24px rgba(85, 82, 74, 0.10)',
      },
    },
  },
  plugins: [],
};
```

> Nota de instalación: importar las variables CSS de `:root` (§6 y §4) en un `styles/tokens.css` global cargado desde `main.tsx`, y usar clases de Tailwind para layout/spacing, combinadas con las clases utilitarias `.glass-*`/`.eva-*` para los efectos glass y de movimiento.

---

## 9. Aplicación por componente

| Componente | Tratamiento |
|---|---|
| Fondo de app | `.bg-aura` + `.bg-cuadricula` al 100% |
| Nav flotante (persistente) | `.glass-surface` sticky, wordmark condensado (§1.1), sin `--vivo` (no es la pieza hero). En `/design-system` además se auto-oculta con `transform` al bajar y reaparece de inmediato al subir (ver nota abajo) |
| Login / Onboarding | `.bg-degradado-transformacion` + `.bg-difuminado-inferior` sobre `.bg-aura` + `.glass-surface--strong` (`--vivo` opcional) para el formulario |
| Dashboard / Inicio | Grilla bento de **widgets** (§4.1): `.glass-surface .eva-widget --s/m/l`; el hero puede sumar `.eva-tilt` (+ `--vivo`) |
| Widgets KPI | `.glass-surface .eva-widget` + `.eva-elevar` + borde-glow semántico si aplica |
| Botón primario | `.glass-button-primary` (verde), transiciones con `--ease-apple`/`--ease-apple-rebote` |
| Botón secundario | `.glass-surface` con texto `--color-gris-concreto-oscuro`, sin gradiente, `.eva-elevar` |
| Chips de filtro | `.glass-chip` |
| Tarjetas de estado | `.glass-surface` + borde-glow + `.eva-elevar` + `.eva-brillo`; la crítica suma `.eva-anim-pulso` |
| Tabla de resultados | Contenedor sobre `--color-arena-suave` con tinte glass tenue (`.tabla-fila--glass` en la fila, realce al hover). Estados con chips sólidos de alto contraste (§6.1), valores T/H/Rd en `--font-data`. Sin glass en los chips, sin motion nuevo |
| Drawer de detalle | `.glass-surface--strong` + `.eva-revelar--derecha` deslizando desde la derecha |
| Gráfico de trazabilidad | Fondo `--color-arena-suave`, línea de serie en verde institucional, línea de umbral crítico punteada en `--color-estado-critico` |
| Separadores de sección grandes | `.bg-degradado-transformacion` en franjas horizontales delgadas |
| Pantalla de solo aviso | `.bg-engranajes-cayendo` (ver §7.1) + `.glass-surface--strong` centrada con el mensaje |
| Entrada de secciones largas | `.eva-revelar` en cada bloque, `--reveal-delay` escalonado entre título y contenido |
| Lista larga (sidebar, filas de tabla, opciones de dropdown) | `<VirtualList>` + scrollbar propio (§4.2), nunca el scroll nativo del navegador |
| Selector de fecha | `<GlassDatePicker>` (§4.2) — calendario glass propio, nunca `<input type="date">` nativo |
| Filtro de selección múltiple | `<MultiSelect>` (§4.2) — panel glass + chip resumen + checkboxes propios, nunca `<select multiple>` nativo |
| Toggle binario / selector excluyente en línea | `.eva-switch` / `.eva-segmento` (§4.2) |
| Campo de contraseña | `<GlassField type="password">` (§4.2) — ícono ojo mostrar/ocultar integrado, mismo componente que cualquier otro campo |
| Diálogo de confirmación (guardar parámetro, cancelar/confirmar migración, eliminar fila/tren) | `<ConfirmDialog>` sobre `<GlassModal>` (§4.3) — variante `default`/`danger`, botón con estado de carga, progreso opcional |
| Modal de edición con formulario propio (ej. editar fila) | `<GlassModal>` (§4.3) directo — `<ConfirmDialog>` es solo para confirmar/cancelar, no para formularios con campos propios |

> **Exclusivo de `/design-system` (no son reglas del sistema para el resto de la app):**
> - **Nav auto-hide** — `NavGaleria.tsx` oculta el nav con `translateY` al detectar scroll hacia abajo y lo muestra ante cualquier movimiento hacia arriba (throttle vía `requestAnimationFrame`); nunca cambia `height`/`display`, así el contenido de abajo no salta. El resto de la app usa un nav sin este comportamiento.
> - **Densidad compacta (`§0`)** — el contenedor raíz de `Galeria.tsx` lleva `data-densidad="compacta"`, que activa overrides *scoped* en `tokens.css` (`[data-densidad="compacta"] .eva-widget`, `.glass-chip`, `.tabla-chip`, ~20% más chicos) más clases Tailwind reducidas directamente en el propio JSX del catálogo. Es solo para que quepan más componentes en la demo — la definición base de estos componentes (la que usa el resto de la app) no cambia. Nunca usa `transform: scale()` ni reduce el `font-size` raíz.

---

## 10. Qué evitar

- Fondos oscuros o modo noche en cualquier pantalla.
- Verdes saturados tipo "semáforo" o neón — siempre el verde institucional definido en §6.
- Colores semánticos que no pertenezcan a la familia tierra **en la UI general** — dentro de la tabla de mediciones aplica la excepción de §6.1.
- Glass sobre fondo blanco liso.
- Cuadrícula o textura de concreto con opacidad alta.
- Fondo de engranajes cayendo fuera de pantallas de solo aviso.
- Glass tan transparente que el texto pierda contraste.
- `mask-image`/`.bg-difuminado-inferior` aplicado a un elemento que también contiene texto.
- Degradados o auras dentro de tablas y superficies con datos densos.
- Botones o chips con esquinas cuadradas o radios pequeños.
- `.glass-surface--vivo` o `.eva-tilt` en más de 1-2 piezas hero, o dentro de cualquier grilla repetida de widgets.
- Widgets opacos o sin textura — el widget siempre es glass texturado (§4.1).
- Grano/textura o iridiscencia tan fuertes que el valor grande del widget pierda nitidez — la textura es material, no ruido sobre el contenido.
- Motion continuo (idle, en loop) en más de 2 elementos a la vez en pantalla — deja de sentirse vivo y empieza a sentirse ruidoso.
- Cualquier animación nueva (glass, shimmer, pulso, borde vivo) dentro de la tabla de mediciones o su drawer — ahí el requisito es velocidad de lectura, no atmósfera.
- Animación que no respete `prefers-reduced-motion: reduce`.
