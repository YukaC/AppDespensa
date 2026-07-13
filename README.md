# Despensa Fernando

Local-first PWA for a pantry/grocery point of sale. Node + PostgreSQL backend; React + Vite + Dexie offline frontend.

## Requirements

- Node.js 20+
- PostgreSQL 16 (or Docker)
- PM2 (Windows production only; on Linux use the dev script)

## Linux — quick start (recommended)

On Arch / CachyOS:

```bash
sudo pacman -S nodejs npm
chmod +x scripts/dev-linux.sh scripts/setup-postgres-arch.sh
./scripts/dev-linux.sh install
```

If install failed with **P1001 Can't reach database**, pick a database option:

**Option A — native PostgreSQL (no Docker):**

```bash
./scripts/setup-postgres-arch.sh
./scripts/dev-linux.sh db
```

**Option B — Docker:**

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # re-login afterward
./scripts/dev-linux.sh db
```

Verify everything is healthy:

```bash
./scripts/dev-linux.sh check
```

Two terminals (**server first**, then client):

```bash
./scripts/dev-linux.sh server     # API :3001
./scripts/dev-linux.sh client     # UI :5173
```

### Common errors

| Error | Cause | Fix |
|-------|--------|-----|
| `vite: command not found` | Missing `npm install` in client | `./scripts/dev-linux.sh install` |
| `ECONNREFUSED` on `/api` proxy | API not running | Terminal 1: `./scripts/dev-linux.sh server` |
| `@prisma/client did not initialize` | No `prisma generate` | `npm run db:generate --prefix server` |
| `P1001 Can't reach database` | Postgres down | `./scripts/setup-postgres-arch.sh` or Docker + `./scripts/dev-linux.sh db` |

On Arch with npm 11, if Prisma skips binary installs:

```bash
cd server && npm approve-scripts --allow-scripts-pending && npm install
```

Show LAN IP to test from a phone on the same network:

```bash
./scripts/dev-linux.sh ip
```

| URL | Mode |
|-----|------|
| `http://localhost:5173` | **Admin** — Register, products, price increases |
| `http://YOUR_LAN_IP:5173` | **Read-only** — same as phone on WiFi |
| Default PIN | `1234` (in `server/.env`) |

PostgreSQL without a system install:

```bash
docker compose up -d postgres
```

`server/.env` already points to `postgresql://postgres:postgres@localhost:5432/despensa_fernando`.

**Firewall:** if the phone cannot load the UI, open port 5173 (and 3001 if you hit the API directly):

```bash
sudo ufw allow 5173/tcp   # if you use ufw
```

## Manual install

```bash
cp server/.env.example server/.env
# Edit DATABASE_URL and ADMIN_PIN in server/.env

npm run install:all
cd server && npm run db:generate && npm run db:push && npm run db:seed
```

## Development

Terminal 1 (API on `0.0.0.0:3001`):

```bash
npm run dev:server
```

Terminal 2 (UI on `localhost:5173`, `/api` proxy):

```bash
npm run dev:client
```

- **Register PC:** open `http://localhost:5173` → Admin mode (Register, Price increases, Products).
- **Phone on WiFi:** `http://192.168.x.x:5173` (or the PC IP) → read-only; PIN to unlock.

## Production (Windows + PM2)

```bash
npm run build:client
# Serve client/dist with IIS, nginx, or `npx serve -s client/dist -l 5173`
npm run start:prod
pm2 save
pm2 startup
```

## Register shortcuts (keyboard)

| Key | Action |
|-----|--------|
| F1 | Help |
| F2 | Search |
| F3 | Clear sale |
| F4 | Shortages |
| F8 / Space | Charge |
| Delete | Remove item |

## Main API

- `GET /api/productos/faltantes` — stock ≤ minimum
- `GET /api/productos/barcode/:codigo`
- `POST /api/ventas` — sale transaction + stock decrement
- `POST /api/aumentos` — `{ tipo, id, porcentaje }`
- `POST /api/sync/process-offline` — sales stored in Dexie

## Cloud backup

Configure in `server/.env`:

- `CLOUD_SYNC_URL` — nightly POST endpoint (3:00)
- `CLOUD_SYNC_TOKEN` — optional
