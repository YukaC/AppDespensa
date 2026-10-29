import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackend, createMemoryStorage } from './backend.js';
import { buildSeedState } from './seed.js';
import { createDemoApi } from './index.js';

function setup() {
  const backend = createDemoBackend({ storage: createMemoryStorage() });
  const call = (method, path, { body, pin } = {}) =>
    backend.handle(method, path, {
      body,
      headers: pin ? { 'x-admin-pin': pin } : {},
    });
  return { backend, call };
}

function stockOf(call, id) {
  return call('GET', `/api/productos/${id}`).body.stock;
}

test('seed is deterministic and looks like an Argentine grocery store', () => {
  const anchor = new Date('2026-10-29T12:00:00.000-03:00');
  const a = buildSeedState(anchor);
  const b = buildSeedState(anchor);
  assert.deepEqual(a, b);

  assert.ok(a.productos.length >= 20);
  assert.ok(a.clientes.length >= 5);
  assert.ok(a.ventas.length >= 10);

  const yerba = a.productos.find((p) => /yerba mate/i.test(p.nombre));
  assert.ok(yerba, 'seed must include yerba mate');
  assert.ok(yerba.precio > 0);
  assert.ok(yerba.codigoBarras);
  assert.ok(yerba.stock > 0);

  for (const venta of a.ventas) {
    const expected = venta.detalles.reduce((s, d) => s + d.precioUnit * d.cantidad, 0);
    assert.equal(Number(venta.total.toFixed(2)), Number(expected.toFixed(2)));
  }
});

test('seed provides closed cycles plus one open cycle', () => {
  const { call } = setup();
  const ciclos = call('GET', '/api/ciclos').body;
  assert.ok(ciclos.some((c) => c.estado === 'cerrado'));
  assert.ok(ciclos.some((c) => c.estado === 'abierto'));

  const actual = call('GET', '/api/ciclos/actual');
  assert.equal(actual.status, 200);
  assert.equal(actual.body.estado, 'abierto');
  assert.ok(actual.body.resumen.cantidadTickets > 0);
  assert.ok(actual.body.ventas.length > 0);
});

test('opening a cycle requires the demo PIN', () => {
  const { call } = setup();
  const open = call('GET', '/api/ciclos/actual').body;

  const closed = call('POST', `/api/ciclos/${open.id}/cerrar`);
  assert.equal(closed.status, 200);
  assert.equal(closed.body.estado, 'cerrado');
  assert.ok(closed.body.fechaCierre);
  assert.ok(closed.body.resumen.cantidadTickets > 0);

  const withoutPin = call('POST', '/api/ciclos/abrir', { body: {} });
  assert.equal(withoutPin.status, 401);

  const wrongPin = call('POST', '/api/ciclos/abrir', { body: { pin: '0000' } });
  assert.equal(wrongPin.status, 401);

  const opened = call('POST', '/api/ciclos/abrir', { body: { pin: '1234' } });
  assert.equal(opened.status, 201);
  assert.equal(opened.body.estado, 'abierto');

  const again = call('POST', '/api/ciclos/abrir', { body: { pin: '1234' } });
  assert.equal(again.status, 400);
  assert.match(again.body.error, /Ya hay un ciclo abierto/);
});

test('cash sale appears in history, lowers stock and creates no account charge', () => {
  const { call } = setup();
  const producto = call('GET', '/api/productos').body[0];
  const before = stockOf(call, producto.id);

  const res = call('POST', '/api/ventas', {
    body: { items: [{ productoId: producto.id, cantidad: 2 }], metodoPago: 'Efectivo' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.metodoPago, 'Efectivo');
  assert.equal(res.body.total, Number((producto.precio * 2).toFixed(2)));

  assert.equal(stockOf(call, producto.id), before - 2);

  const history = call('GET', '/api/ventas?page=1').body;
  const found = history.ventas.find((v) => v.id === res.body.id);
  assert.ok(found, 'sale must be listed in history');
  assert.equal(found.detalles.length, 1);
  assert.equal(found.detalles[0].producto.nombre, producto.nombre);
  assert.ok(history.total >= history.ventas.length);
});

test('account sale creates a CARGO with the same ventaId and raises the client debt', () => {
  const { call } = setup();
  const cliente = call('GET', '/api/clientes').body.find((c) => c.nombre === 'Marta Giménez');
  const producto = call('GET', '/api/productos').body.find((p) => p.stock > 3);
  const before = call('GET', `/api/clientes/${cliente.id}`).body;

  const res = call('POST', '/api/ventas', {
    body: {
      items: [{ productoId: producto.id, cantidad: 2 }],
      metodoPago: 'Cuenta',
      clienteId: cliente.id,
    },
  });
  assert.equal(res.status, 201);

  const after = call('GET', `/api/clientes/${cliente.id}`).body;
  assert.equal(
    Number(after.saldo.toFixed(2)),
    Number((before.saldo + res.body.total).toFixed(2))
  );

  const cargo = after.movimientos.find(
    (m) => m.tipo === 'CARGO' && m.ventaId === res.body.id
  );
  assert.ok(cargo, 'Cuenta sale must create a CARGO movement');
  assert.equal(cargo.monto, res.body.total);

  const sale = call('GET', '/api/ventas?page=1').body.ventas.find((v) => v.id === res.body.id);
  assert.ok(sale, 'account sale must remain in sales history');
  assert.equal(sale.metodoPago, 'Cuenta');
});

test('account sale rejects missing client and insufficient stock without side effects', () => {
  const { call } = setup();
  const producto = call('GET', '/api/productos').body[0];
  const stockBefore = producto.stock;
  const totalBefore = call('GET', '/api/ventas?page=1').body.total;

  const noClient = call('POST', '/api/ventas', {
    body: { items: [{ productoId: producto.id, cantidad: 1 }], metodoPago: 'Cuenta' },
  });
  assert.equal(noClient.status, 400);
  assert.equal(
    noClient.body.error,
    'Indicá un cliente registrado o un nombre para anotar en cuenta'
  );

  const tooMany = call('POST', '/api/ventas', {
    body: {
      items: [{ productoId: producto.id, cantidad: stockBefore + 1 }],
      metodoPago: 'Efectivo',
    },
  });
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.error, `Stock insuficiente para ${producto.nombre}`);

  const unknown = call('POST', '/api/ventas', {
    body: { items: [{ productoId: 999999, cantidad: 1 }], metodoPago: 'Efectivo' },
  });
  assert.equal(unknown.status, 400);

  assert.equal(stockOf(call, producto.id), stockBefore);
  assert.equal(call('GET', '/api/ventas?page=1').body.total, totalBefore);
});

test('payment registers a PAGO and never deletes the sale or its CARGO', () => {
  const { call } = setup();
  const cliente = call('GET', '/api/clientes').body.find((c) => c.nombre === 'Marta Giménez');
  const before = call('GET', `/api/clientes/${cliente.id}`).body;
  const cargosBefore = before.movimientos.filter((m) => m.tipo === 'CARGO');
  assert.ok(cargosBefore.length > 0);
  const saleId = cargosBefore[0].ventaId;

  const pago = call('POST', `/api/clientes/${cliente.id}/pagos`, {
    body: { monto: 100, notas: 'Cobro demo' },
  });
  assert.equal(pago.status, 201);
  assert.equal(pago.body.tipo, 'pago_parcial');
  assert.equal(pago.body.pago.tipo, 'PAGO');
  assert.equal(pago.body.pago.ventaId, null);

  const after = call('GET', `/api/clientes/${cliente.id}`).body;
  assert.equal(Number(after.saldo.toFixed(2)), Number((before.saldo - 100).toFixed(2)));
  assert.ok(after.movimientos.some((m) => m.tipo === 'PAGO' && m.monto === 100));

  const cargo = after.movimientos.find((m) => m.tipo === 'CARGO' && m.ventaId === saleId);
  assert.ok(cargo, 'CARGO must survive the payment');
  const sale = call('GET', '/api/ventas?page=1').body.ventas.find((v) => v.id === saleId);
  assert.ok(sale, 'sale must survive the payment');
});

test('payment cannot exceed the debt and rejects non positive amounts', () => {
  const { call } = setup();
  const cliente = call('GET', '/api/clientes').body.find((c) => c.nombre === 'Marta Giménez');
  const detail = call('GET', `/api/clientes/${cliente.id}`).body;
  const movBefore = detail.movimientos.length;

  const excess = call('POST', `/api/clientes/${cliente.id}/pagos`, {
    body: { monto: detail.saldo + 1 },
  });
  assert.equal(excess.status, 400);
  assert.match(excess.body.error, /supera la deuda/);

  const zero = call('POST', `/api/clientes/${cliente.id}/pagos`, {
    body: { monto: 0 },
  });
  assert.equal(zero.status, 400);
  assert.equal(zero.body.error, 'Monto positivo obligatorio');

  assert.equal(
    call('GET', `/api/clientes/${cliente.id}`).body.movimientos.length,
    movBefore
  );
});

test('full payment closes the account while keeping both tickets and charges', () => {
  const { call } = setup();
  const cliente = call('GET', '/api/clientes').body.find((c) => c.nombre === 'Marta Giménez');
  const detail = call('GET', `/api/clientes/${cliente.id}`).body;
  const cargos = detail.movimientos.filter((m) => m.tipo === 'CARGO').length;
  const salesBefore = call('GET', '/api/ventas?page=1').body.total;

  const pago = call('POST', `/api/clientes/${cliente.id}/pagos`, {
    body: { monto: detail.saldo },
  });
  assert.equal(pago.status, 201);
  assert.equal(pago.body.tipo, 'cuenta_cerrada');

  const after = call('GET', `/api/clientes/${cliente.id}`).body;
  assert.equal(Number(after.saldo.toFixed(2)), 0);
  assert.equal(after.movimientos.filter((m) => m.tipo === 'CARGO').length, cargos);
  assert.equal(call('GET', '/api/ventas?page=1').body.total, salesBefore);
});

test('product search, barcode lookup and faltantes read the seeded stock', () => {
  const { call } = setup();
  const results = call('GET', '/api/productos?q=yerba').body;
  assert.ok(results.length >= 1);
  assert.ok(results.every((p) => /yerba/i.test(p.nombre)));

  const producto = results[0];
  const byCode = call('GET', `/api/productos/barcode/${producto.codigoBarras}`);
  assert.equal(byCode.status, 200);
  assert.equal(byCode.body.id, producto.id);

  const missing = call('GET', '/api/productos/barcode/0000000000000');
  assert.equal(missing.status, 404);

  const faltantes = call('GET', '/api/productos/faltantes').body;
  assert.ok(faltantes.length >= 1);
  assert.ok(faltantes.every((p) => p.stock <= p.stockMinimo));
  assert.equal(
    call('GET', '/api/productos/faltantes/count').body.count,
    faltantes.length
  );
});

test('client accounts summary exposes debts for registered and free accounts', () => {
  const { call } = setup();
  const resumen = call('GET', '/api/clientes/resumen').body;
  assert.ok(resumen.length >= 2);

  const marta = resumen.find((c) => c.clienteNombre === 'Marta Giménez');
  assert.ok(marta);
  assert.ok(marta.saldo > 0);
  assert.equal(marta.registrado, true);

  const libre = resumen.find((c) => c.registrado === false);
  assert.ok(libre);
  assert.ok(libre.saldo > 0);
});

test('reports return seeded data instead of empty screens', () => {
  const { call } = setup();
  const rendimiento = call('GET', '/api/reportes/rendimiento').body;
  assert.ok(rendimiento.mes_actual > 0);

  assert.ok(call('GET', '/api/reportes/top-productos').body.length > 0);
  assert.ok(call('GET', '/api/reportes/ventas-diarias?dias=30').body.length > 0);
  assert.ok(call('GET', '/api/reportes/ventas-mensuales?meses=6').body.length > 0);
  assert.ok(call('GET', '/api/reportes/ventas-por-pago?dias=30').body.length > 0);
  assert.ok(call('GET', '/api/reportes/proximos-vencimientos').body.length > 0);

  const ciclo = call('GET', '/api/ciclos').body.find((c) => c.estado === 'cerrado');
  const fecha = new Date(ciclo.fechaApertura);
  const mensual = call(
    'GET',
    `/api/reportes/contables/mensual?anio=${fecha.getFullYear()}&mes=${fecha.getMonth() + 1}`
  ).body;
  assert.ok(mensual.jornadas >= 1);
  assert.ok(mensual.cantidadTickets > 0);
});

test('backup and monthly close are reported as not included in the demo', () => {
  const { call } = setup();
  const estado = call('GET', '/api/backup/estado/2026/9');
  assert.equal(estado.status, 200);
  assert.equal(estado.body.nube, null);
  assert.equal(estado.body.fisico, null);

  const nube = call('POST', '/api/backup/nube', {
    body: { anio: 2026, mes: 9, pin: '1234' },
    pin: '1234',
  });
  assert.equal(nube.status, 501);
  assert.match(nube.body.error, /no está incluida en la demo/i);
});

test('demo api exposes the same contract the pages consume', async () => {
  const api = createDemoApi({ backend: createDemoBackend({ storage: createMemoryStorage() }) });

  assert.deepEqual(await api.verifyPin('1234'), { ok: true });
  await assert.rejects(() => api.verifyPin('9999'), /PIN incorrecto/);

  const productos = await api.productos.list('fideos');
  assert.ok(productos.length >= 1);
  assert.ok(productos[0].marca === null || typeof productos[0].marca === 'object');

  const ventas = await api.ventas.list(1);
  assert.ok(Array.isArray(ventas.ventas));
  assert.equal(typeof ventas.total, 'number');

  const actual = await api.ciclos.actual();
  assert.equal(actual.estado, 'abierto');

  await assert.rejects(
    () => api.backup.crearNube(2026, 9, '1234'),
    /no está incluida en la demo/i
  );
});
