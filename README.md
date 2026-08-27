# EVA — de Línea 1 de Lima

Sistema de trazabilidad de discos de freno para el Metro de Lima Línea 1: registro de
mediciones (T, H, Rd), reglas de estado (OK / Seguimiento / Cambio / Crítico), migración
masiva del historial en Excel, calendario de mantenimiento y control de acceso por rol.

**Estado actual del proyecto:** modelo de datos completo, autenticación con control de
acceso por rol, migración masiva de Excel (carga, vista previa editable, confirmación),
mediciones confirmadas (búsqueda/edición/eliminación), tasa de desgaste y trazabilidad
(consenso Gauss/Percentiles/Tukey, parámetros configurables) ya implementados. Dashboard y
calendario de mantenimiento todavía no están implementados.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11 + TypeScript, Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Base de datos | PostgreSQL 16 (Docker) |
| Auth | Passport + JWT, bcrypt |
| Frontend | React 19 + Vite + TypeScript, TanStack Query, React Router, Tailwind v4 |
| Monorepo | npm workspaces |

## Estructura del monorepo

```
/apps
  /api        NestJS + Prisma — API REST, autenticación, modelo de datos
  /web        React + Vite — frontend
/packages
  /shared     Tipos compartidos entre api y web (enums espejo de la base de datos)
docker-compose.yml   Postgres 16 para desarrollo local
schema_eva.sql       Script SQL de referencia del modelo de datos completo
database-schema-draft.md   Resumen conceptual del modelo de datos (ver schema_eva.sql para el detalle)
styles.md             Sistema de diseño del frontend (Liquid Glass / Apple)
```

### `apps/api` — backend

```
prisma/schema.prisma   Modelo de datos completo (17 enums, 16 modelos) — traducción 1:1 de schema_eva.sql
prisma/seed.ts          Seed: bogies, parámetros del sistema, usuario "sistema", administrador, 44 trenes
src/prisma/              PrismaService (cliente de Prisma inyectable en toda la app)
src/auth/                 Login, cambio de contraseña obligatorio, JWT, guard de roles (@Roles)
src/brake-disc-rules/      Motor de reglas puro (sin Prisma): Rd = T − H, clasificación de estado
src/migration/              Carga masiva de Excel (.xlsx/.xlsm), vista previa editable, confirmación (commit)
src/scan-records/            Mediciones ya confirmadas: búsqueda, stats, edición, eliminación
src/wear-rate/                 Tasa de desgaste por par de mediciones consecutivas (wear_rate_pairs)
src/traceability/                Estadísticas de trazabilidad: consenso Gauss/Percentiles/Tukey
src/system-params/                Parámetros del sistema editables (umbrales, percentiles de consenso)
src/notifications/                 Notificaciones por usuario/rol
```

### `apps/web` — frontend

```
src/auth/           Contexto de sesión (JWT en localStorage) y guards de ruta (RequireAuth, PublicOnlyRoute)
src/pages/           Login, CambiarPasswordObligatorio, Inicio, MigracionUpload/Preview, MedicionesConfirmadas,
                      TasaDesgaste, Trazabilidad, Galeria (catálogo visual de styles.md)
src/features/         Lógica por dominio (api + hooks TanStack Query): migration, scan-records, wear-rate,
                      traceability, system-params, notifications
src/styles/           Tokens CSS del sistema de diseño (tokens.css)
src/components/       Piezas reutilizables (GlassSurface, Widget, ConfirmDialog, MultiSelect, etc.)
```

La ruta `/design-system` muestra el catálogo de componentes visuales (glass, tipografía,
paleta, movimiento) descrito en `/styles.md` — es una vista de referencia, no una pantalla
funcional de la app.

---

## Requisitos previos

- Node.js 22+ y npm 10+
- Docker Desktop (para Postgres)

## Puesta en marcha

1. **Instalar dependencias** (una sola vez, desde la raíz — el repo usa npm workspaces):

   ```bash
   npm install
   ```

2. **Levantar Postgres:**

   ```bash
   docker compose up -d
   ```

3. **Variables de entorno.** Ya existen `apps/api/.env` y `apps/web/.env` con valores
   funcionales para desarrollo local (ver tabla abajo). Si los recreás desde cero:

   ```bash
   # apps/api/.env
   DATABASE_URL="postgresql://postgres:123456789@localhost:5433/eva?schema=public"
   JWT_SECRET="<un secreto aleatorio largo>"
   JWT_EXPIRES_IN="8h"

   # apps/web/.env
   VITE_API_URL=http://localhost:3000
   ```

4. **Migrar y sembrar la base de datos** (desde `apps/api`):

   ```bash
   cd apps/api
   npx prisma migrate dev   # aplica las migraciones (crea las tablas)
   npx prisma db seed       # bogies, parámetros, usuario sistema, administrador, 44 trenes
   ```

5. **Levantar los dos servidores** (en dos terminales, o con dos `npm run dev` en paralelo):

   ```bash
   npm run start:dev --workspace apps/api   # http://localhost:3000
   npm run dev --workspace apps/web          # http://localhost:5173
   ```

6. Entrar a `http://localhost:5173` e iniciar sesión con el usuario administrador sembrado
   (ver credenciales abajo). El primer login fuerza el cambio de contraseña.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `DATABASE_URL` | `apps/api/.env` | Cadena de conexión a Postgres |
| `JWT_SECRET` | `apps/api/.env` | Secreto para firmar los JWT — generar uno nuevo por entorno, nunca reusar el de desarrollo |
| `JWT_EXPIRES_IN` | `apps/api/.env` | Vigencia del token (ej. `8h`) |
| `WEB_ORIGIN` | `apps/api/.env` (opcional) | Origen permitido por CORS — default `http://localhost:5173` |
| `VITE_API_URL` | `apps/web/.env` | URL base de la API — default `http://localhost:3000` |

## Usuarios sembrados (solo desarrollo)

| Email | Password | Rol | Notas |
|---|---|---|---|
| `admin@eva-l1.local` | `Eva#L1nea2026!` | administrador | `debe_cambiar_password=true` — el primer login exige definir una contraseña nueva |
| `sistema@eva-l1.local` | — | administrador | Usuario reservado para atribuir acciones automáticas (`es_usuario_sistema=true`). Login siempre rechazado con 403, sin importar la contraseña |

---

## Comandos útiles

### `apps/api`

```bash
npm run start:dev        # servidor con watch
npm run build             # build de producción (tsc)
npm test                  # tests unitarios (Jest)
npm run lint               # eslint

npx prisma studio          # explorar la base de datos en el navegador
npx prisma migrate dev     # crear/aplicar una migración a partir de schema.prisma
npx prisma db seed         # correr prisma/seed.ts
npx prisma generate         # regenerar el cliente tras cambios en schema.prisma
```

### `apps/web`

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build      # build de producción
npm run lint         # eslint
```

Todos los comandos también se pueden correr desde la raíz con
`npm run <script> --workspace apps/api` / `--workspace apps/web`.

## API — endpoints implementados

El control de acceso por rol se hace con el decorador `@Roles(...roles)` combinado con
`@UseGuards(JwtAuthGuard, RolesGuard)`. Salvo que se indique lo contrario, todo lo que no
sea `/auth/*` requiere JWT.

### Auth (`/auth`) — público / JWT

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Email + password → JWT. Rechaza usuarios sistema (403), cuentas no activas (403) y credenciales inválidas (401). Incluye `forzarCambioPassword` en la respuesta |
| `POST` | `/auth/change-password` | Requiere JWT. Cambia la contraseña y apaga `debe_cambiar_password` |

### Migración (`/migration`) — exclusivo Administrador

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/migration/upload` | Sube un `.xlsx`/`.xlsm` (máx. 50 MB), parsea las hojas T06–T44 |
| `GET` | `/migration/:fileId/preview` | Vista previa paginada/filtrable/ordenable de las filas parseadas |
| `GET` | `/migration/:fileId/stats` | Estadísticas agregadas del archivo (según filtros) |
| `GET` | `/migration/:fileId/filtros` | Opciones disponibles para los filtros (trenes, coches, estados, etc.) |
| `GET` | `/migration/:fileId/summary-by-tren` | Resumen por tren |
| `PATCH` | `/migration/:fileId/rows/:rowId` | Edita una fila en preview (con auditoría `ScanEditLog`) |
| `DELETE` | `/migration/:fileId/rows/:rowId` | Elimina una fila en preview |
| `DELETE` | `/migration/:fileId/tren/:numeroTren` | Elimina todas las filas de un tren en preview |
| `POST` | `/migration/:fileId/commit` | Confirma la migración: pasa de preview a `ScanRecord` definitivo |
| `DELETE` | `/migration/:fileId` | Cancela/descarta el archivo subido |

### Mediciones confirmadas (`/scan-records`) — exclusivo Administrador

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/scan-records` | Búsqueda paginada/filtrable/ordenable de mediciones ya confirmadas |
| `GET` | `/scan-records/summary-by-tren` | Resumen por tren |
| `GET` | `/scan-records/stats` | Estadísticas agregadas (según filtros) |
| `GET` | `/scan-records/filtros` | Opciones disponibles para los filtros |
| `PATCH` | `/scan-records/:id` | Edita una medición confirmada (con auditoría) |
| `DELETE` | `/scan-records/:id` | Elimina una medición confirmada |

### Tasa de desgaste (`/wear-rate`) — exclusivo Administrador

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/wear-rate/pairs` | Pares de mediciones consecutivas (`wear_rate_pairs`), filtrables/ordenables |
| `GET` | `/wear-rate/chart` | Serie para el gráfico de tasa de desgaste |
| `GET` | `/wear-rate/summary` | Estadísticas agregadas |

### Trazabilidad (`/traceability`) — exclusivo Administrador

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/traceability/summary` | Límites Gauss/Percentiles/Tukey + consenso + estadísticas generales, por scope (tren/tipoCoche/bogie) |
| `GET` | `/traceability/series` | Serie clasificada (normal/recortado/excluido) para los gráficos, por periodo |

### Parámetros del sistema (`/system-params`) — exclusivo Administrador

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/system-params` | Lista todos los parámetros configurables (umbrales, percentiles de consenso, etc.) |
| `PATCH` | `/system-params/:clave` | Actualiza un parámetro (con validación de reglas de negocio y auditoría) |

### Notificaciones (`/notifications`) — cualquier rol autenticado

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/notifications` | Notificaciones propias del usuario autenticado |

## Documentación relacionada

- [`DESPLIEGUE.md`](DESPLIEGUE.md) — guía operativa de desarrollo: primera instalación, uso
  diario, variables de entorno y solución de problemas comunes.
- [`schema_eva.sql`](schema_eva.sql) — script SQL de referencia del modelo de datos completo.
- [`database-schema-draft.md`](database-schema-draft.md) — resumen conceptual del modelo de datos.
- [`styles.md`](styles.md) — sistema de diseño del frontend (visible en `/design-system`).
