# Despensa Fernando — demo estática

**Demo en vivo: <https://despensapos.vercel.app>**

Demo de entrevista del POS de despensa: React + Vite en el navegador, **sin backend, sin PostgreSQL y sin
variables de entorno**. Todo el estado vive en `localStorage`.

La app real sigue igual: `npm run build` (sin `VITE_DEMO`) habla con la API Express de siempre.

## Cómo correr la demo

```bash
cd client
npm install
npm run build:demo
npx vite preview --port 4180
# http://localhost:4180
```

Atajos útiles:

- **PIN de demo: `1234`** (abrir ciclo de facturación, ingreso de mercadería, acciones con PIN).
- Resetear la demo: abrir `http://localhost:4180/?demo-reset=1` una vez, o borrar la clave
  `despensa-demo:state:v1` de `localStorage`.
- Tests del backend de demo: `npm run test:demo`.

## Qué es la demo

El punto de entrada es el mismo de siempre: `src/lib/api.js`. Cuando el build tiene `VITE_DEMO=1`, `api.js`
entrega una implementación que responde en el navegador (`src/lib/demo/`) en lugar de llamar a `fetch`.
Las páginas y componentes **no se tocaron**: Caja, Cuentas, Facturación, Reportes, Productos y Consulta usan
el mismo contrato.

| Archivo | Rol |
|---|---|
| `src/lib/demo/seed.js` | Semilla determinista: 26 productos de despensa argentina, 6 clientes, 3 ciclos cerrados, 1 ciclo abierto, 12 ventas, cargos y pagos. |
| `src/lib/demo/backend.js` | Backend en memoria/localStorage. Mismas rutas, verbos, códigos HTTP y shape de JSON que `server/src/routes/**`. |
| `src/lib/demo/index.js` | Expone el mismo contrato que consume `api.js` (la fachada que ven las páginas). |
| `src/lib/demo/config.js` | Flag `VITE_DEMO`, PIN y clave de storage. |
| `src/lib/demo/backend.test.js` | Tests de comportamiento con `node --test` (seed, ventas, cuenta corriente, ciclos, reportes). |

Persistencia: `localStorage`, prefijo `despensa-demo:` (clave única `despensa-demo:state:v1`). Cada navegador
tiene su propia copia; no hay sincronización entre dispositivos.

## Qué está simulado (y qué invariantes respeta)

- **Productos / stock**: listado, búsqueda por nombre o código de barras, faltantes y vencimientos desde la semilla.
- **Caja**: carrito, cobro en efectivo / transferencia / tarjeta, y venta a cuenta corriente.
- **Cuenta corriente**: la venta a cuenta crea un movimiento `CARGO` con el mismo `ventaId` (invariante V3 de
  `SPEC.md`). Las ventas a cuenta **no** se guardan como offline: el código existente de `offlineSync.js`
  sigue bloqueando ese camino sin conexión (V1), y la demo siempre responde en el navegador.
- **Cobros**: registrar un pago crea un `PAGO`; **no borra la venta ni el cargo** (V4). El saldo se calcula
  como `CARGO - PAGO`.
- **Historial y tickets**: listado paginado de ventas y detalle del ticket, con los mismos campos que la API.
- **Ciclos**: abrir exige PIN (V6), cerrar calcula total y tickets, y las ventas del ciclo abierto llevan
  `cicloId` (V5). El primer ciclo arranca abierto para poder vender apenas se abre la demo.
- **Reportes**: rendimiento, top de productos, ventas diarias/mensuales por método de pago y reportes
  contables (mensual, semanal, anual y por rango) calculados sobre la semilla.
- **PDFs**: los que ya genera el cliente (`src/lib/pdfFacturacion.js`) funcionan sin cambios (ticket, resumen
  de ciclo, reportes).
- **Acceso**: en el build demo la app se comporta como la PC admin aunque esté publicada en Vercel
  (`src/lib/access.js`), para poder mostrar Caja, Dashboard y Cierre mensual.

## Rutas de API cubiertas por el backend de demo

Mismos paths que `server/src/routes/**`:

- `GET /api/health`
- `POST /api/auth/pin`
- `GET /api/productos`, `GET /api/productos/:id`, `GET /api/productos/barcode/:codigo`,
  `GET /api/productos/faltantes`, `GET /api/productos/faltantes/count`,
  `POST|PUT|DELETE /api/productos...`
- `GET|POST /api/proveedores`, `GET|POST /api/marcas`
- `GET /api/ventas?page=`, `POST /api/ventas`
- `GET /api/ciclos/actual`, `GET /api/ciclos`, `GET /api/ciclos/:id`,
  `POST /api/ciclos/abrir` (PIN), `POST /api/ciclos/:id/cerrar`
- `GET /api/reportes/rendimiento`, `/top-productos`, `/proximos-vencimientos`, `/ventas-diarias`,
  `/ventas-mensuales`, `/ventas-por-pago`, `/contables/mensual`, `/contables/semanal`, `/contables/anual`,
  `/contables/rango`
- `GET /api/clientes`, `/resumen`, `/verificar`, `/nombre/:nombre`, `/clientes/:id`,
  `POST /api/clientes`, `POST /api/clientes/:id/pagos`, `POST /api/clientes/pago-libre`,
  `DELETE /api/clientes/:id`, `/libre/:nombre`, `/movimientos/:movId`
- `POST /api/stock/ingreso` (PIN), `POST /api/aumentos`, `GET /api/aumentos/historial[/:productoId]`
- `POST /api/sync/process-offline`, `POST /api/sync/queue`
- `GET /api/backup`, `GET /api/backup/estado/:anio/:mes` (siempre vacío)

## Lo que NO está en la demo

Deliberadamente fuera de alcance; la UI muestra un error honesto ("no está incluida en la demo estática")
en vez de romperse:

- **Backups y cierre mensual**: crear backup en nube, descargar backup físico, registrar backup en PC,
  archivar pagados y purgar backups. `GET /api/backup/estado/:anio/:mes` responde vacío para que la pantalla
  se vea, pero las acciones devuelven `501` con ese mensaje.
- **PostgreSQL, Prisma y el server Express**: no se ejecutan.
- **Login real**: el PIN `1234` vive en el bundle y no autentica contra nada.
- **Multi-dispositivo / sincronización real**: cada navegador tiene su `localStorage`.
- **Facturación electrónica / ARCA / CAE**: nunca existió en el producto (ver `SPEC.md`).
- **Historial anterior a la semilla**: no hay datos previos a los ~5 días que arma el seed.
- **Validaciones de servidor** (stock concurrente, locks, transacciones reales): acá el estado es de un solo
  navegador.
- **Cámara del lector de códigos**: depende de permisos del navegador; el buscador y el código de barras
  tipeado funcionan siempre.

## Deploy en Vercel

El repo es un monorepo (`client/` + `server/`). En Vercel:

- **Root Directory**: `client`
- **Framework Preset**: Vite
- **Build Command**: `npm run build:demo`
- **Output Directory**: `dist`
- **Environment variables**: ninguna

`client/vercel.json` ya declara esos valores y el rewrite SPA a `/index.html`. La demo no hace ni una llamada
a `/api`.

Si el navegador ya tenía abierta una versión anterior, puede quedar el service worker de la PWA con caché:
recargar con `Ctrl+Shift+R` o cerrar y volver a abrir la pestaña.

## Build sin demo (app real)

```bash
cd client
npm install
npm run build      # sin VITE_DEMO: comportamiento y bundle idénticos a antes
```

En ese build `api.js` no importa el módulo demo (Rollup lo elimina) y todas las llamadas siguen yendo a
`VITE_API_URL` o `/api`.
