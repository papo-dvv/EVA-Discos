# EVA — Instrucciones para Claude

## 🧠 Sobre el proyecto
**EVA — de Línea 1 de Lima** es un sistema de **trazabilidad de discos de freno** para el
Metro de Lima Línea 1: registro de mediciones (T, H, Rd), reglas de estado
(OK / Seguimiento / Cambio / Crítico), migración masiva del historial en Excel, calendario
de mantenimiento y control de acceso por rol.

Stack: **NestJS 11 + Prisma 7 + PostgreSQL 16** (backend) · **React 19 + Vite + TanStack Query/Table + Tailwind v4** (frontend) · **monorepo con npm workspaces**.

> `README.md` en la raíz tiene la puesta en marcha detallada (Docker, migraciones, seed,
> credenciales sembradas, endpoints). Léelo antes de tocar infraestructura o el arranque.

---

## ⚙️ Reglas generales

- **Español** en comentarios de código, mensajes de commit y respuestas al usuario.
- No expliques lo que vas a hacer antes de hacerlo; hazlo y reporta el resultado. Sé conciso.
- Prioriza **componentes reutilizables y tipados** (TypeScript estricto en todo el monorepo).
- Antes de tocar cualquier UI, lee **`styles.md`** (sistema de diseño Liquid Glass / Apple).
  El catálogo vivo está en la ruta `/design-system` del frontend.
- **El backend es la única fuente de verdad para las reglas de negocio.** Nunca confíes en
  el estado que traiga un Excel; recalcula siempre `rd_value` y `estado_calculado` con
  `BrakeDiscRulesModule`.
- Tras cambiar `schema.prisma`: `npx prisma migrate dev` **y** `npx prisma generate`, y
  **reinicia el servidor en watch** (en este setup el cliente no se regenera solo).
- Al terminar una tarea, verifica: `npm test` + `npm run lint` (api) y `npm run build` (web).
  Si dejas datos de prueba en la BD, límpialos y restaura el seed documentado.

---

## 🗂️ Estructura del monorepo
```
/apps
  /api        NestJS + Prisma — API REST, auth, reglas de negocio, migración
    prisma/schema.prisma   Modelo de datos completo (traducción 1:1 de schema_eva.sql)
    prisma/seed.ts          Bogies, parámetros, usuario "sistema", admin, 44 trenes
    src/prisma/              PrismaService inyectable
    src/auth/                 Login, cambio de password obligatorio, JWT, @Roles + RolesGuard
    src/brake-disc-rules/      Motor de reglas puro (sin Prisma): calcularRd, clasificarEstado
    src/migration/             Carga masiva de Excel (xlsx/xlsm), preview, edición y commit
  /web        React + Vite — frontend
    src/auth/          Contexto de sesión (JWT en localStorage) + guards de ruta
    src/features/       Lógica por dominio (api + hooks TanStack Query), ej. migration/
    src/pages/          Vistas (Login, Inicio, MigracionUpload, MigracionPreview, Galeria…)
    src/components/      Piezas reutilizables
    src/styles/          Tokens CSS del sistema de diseño
/packages
  /shared     Tipos/enums compartidos entre api y web (espejo de la base de datos)
docker-compose.yml       Postgres 16 para desarrollo local
schema_eva.sql            Referencia SQL del modelo de datos completo
styles.md                 Sistema de diseño del frontend (Liquid Glass / Apple)
```

---

## 📐 Reglas de negocio (discos de freno)
- **Rd = T − H** (`rd_value`, campo Float en `ScanRecord`).
- Clasificación de `estado_calculado` según Rd:
  | Estado | Condición |
  |---|---|
  | `OK` | Rd ≥ 1.0 |
  | `SEGUIMIENTO` | 0.4 < Rd < 1.0 |
  | `CAMBIO` | 0 < Rd ≤ 0.4 |
  | `CRITICO` | Rd ≤ 0 |
- Umbrales exactos y acción recomendada viven en `BrakeDiscRulesModule` y en
  `system_params` (seed). No los hardcodees en otro lado.

---

## 🎯 Módulos
- **Auth** — login, JWT + roles, cambio de contraseña obligatorio. El usuario `sistema`
  (`es_usuario_sistema=true`) tiene el login rechazado con 403 antes de validar la password.
- **BrakeDiscRules** — motor de reglas puro (sin dependencias de Prisma en la lógica).
- **Migration** — carga masiva del histórico en Excel (hojas T06–T44), vista previa editable
  con auditoría (`ScanEditLog`, `etapa='pre_commit'`) y confirmación (review → committed).
- **Trazabilidad / Dashboard / Calendario de mantenimiento** — planificados, aún no implementados.

---

## 🔒 Acceso por rol
Protege endpoints con `@Roles(...roles)` + `@UseGuards(JwtAuthGuard, RolesGuard)`.
La migración de Excel es exclusiva de `administrador`.
