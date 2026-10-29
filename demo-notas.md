# demo-notas — AppDespensa modo demo estático

Notas de implementación de la demo de entrevista (T5 / specs S3, S4, S6 de `odd/tasks/demos-entrevista.md`).
Sin commit: el worktree tenía WIP ajeno.

## Archivos

Nuevos:

- `client/src/lib/demo/config.js` — flag `VITE_DEMO === '1'`, PIN `1234`, clave `despensa-demo:state:v1`.
- `client/src/lib/demo/seed.js` — semilla determinista (montos fijos, sin `Math.random`): 26 productos,
  20 marcas, 4 proveedores, 6 clientes, 12 ventas, 3 ciclos cerrados + 1 abierto, cargos y pagos.
- `client/src/lib/demo/backend.js` — backend en navegador, mismas rutas/verbos/status/shape que
  `server/src/routes/**`; estado en `localStorage`.
- `client/src/lib/demo/index.js` — fachada con el mismo contrato que consume `api.js`.
- `client/src/lib/demo/backend.test.js` — 14 tests de comportamiento (`node --test`).
- `client/vercel.json` — framework Vite, `npm run build:demo`, `dist`, rewrite SPA.
- `client/README.md` — README de la demo (qué es, PIN, correr, deploy, qué no está).
- `demo-notas.md` — este archivo.

Tocados:

- `client/src/lib/api.js` — `realApi` intacto; `api = DEMO_MODE ? createDemoApi() : realApi`.
- `client/src/lib/access.js` — en build demo se comporta como host admin (Vercel no es localhost).
- `client/package.json` — `build:demo`, `test:demo`.

Fuera de las superficies permitidas no se tocó nada: ni páginas, ni componentes, ni `server/**`, ni `SPEC.md`.

## Logica de negocio replicada (mínima)

`registrarVenta` y `procesarPago` del server no existen en el cliente, así que el backend de demo replica solo
lo necesario y conserva los invariantes de `SPEC.md`:

- V3: venta `Cuenta` → un `CARGO` con el mismo `ventaId` y el cliente.
- V4: `PAGO` no borra venta ni cargo; el saldo es `CARGO - PAGO`.
- V5: la venta toma el `cicloId` del ciclo abierto.
- V6: `POST /api/ciclos/abrir` exige `X-Admin-Pin`.
- V1: no hay camino offline para `Cuenta`; la demo responde siempre en el navegador y `offlineSync.js`
  (sin cambios) sigue bloqueando cuenta sin conexión.

La semilla usa montos/cantidades fijos y fechas relativas al día de apertura (para que Dashboard y reportes
no estén vacíos). Por eso los números son iguales en cualquier máquina, pero las fechas se corren con el día.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `cd client && npm run test:demo` | 14/14 pass (seed determinista, venta efectivo, venta cuenta + CARGO, pago no borra venta, PIN, reportes, backup 501, contrato de la fachada) |
| `cd client && VITE_DEMO=1 npm run build` | exit 0 · `dist/assets/index-*.js` 1.7 MB |
| `npx vite preview --port 4180` + Playwright | venta efectivo → aparece en historial (`Venta #13`); venta a cuenta de Coca-Cola a Marta Giménez → Cuentas muestra `$ 8.860,00` y `Ticket #14`; cerrar ciclo → reabrir con PIN `1234`; `localStorage` con 14 ventas / 5 cargos / 3 pagos / 5 ciclos; **0 requests a `/api`**, **0 errores de consola** |
| `npm run build` (sin flag) | exit 0 · sin strings del seed en el bundle (Rollup elimina el módulo demo) |
| `npx vite preview` del build real + Playwright | pide `/api/productos/faltantes`, `/api/productos/faltantes/count`, `/api/ciclos/actual`; no toca `despensa-demo:state:v1` |
| demo servida por IP LAN (host no-localhost) | modo admin, nav con Dashboard, 0 requests a `/api`, 0 errores |

## Lo que NO está en la demo

- Backups / cierre mensual (nube, físico, descarga, archivar, purgar): los POST devuelven `501` con
  "no está incluida en la demo estática"; `estado` devuelve vacío para que la pantalla no explote.
- PostgreSQL, Prisma, server Express, migraciones.
- Login real: el PIN está en el bundle y no autentica contra nada.
- Sincronización entre dispositivos; cada navegador tiene su propio `localStorage`.
- Facturación electrónica / ARCA / CAE (nunca existió en el producto).
- Datos anteriores a los ~5 días de la semilla.
- Validaciones de concurrencia de un servidor real.

## Riesgos / límites conocidos

- `localStorage` puede estar bloqueado en modo privado; el backend cae a memoria (la demo funciona, no persiste).
- El primer ciclo viene abierto para poder vender de entrada; para probar el PIN hay que cerrarlo primero.
- El service worker de la PWA puede servir un build anterior hasta hacer hard reload.
- En Vercel el rewrite SPA manda todo a `index.html`; no hay `/api`, a propósito.
