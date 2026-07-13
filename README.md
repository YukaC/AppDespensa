# Despensa Fernando

PWA local-first para punto de venta de despensa. Backend Node + PostgreSQL; frontend React + Vite + Dexie offline.

## Requisitos

- Node.js 20+
- PostgreSQL 16 (o Docker)
- PM2 (solo producción en Windows; en Linux usá el script de dev)

## Linux — pruebas rápidas (recomendado)

En Arch / CachyOS:

```bash
sudo pacman -S nodejs npm
chmod +x scripts/dev-linux.sh scripts/setup-postgres-arch.sh
./scripts/dev-linux.sh install
```

Si el install falló con **P1001 Can't reach database**, elegí una base de datos:

**Opción A — PostgreSQL nativo (sin Docker):**

```bash
./scripts/setup-postgres-arch.sh
./scripts/dev-linux.sh db
```

**Opción B — Docker:**

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # reiniciar sesión después
./scripts/dev-linux.sh db
```

Comprobá que todo esté bien:

```bash
./scripts/dev-linux.sh check
```

Dos terminales (**server primero**, luego client):

```bash
./scripts/dev-linux.sh server     # API :3001
./scripts/dev-linux.sh client     # UI :5173
```

### Errores frecuentes

| Error | Causa | Solución |
|-------|--------|----------|
| `vite: orden no encontrada` | Faltaba `npm install` en client | `./scripts/dev-linux.sh install` |
| `ECONNREFUSED` en proxy `/api` | API no está corriendo | Terminal 1: `./scripts/dev-linux.sh server` |
| `@prisma/client did not initialize` | Sin `prisma generate` | `npm run db:generate --prefix server` |
| `P1001 Can't reach database` | Postgres apagado | `./scripts/setup-postgres-arch.sh` o Docker + `./scripts/dev-linux.sh db` |

En Arch con npm 11, si Prisma no instala binarios:

```bash
cd server && npm approve-scripts --allow-scripts-pending && npm install
```

Ver IP para simular el celular en la misma red:

```bash
./scripts/dev-linux.sh ip
```

| URL | Modo |
|-----|------|
| `http://localhost:5173` | **Admin** — Caja, productos, aumentos |
| `http://TU_IP_LAN:5173` | **Solo lectura** — como el móvil en WiFi |
| PIN por defecto | `1234` (en `server/.env`) |

PostgreSQL sin instalarlo en el sistema:

```bash
docker compose up -d postgres
```

El `server/.env` ya apunta a `postgresql://postgres:postgres@localhost:5432/despensa_fernando`.

**Firewall:** si el celular no carga la UI, abrí el puerto 5173 (y 3001 si accedés directo a la API):

```bash
sudo ufw allow 5173/tcp   # si usás ufw
```

## Instalación manual

```bash
cp server/.env.example server/.env
# Editar DATABASE_URL y ADMIN_PIN en server/.env

npm run install:all
cd server && npm run db:generate && npm run db:push && npm run db:seed
```

## Desarrollo

Terminal 1 (API en `0.0.0.0:3001`):

```bash
npm run dev:server
```

Terminal 2 (UI en `localhost:5173`, proxy `/api`):

```bash
npm run dev:client
```

- **PC caja:** abrir `http://localhost:5173` → modo Admin (Caja, Aumentos, Productos).
- **Móvil WiFi:** `http://192.168.x.x:5173` (o IP del PC) → solo lectura; PIN para desbloquear.

## Producción (Windows + PM2)

```bash
npm run build:client
# Servir client/dist con IIS, nginx o `npx serve -s client/dist -l 5173`
npm run start:prod
pm2 save
pm2 startup
```

## Atajos Caja (teclado)

| Tecla | Acción |
|-------|--------|
| F1 | Ayuda |
| F2 | Buscar |
| F3 | Limpiar venta |
| F4 | Faltantes |
| F8 / Espacio | Cobrar |
| Supr | Quitar ítem |

## API principal

- `GET /api/productos/faltantes` — stock ≤ mínimo
- `GET /api/productos/barcode/:codigo`
- `POST /api/ventas` — transacción venta + descuento stock
- `POST /api/aumentos` — `{ tipo, id, porcentaje }`
- `POST /api/sync/process-offline` — ventas guardadas en Dexie

## Backup nube

Configurar en `server/.env`:

- `CLOUD_SYNC_URL` — endpoint POST nocturno (3:00)
- `CLOUD_SYNC_TOKEN` — opcional
