# Despliegue en desarrollo

Guía operativa para levantar y trabajar en EVA día a día. Para una descripción general del
proyecto, stack y estructura del monorepo, ver [`README.md`](README.md).

---

## 1. Prerrequisitos

- **Node.js 22+** y **npm 10+**.
- **Docker Desktop** (Postgres corre en un contenedor — no hace falta instalar Postgres
  directamente).
- El repo usa **npm workspaces** (`apps/api`, `apps/web`, `packages/shared`) — una sola
  instalación de dependencias desde la raíz alcanza para los tres.

## 2. Primera instalación (desde cero)

```bash
# 1. Dependencias (raíz — resuelve los 3 workspaces de una)
npm install

# 2. Postgres 16 vía Docker
docker compose up -d

# 3. Variables de entorno — ver sección 5. Si es la primera vez en esta máquina,
#    creá apps/api/.env y apps/web/.env con los valores de esa sección.

# 4. Migraciones + seed (desde apps/api)
cd apps/api
npx prisma migrate dev
npx prisma db seed
cd ../..

# 5. Levantar los dos servidores (dos terminales)
npm run start:dev --workspace apps/api    # http://localhost:3000
npm run dev --workspace apps/web           # http://localhost:5173
```

Entrá a `http://localhost:5173`, iniciá sesión con el administrador sembrado (ver
[`README.md`](README.md#usuarios-sembrados-solo-desarrollo)) y completá el cambio de
contraseña obligatorio del primer login.

## 3. Uso diario

- **Arrancar:** `docker compose up -d` (si Postgres no está corriendo) + los dos
  `npm run start:dev` / `npm run dev` de arriba, cada uno en su propia terminal.
- **Parar:** `Ctrl+C` en cada terminal. Postgres puede quedar corriendo entre sesiones
  (`docker compose down` si se quiere apagar del todo; los datos persisten en el volumen
  `eva-postgres-data` mientras no se borre).
- **Después de cambiar `prisma/schema.prisma`** (nuevo campo, modelo, enum, etc.):

  ```bash
  cd apps/api
  npx prisma migrate dev
  npx prisma generate
  ```

  y **reiniciá el servidor en watch** (`npm run start:dev`). En este setup el cliente de
  Prisma generado (`generated/prisma`) **no se regenera solo** con el watcher de Nest —
  si el server no refleja un cambio de schema recién hecho, este es el motivo casi
  siempre.
- **Reseed / volver a un estado limpio:**

  ```bash
  cd apps/api
  npx prisma db seed   # re-crea bogies, parámetros, usuario sistema, admin, 44 trenes
  ```

  No borra datos existentes por sí solo — para un reset completo, ver la sección de
  troubleshooting.
- **Explorar la base de datos:** `npx prisma studio` (desde `apps/api`) abre una UI en el
  navegador para ver/editar filas directamente.

## 4. Verificación antes de dar un cambio por terminado

```bash
# Backend (desde apps/api)
npm test          # Jest
npm run lint        # ESLint
npm run build         # nest build (tsc)

# Frontend (desde apps/web)
npm run build      # tsc -b && vite build
npm run lint          # ESLint
```

Si el cambio toca UI, además hay que probarlo en el navegador con los dos servidores
arriba — tests y build verifican que el código compila y no rompe nada, no que la
funcionalidad se vea/comporte como se espera.

## 5. Variables de entorno

### `apps/api/.env`

```bash
DATABASE_URL="postgresql://postgres:123456789@localhost:5432/eva?schema=public"
JWT_SECRET="<un secreto aleatorio largo>"   # generar uno nuevo por entorno, nunca reusar el de otro
JWT_EXPIRES_IN="8h"
WEB_ORIGIN="http://localhost:5173"           # opcional — origen permitido por CORS, default http://localhost:5173
```

`DATABASE_URL` debe coincidir con las credenciales de `docker-compose.yml`
(`postgres` / `123456789` / db `eva`) salvo que se lo edite ahí también.

### `apps/web/.env`

```bash
VITE_API_URL=http://localhost:3000
```

## 6. Problemas comunes

### Puerto ocupado (`EADDRINUSE`) al arrancar el backend o el frontend

El backend usa el `3000` y el frontend el `5173`. Si alguno ya está en uso (server
anterior que no cerró bien, otra terminal, etc.):

```powershell
# PowerShell — encontrar el proceso que escucha en el puerto
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

```bash
# Git Bash
netstat -ano | grep :3000 | grep LISTENING
taskkill //PID <PID> //F
```

Antes de matar un proceso, confirmá que es realmente el server anterior y no algo que
otra persona/terminal esté usando a propósito.

### Cambié `schema.prisma` pero el server sigue con el comportamiento viejo

Casi siempre falta uno de estos dos pasos (ver sección 3): `npx prisma generate` y
**reiniciar** `npm run start:dev` — el watcher de Nest recompila el TypeScript que
cambia, pero no regenera el cliente de Prisma ni relee un cliente ya cargado en memoria.

### Las credenciales del admin sembrado (`admin@eva-l1.local`) no funcionan

El seed las crea con `debe_cambiar_password=true`, así que el primer login real las
reemplaza por la contraseña nueva que se haya definido — si eso ya pasó en esta base de
datos, la contraseña del README ya no es la vigente. Opciones:

- Pedir la contraseña actual a quien la cambió.
- Restablecerla directo en la base con Prisma Studio (`npx prisma studio`, tabla `User`,
  aunque el campo es un hash — no se puede escribir a mano; hay que generarlo con
  `bcrypt.hash(nuevaPassword, 12)` en un script puntual).
- Empezar de una base limpia (ver siguiente punto) y correr el seed de nuevo.

### Quiero volver a una base de datos completamente limpia

```bash
cd apps/api
npx prisma migrate reset   # borra todo, vuelve a aplicar migraciones y corre el seed automáticamente
```

Esto es destructivo — borra todos los datos de la base `eva`, incluida cualquier
migración de Excel ya confirmada. Usar solo en desarrollo local.
