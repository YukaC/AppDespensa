# SPEC — AppDespensa / Autoservicio FALL

## §G

POS despensa + ciclos facturación contable. Caja vende, ciclo diario cierra, PDFs al contador. Cuenta corriente anota deuda por cliente. ⊥ integración ARCA/CAE.

## §C

- stack: React (Vite) + Express + PostgreSQL + Prisma
- offline OK solo ventas efectivo/tarjeta/transferencia — **cuenta ! offline**
- sync offline → mismo `registrarVenta` que POST `/api/ventas`
- cobro cuenta → PAGO en `CuentaMovimiento`; **⊥ delete Venta** al pagar deuda
- abrir ciclo → PIN admin

## §I

```
api: POST /api/ventas → 201 Venta + detalles; Cuenta → + CuentaMovimiento CARGO
api: POST /api/sync/process-offline → batch ventas pendientes IndexedDB
api: POST /api/ciclos/abrir → PIN header/body
api: POST /api/clientes/:id/pagos | /pago-libre → PAGO; Venta intacta
client: crearVentaConFallback → Caja cobro
client: guardarVentaOffline → Dexie ventasPendientes
db: Venta.cicloId → Ciclo; CuentaMovimiento.ventaId → Venta (CARGO)
toast offline: "Venta guardada offline. Se sincronizará al reconectar."
```

## §V

```
V1: ∀ venta metodoPago=Cuenta → ⊥ guardarVentaOffline; API fail → error usuario, ! toast offline éxito
V2: ∀ sync offline payload → incluye clienteId | clienteNombre | registrarCliente | clienteTelefono cuando Cuenta
V3: ∀ Venta metodoPago=Cuenta persistida → ∃ CuentaMovimiento tipo=CARGO mismo ventaId & cliente ref
V4: ∀ cobro cuenta (procesarPago) → registrar PAGO; Venta & CARGO permanecen (facturación/cierre)
V5: ∀ ciclo abierto → venta nueva.cicloId ! null
V6: abrir ciclo → requirePin
```

## §T

```
id|status|task|cites
T1|x|ciclos facturación abrir/cerrar/PDF|§G
T2|x|reportes contables mensual/anual|§G
T3|x|cobro cuenta sin borrar tickets|V4
T4|x|fix offline cuenta sin cargo|V1,V2,V3
T5|x|reparar venta #14 Pablo — clienteId=6 + CARGO id=17 $1200|V3,B1
T6|x|reparar venta #7 agustin — reactivar cliente + CARGO id=18 $632.40|V3,B2
```

## §B

```
id|date|cause|fix
B1|2026-06-05|1er ciclo facturación (cicloId=1) · venta #14 $1200 Polenta · debió ir a cliente Pablo (id=6) · UI toast offline falso · sync sin cliente → Venta Cuenta sin CARGO|V1,V2,V3 · fix offlineSync + lib/venta.js · **reparado**: venta #14 → clienteId=6, CARGO #17 $1200
B2|2026-06-05|venta #7 $632.40 Fideos · cliente agustin (id=2) · Venta.clienteId ok · CARGO ⊥ · cliente inactivo → no visible en Cuentas|V3 · **reparado**: reactivar agustin, CARGO #18 $632.40, saldo=632.40
```
