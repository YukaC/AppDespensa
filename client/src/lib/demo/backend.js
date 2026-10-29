/**
 * In-browser backend for the static demo.
 *
 * It mirrors the routes, verbs, status codes and JSON shapes of
 * `server/src/routes/**` but keeps everything in the browser (localStorage,
 * prefix `despensa-demo:`). No network, no PostgreSQL.
 *
 * Only the minimum business logic is replicated here. The server remains the
 * source of truth; this file is deliberately small enough to read during an
 * interview.
 *
 * Invariants kept from SPEC.md:
 *  - V1: a "Cuenta" sale in the demo always goes through this local backend
 *    (there is no offline fallback in demo mode).
 *  - V3: every persisted "Cuenta" sale creates exactly one CARGO movement with
 *    the same ventaId.
 *  - V4: a PAGO never deletes the sale nor its CARGO.
 *  - V5: a sale created while a cycle is open gets that cicloId.
 *  - V6: opening a cycle requires the admin PIN.
 */

import { buildSeedState, SEED_VERSION } from './seed.js';
import { matchesSearch, equalsSearch } from '../search.js';
import { DEMO_PIN, DEMO_STORAGE_KEY } from './config.js';

const EPS = 0.005;
const DEMO_UNSUPPORTED =
  'Esta sección (backup y cierre mensual) no está incluida en la demo estática.';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad2 = (n) => String(n).padStart(2, '0');

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.extra = extra;
  }
}

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function resolveStorage() {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Private mode / blocked storage: fall back to an in-memory store.
  }
  return createMemoryStorage();
}

export function createDemoBackend(options = {}) {
  const storage = options.storage ?? resolveStorage();
  const now = options.now ?? (() => new Date());

  let state = loadState();

  function loadState() {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.seedVersion === SEED_VERSION) return parsed;
      } catch {
        // Corrupt payload: reseed below.
      }
    }
    const fresh = buildSeedState(now());
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function persist() {
    try {
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Demo: no se pudo guardar el estado en localStorage.', err);
    }
  }

  function reset() {
    state = buildSeedState(now());
    persist();
  }

  // ---------- ids & lookups ----------

  const nextId = (list) =>
    list.reduce((max, row) => (Number(row.id) > max ? Number(row.id) : max), 0) + 1;

  const normalizarNombre = (nombre) => String(nombre || '').trim();

  const findProducto = (id) => state.productos.find((p) => p.id === Number(id)) ?? null;
  const findCliente = (id) => state.clientes.find((c) => c.id === Number(id)) ?? null;

  function findClientePorNombre(nombre) {
    const n = normalizarNombre(nombre);
    if (!n) return null;
    return state.clientes.find((c) => equalsSearch(c.nombre, n)) ?? null;
  }

  function findCuentaLibreNombre(nombre) {
    const n = normalizarNombre(nombre);
    if (!n) return null;
    const row = state.movimientos.find(
      (m) => m.clienteId == null && m.clienteNombre && equalsSearch(m.clienteNombre, n)
    );
    return row?.clienteNombre ?? null;
  }

  const proveedorNombre = (p) =>
    state.proveedores.find((x) => x.id === p.proveedorId)?.nombre ?? 'Sin proveedor';

  const marcaNombre = (p) =>
    state.marcas.find((x) => x.id === p.marcaId)?.nombre ?? null;

  // ---------- serializers (same shapes as the Express routes) ----------

  function serializeCliente(c) {
    return { ...c };
  }

  function serializeProducto(p) {
    return {
      ...p,
      precio: Number(p.precio),
      marca: p.marcaId ? state.marcas.find((m) => m.id === p.marcaId) ?? null : null,
      proveedor: p.proveedorId
        ? state.proveedores.find((x) => x.id === p.proveedorId) ?? null
        : null,
      fechaVencimiento: p.fechaVencimiento ?? null,
    };
  }

  function serializeVenta(venta) {
    return {
      ...venta,
      total: Number(venta.total),
      cliente: venta.clienteId ? serializeCliente(findCliente(venta.clienteId)) : null,
      detalles: (venta.detalles || []).map((d) => ({
        ...d,
        precioUnit: Number(d.precioUnit),
        producto: findProducto(d.productoId)
          ? serializeProducto(findProducto(d.productoId))
          : null,
      })),
    };
  }

  function serializeMovimiento(mov) {
    const base = { ...mov, monto: Number(mov.monto) };
    if (mov.ventaId) {
      const venta = state.ventas.find((v) => v.id === mov.ventaId);
      if (venta) base.venta = serializeVenta(venta);
    }
    return base;
  }

  function serializeCiclo(ciclo) {
    return {
      ...ciclo,
      totalDia: ciclo.totalDia != null ? Number(ciclo.totalDia) : null,
    };
  }

  function serializeVentaReporte(v) {
    return {
      id: v.id,
      total: Number(v.total),
      metodoPago: v.metodoPago,
      fecha: v.fecha,
      cicloId: v.cicloId,
      detalles: v.detalles.map((d) => ({
        cantidad: d.cantidad,
        precioUnit: Number(d.precioUnit),
        producto: findProducto(d.productoId)?.nombre ?? null,
      })),
    };
  }

  // ---------- accounts ----------

  function cuentaRef({ clienteId, clienteNombre }) {
    if (clienteId) return { clienteId: Number(clienteId), clienteNombre: null };
    const canon =
      findCuentaLibreNombre(clienteNombre) ?? normalizarNombre(clienteNombre);
    return { clienteId: null, clienteNombre: canon };
  }

  function movimientosDe(ref) {
    if (ref.clienteId) {
      return state.movimientos.filter((m) => m.clienteId === ref.clienteId);
    }
    return state.movimientos.filter(
      (m) => m.clienteId == null && m.clienteNombre === ref.clienteNombre
    );
  }

  function getSaldo(ref) {
    const movs = movimientosDe(ref);
    const saldo = movs.reduce(
      (sum, m) => sum + (m.tipo === 'CARGO' ? Number(m.monto) : -Number(m.monto)),
      0
    );
    return round2(saldo);
  }

  function verificarDuplicadoCuenta(nombre) {
    const n = normalizarNombre(nombre);
    if (!n) return { duplicado: false };

    const cliente = findClientePorNombre(n);
    if (cliente) {
      return {
        duplicado: true,
        tipo: cliente.activo ? 'registrado' : 'registrado_inactivo',
        clienteId: cliente.id,
        nombre: cliente.nombre,
        mensaje: cliente.activo
          ? `Ya existe el cliente registrado "${cliente.nombre}"`
          : `Ya existió el cliente "${cliente.nombre}" (inactivo)`,
      };
    }

    const libre = findCuentaLibreNombre(n);
    if (libre) {
      return {
        duplicado: true,
        tipo: 'libre',
        nombre: libre,
        mensaje: `Ya existe una cuenta sin registro con el nombre "${libre}"`,
      };
    }

    return { duplicado: false };
  }

  function assertClienteNoDuplicado(nombre, status = 400) {
    const check = verificarDuplicadoCuenta(nombre);
    if (check.duplicado) throw new HttpError(status, check.mensaje);
  }

  function resolverCuentaLibre(nombre) {
    const registrado = findClientePorNombre(nombre);
    if (registrado?.activo) {
      throw new HttpError(
        400,
        `"${registrado.nombre}" ya está registrado. Seleccioná "Registrado" en Caja.`
      );
    }
    if (registrado && !registrado.activo) {
      throw new HttpError(400, `"${registrado.nombre}" ya existió como cliente inactivo`);
    }
    return findCuentaLibreNombre(nombre) ?? normalizarNombre(nombre);
  }

  function crearPago(ref, monto, notas) {
    const pago = {
      id: nextId(state.movimientos),
      clienteId: ref.clienteId,
      clienteNombre: ref.clienteNombre,
      tipo: 'PAGO',
      monto: round2(monto),
      ventaId: null,
      notas: notas?.trim() || null,
      fecha: now().toISOString(),
      visibleEnCuentas: true,
      archivadoAt: null,
    };
    state.movimientos.push(pago);
    return pago;
  }

  function procesarPago({ clienteId, clienteNombre, monto, notas }) {
    const ref = cuentaRef({ clienteId, clienteNombre });
    const saldo = getSaldo(ref);
    if (saldo <= 0) throw new HttpError(400, 'No hay deuda pendiente en esta cuenta');
    if (monto > saldo + EPS) {
      throw new HttpError(
        400,
        `El monto supera la deuda (${saldo.toFixed(2)}). No se permite saldo a favor`
      );
    }

    const cargos = movimientosDe(ref)
      .filter((m) => m.tipo === 'CARGO' && m.ventaId != null)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);

    const matchOne = cargos.find((c) => Math.abs(Number(c.monto) - monto) < EPS);
    if (matchOne) {
      const pago = crearPago(
        ref,
        monto,
        notas?.trim() || `Cobro ticket #${matchOne.ventaId}`
      );
      return {
        tipo: 'liquidacion_ticket',
        mensaje: `Ticket #${matchOne.ventaId} cobrado`,
        liquidados: 1,
        ventaId: matchOne.ventaId,
        pago: serializeMovimiento(pago),
      };
    }

    if (Math.abs(monto - saldo) < EPS) {
      const pago = crearPago(ref, monto, notas?.trim() || 'Cuenta saldada');
      return {
        tipo: 'cuenta_cerrada',
        mensaje: 'Cuenta saldada. Los tickets siguen en el historial de ventas.',
        liquidados: cargos.length,
        ventaIds: cargos.map((c) => c.ventaId),
        pago: serializeMovimiento(pago),
      };
    }

    const pago = crearPago(ref, monto, notas);
    return {
      tipo: 'pago_parcial',
      mensaje: 'Cobro parcial registrado',
      pago: serializeMovimiento(pago),
    };
  }

  function anularTicket(movId) {
    const mov = state.movimientos.find((m) => m.id === Number(movId));
    if (!mov) throw new HttpError(404, 'Movimiento no encontrado');
    if (mov.tipo !== 'CARGO' || !mov.ventaId) {
      throw new HttpError(400, 'Solo se pueden anular tickets (cargos con venta)');
    }

    const venta = state.ventas.find((v) => v.id === mov.ventaId);
    if (!venta) throw new HttpError(404, 'Ticket no encontrado');

    for (const d of venta.detalles) {
      const producto = findProducto(d.productoId);
      if (producto) producto.stock += d.cantidad;
    }
    state.ventas = state.ventas.filter((v) => v.id !== venta.id);
    state.movimientos = state.movimientos.filter((m) => m.id !== mov.id);
    return `Ticket #${venta.id} anulado. Stock restaurado.`;
  }

  // ---------- cycles ----------

  function getCicloAbierto() {
    return (
      state.ciclos
        .filter((c) => c.estado === 'abierto')
        .sort((a, b) => new Date(b.fechaApertura) - new Date(a.fechaApertura))[0] ?? null
    );
  }

  function assertCicloAbierto() {
    const ciclo = getCicloAbierto();
    if (!ciclo) {
      throw new HttpError(
        400,
        'No hay ciclo abierto. Abrí el ciclo del día antes de registrar ventas.'
      );
    }
    return ciclo;
  }

  function calcularResumenCiclo(cicloId) {
    const ventas = state.ventas
      .filter((v) => v.cicloId === cicloId)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const porPago = {};
    let totalDia = 0;
    for (const v of ventas) {
      const monto = Number(v.total);
      totalDia += monto;
      const metodo = v.metodoPago || 'Otro';
      porPago[metodo] = round2((porPago[metodo] || 0) + monto);
    }

    return {
      cantidadTickets: ventas.length,
      totalDia: round2(totalDia),
      porPago,
      ventas: ventas.map((v) => ({
        id: v.id,
        total: Number(v.total),
        metodoPago: v.metodoPago,
        fecha: v.fecha,
      })),
    };
  }

  function ventasDeCiclo(cicloId) {
    return state.ventas
      .filter((v) => v.cicloId === cicloId)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  // ---------- sales ----------

  function registrarVenta(payload) {
    const {
      items,
      metodoPago = 'Efectivo',
      clienteId,
      clienteNombre,
      registrarCliente,
      clienteTelefono,
      fecha,
    } = payload || {};

    if (!items?.length) {
      throw new HttpError(400, 'La venta debe tener al menos un item');
    }

    if (metodoPago === 'Cuenta' && !clienteId && !String(clienteNombre || '').trim()) {
      throw new HttpError(
        400,
        'Indicá un cliente registrado o un nombre para anotar en cuenta'
      );
    }

    const ciclo = assertCicloAbierto();
    let total = 0;
    const detallesData = [];

    for (const item of items) {
      const producto = findProducto(item.productoId);
      if (!producto || !producto.activo) {
        throw new HttpError(400, `Producto ${item.productoId} no disponible`);
      }
      if (producto.stock < item.cantidad) {
        throw new HttpError(400, `Stock insuficiente para ${producto.nombre}`);
      }
      const precioUnit = Number(producto.precio);
      total += precioUnit * item.cantidad;
      detallesData.push({
        productoId: producto.id,
        cantidad: Number(item.cantidad),
        precioUnit,
      });
    }
    total = round2(total);

    let ventaClienteId = clienteId ? Number(clienteId) : null;
    let ventaClienteNombre = null;

    if (metodoPago === 'Cuenta') {
      if (ventaClienteId) {
        const existe = findCliente(ventaClienteId);
        if (!existe?.activo) throw new HttpError(400, 'Cliente no encontrado');
      } else {
        const nombre = normalizarNombre(clienteNombre);
        if (registrarCliente) {
          assertClienteNoDuplicado(nombre);
          const nuevo = {
            id: nextId(state.clientes),
            nombre,
            telefono: clienteTelefono?.trim() || null,
            activo: true,
            createdAt: now().toISOString(),
          };
          state.clientes.push(nuevo);
          ventaClienteId = nuevo.id;
        } else {
          ventaClienteNombre = resolverCuentaLibre(nombre);
        }
      }
    }

    const ventaId = nextId(state.ventas);
    const fechaVenta = fecha ? new Date(fecha).toISOString() : now().toISOString();
    const venta = {
      id: ventaId,
      total,
      metodoPago,
      fecha: fechaVenta,
      clienteId: ventaClienteId,
      clienteNombre: ventaClienteNombre,
      cicloId: ciclo.id,
      notas: null,
      detalles: detallesData.map((d, i) => ({
        id: i + 1,
        ventaId,
        ...d,
      })),
    };
    state.ventas.push(venta);

    if (metodoPago === 'Cuenta') {
      // V3: one CARGO per account sale, pointing at the same ventaId.
      state.movimientos.push({
        id: nextId(state.movimientos),
        clienteId: ventaClienteId,
        clienteNombre: ventaClienteNombre,
        tipo: 'CARGO',
        monto: total,
        ventaId,
        notas: `Ticket #${ventaId}`,
        fecha: fechaVenta,
        visibleEnCuentas: true,
        archivadoAt: null,
      });
    }

    for (const item of items) {
      const producto = findProducto(item.productoId);
      producto.stock -= Number(item.cantidad);
      producto.updatedAt = now().toISOString();
    }

    return venta;
  }

  // ---------- reports ----------

  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const startOfWeek = (d) => {
    const x = startOfDay(d);
    const day = x.getDay() || 7; // Monday = 1
    x.setDate(x.getDate() - day + 1);
    return x;
  };

  const startOfMonth = (d) => {
    const x = startOfDay(d);
    x.setDate(1);
    return x;
  };

  const inRange = (iso, start, end) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const localDayKey = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  function buildContables(inicio, fin) {
    const ciclos = state.ciclos
      .filter((c) => c.estado === 'cerrado' && inRange(c.fechaApertura, inicio, fin))
      .sort((a, b) => new Date(a.fechaApertura) - new Date(b.fechaApertura));

    const ids = new Set(ciclos.map((c) => c.id));
    const ventas = state.ventas
      .filter((v) => ids.has(v.cicloId))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const porPago = {};
    let total = 0;
    for (const v of ventas) {
      const monto = Number(v.total);
      total += monto;
      const metodo = v.metodoPago || 'Otro';
      porPago[metodo] = round2((porPago[metodo] || 0) + monto);
    }

    const porDia = ciclos.map((c) => ({
      fecha: c.fechaApertura,
      total: Number(c.totalDia ?? 0),
      tickets: c.cantidadTickets,
      horaApertura: c.fechaApertura,
      horaCierre: c.fechaCierre,
    }));

    return {
      total: round2(total),
      jornadas: ciclos.length,
      cantidadTickets: ventas.length,
      porPago,
      porDia,
      ventas: ventas.map(serializeVentaReporte),
      periodoInicio: inicio.toISOString(),
      periodoFin: fin.toISOString(),
    };
  }

  function isoWeekRange(anio, semana) {
    const jan4 = new Date(anio, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const lunesSemana1 = new Date(jan4);
    lunesSemana1.setDate(jan4.getDate() - dayOfWeek + 1);
    const inicio = new Date(lunesSemana1);
    inicio.setDate(lunesSemana1.getDate() + (semana - 1) * 7);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return { inicio, fin };
  }

  // ---------- router ----------

  function route(method, rawPath, body, headers) {
    const [pathname, rawQuery = ''] = rawPath.split('?');
    const query = new URLSearchParams(rawQuery);
    const q = (name) => query.get(name);
    const pin = headers['x-admin-pin'] ?? body?.pin;

    const requirePin = () => {
      if (String(pin) !== DEMO_PIN) {
        throw new HttpError(401, 'PIN requerido o incorrecto');
      }
    };

    // --- health & auth ---
    if (method === 'GET' && pathname === '/api/health') {
      return { status: 200, body: { ok: true, service: 'autoservicio-fall', demo: true } };
    }
    if (method === 'POST' && pathname === '/api/auth/pin') {
      if (String(body?.pin) === DEMO_PIN) return { status: 200, body: { ok: true } };
      return { status: 401, body: { ok: false, error: 'PIN incorrecto' } };
    }

    // --- productos ---
    if (method === 'GET' && pathname === '/api/productos') {
      const termino = String(q('q') || '').trim();
      const codigo = termino.replace(/\s+/g, '');
      const onlyActive = q('activo') !== 'false';
      let productos = state.productos.filter((p) =>
        onlyActive ? p.activo : !p.activo
      );
      if (termino) {
        productos = productos.filter(
          (p) =>
            matchesSearch(p.nombre, termino) ||
            (p.codigoBarras && p.codigoBarras.includes(codigo))
        );
      }
      productos.sort((a, b) => {
        const fa = a.stock <= a.stockMinimo;
        const fb = b.stock <= b.stockMinimo;
        if (fa !== fb) return fa ? -1 : 1;
        const prov = proveedorNombre(a).localeCompare(proveedorNombre(b), 'es');
        if (prov !== 0) return prov;
        if (a.stock !== b.stock) return a.stock - b.stock;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
      return { status: 200, body: productos.map(serializeProducto) };
    }

    if (method === 'GET' && pathname === '/api/productos/faltantes') {
      const faltantes = state.productos
        .filter((p) => p.activo && p.stock <= p.stockMinimo)
        .sort(
          (a, b) =>
            proveedorNombre(a).localeCompare(proveedorNombre(b), 'es') ||
            a.stock - b.stock ||
            a.nombre.localeCompare(b.nombre, 'es')
        )
        .map((p) => ({
          ...p,
          marcaNombre: marcaNombre(p),
          proveedorNombre: proveedorNombre(p),
          precio: Number(p.precio),
          fechaVencimiento: p.fechaVencimiento ?? null,
        }));
      return { status: 200, body: faltantes };
    }

    if (method === 'GET' && pathname === '/api/productos/faltantes/count') {
      const count = state.productos.filter(
        (p) => p.activo && p.stock <= p.stockMinimo
      ).length;
      return { status: 200, body: { count } };
    }

    if (method === 'GET' && pathname.startsWith('/api/productos/barcode/')) {
      const codigo = decodeURIComponent(pathname.slice('/api/productos/barcode/'.length));
      const producto = state.productos.find(
        (p) => p.activo && p.codigoBarras === codigo
      );
      if (!producto) throw new HttpError(404, 'Producto no encontrado');
      return { status: 200, body: serializeProducto(producto) };
    }

    if (method === 'POST' && pathname === '/api/productos') {
      const { codigoBarras, nombre, precio, stock, stockMinimo, marcaId, proveedorId } =
        body || {};
      if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
      if (
        codigoBarras &&
        state.productos.some((p) => p.codigoBarras === codigoBarras)
      ) {
        throw new HttpError(409, 'Ya existe un producto con ese código de barras');
      }
      const producto = {
        id: nextId(state.productos),
        codigoBarras: codigoBarras || null,
        nombre,
        precio: Number(precio) || 0,
        stock: Number(stock) || 0,
        stockMinimo: stockMinimo == null ? 5 : Number(stockMinimo),
        fechaVencimiento: null,
        activo: true,
        marcaId: marcaId ? Number(marcaId) : null,
        proveedorId: proveedorId ? Number(proveedorId) : null,
        updatedAt: now().toISOString(),
      };
      state.productos.push(producto);
      persist();
      return { status: 201, body: serializeProducto(producto) };
    }

    const productoMatch = pathname.match(/^\/api\/productos\/(\d+)$/);
    if (productoMatch) {
      const producto = findProducto(productoMatch[1]);
      if (!producto) throw new HttpError(404, 'No encontrado');
      if (method === 'GET') return { status: 200, body: serializeProducto(producto) };

      if (method === 'PUT') {
        const data = body || {};
        if (data.codigoBarras !== undefined) producto.codigoBarras = data.codigoBarras || null;
        if (data.nombre !== undefined) producto.nombre = data.nombre;
        if (data.precio !== undefined) producto.precio = Number(data.precio);
        if (data.stock !== undefined) producto.stock = Number(data.stock);
        if (data.stockMinimo !== undefined) producto.stockMinimo = Number(data.stockMinimo);
        if (data.fechaVencimiento !== undefined) {
          producto.fechaVencimiento = data.fechaVencimiento || null;
        }
        if (data.activo !== undefined) producto.activo = Boolean(data.activo);
        if (data.marcaId !== undefined) {
          producto.marcaId = data.marcaId ? Number(data.marcaId) : null;
        }
        if (data.proveedorId !== undefined) {
          producto.proveedorId = data.proveedorId ? Number(data.proveedorId) : null;
        }
        producto.updatedAt = now().toISOString();
        persist();
        return { status: 200, body: serializeProducto(producto) };
      }

      if (method === 'DELETE') {
        producto.activo = false;
        producto.updatedAt = now().toISOString();
        persist();
        return { status: 200, body: serializeProducto(producto) };
      }
    }

    // --- proveedores / marcas ---
    if (pathname === '/api/proveedores') {
      if (method === 'GET') {
        return {
          status: 200,
          body: [...state.proveedores].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es')
          ),
        };
      }
      if (method === 'POST') {
        const nombre = String(body?.nombre || '').trim();
        if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
        if (state.proveedores.some((p) => equalsSearch(p.nombre, nombre))) {
          throw new HttpError(409, 'Ya existe ese proveedor');
        }
        const proveedor = { id: nextId(state.proveedores), nombre };
        state.proveedores.push(proveedor);
        persist();
        return { status: 201, body: proveedor };
      }
    }

    if (pathname === '/api/marcas') {
      if (method === 'GET') {
        return {
          status: 200,
          body: [...state.marcas].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es')
          ),
        };
      }
      if (method === 'POST') {
        const nombre = String(body?.nombre || '').trim();
        if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
        if (state.marcas.some((m) => equalsSearch(m.nombre, nombre))) {
          throw new HttpError(409, 'Ya existe esa marca');
        }
        const marca = { id: nextId(state.marcas), nombre };
        state.marcas.push(marca);
        persist();
        return { status: 201, body: marca };
      }
    }

    // --- ventas ---
    if (method === 'GET' && pathname === '/api/ventas') {
      const page = Math.max(1, Number(q('page')) || 1);
      const limit = Math.min(Math.max(Number(q('limit')) || 50, 1), 200);
      const ordenadas = [...state.ventas].sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id
      );
      const start = (page - 1) * limit;
      return {
        status: 200,
        body: {
          page,
          limit,
          total: ordenadas.length,
          ventas: ordenadas.slice(start, start + limit).map(serializeVenta),
        },
      };
    }

    if (method === 'POST' && pathname === '/api/ventas') {
      const venta = registrarVenta(body);
      persist();
      return { status: 201, body: serializeVenta(venta) };
    }

    // --- ciclos ---
    if (method === 'GET' && pathname === '/api/ciclos/actual') {
      const ciclo = getCicloAbierto();
      if (!ciclo) return { status: 200, body: null };
      return {
        status: 200,
        body: {
          ...serializeCiclo(ciclo),
          resumen: calcularResumenCiclo(ciclo.id),
          ventas: ventasDeCiclo(ciclo.id).map(serializeVenta),
        },
      };
    }

    if (method === 'POST' && pathname === '/api/ciclos/abrir') {
      requirePin();
      const abierto = getCicloAbierto();
      if (abierto) {
        throw new HttpError(
          400,
          'Ya hay un ciclo abierto. Cerralo antes de abrir uno nuevo.',
          { cicloId: abierto.id }
        );
      }
      const ciclo = {
        id: nextId(state.ciclos),
        fechaApertura: now().toISOString(),
        fechaCierre: null,
        totalDia: null,
        cantidadTickets: 0,
        estado: 'abierto',
      };
      state.ciclos.push(ciclo);
      persist();
      return { status: 201, body: serializeCiclo(ciclo) };
    }

    const cerrarMatch = pathname.match(/^\/api\/ciclos\/(\d+)\/cerrar$/);
    if (method === 'POST' && cerrarMatch) {
      const ciclo = state.ciclos.find((c) => c.id === Number(cerrarMatch[1]));
      if (!ciclo) throw new HttpError(400, 'Ciclo no encontrado');
      if (ciclo.estado === 'cerrado') throw new HttpError(400, 'El ciclo ya está cerrado');

      const resumen = calcularResumenCiclo(ciclo.id);
      ciclo.estado = 'cerrado';
      ciclo.fechaCierre = now().toISOString();
      ciclo.totalDia = resumen.totalDia;
      ciclo.cantidadTickets = resumen.cantidadTickets;
      persist();
      return {
        status: 200,
        body: {
          ...serializeCiclo(ciclo),
          resumen,
          ventas: ventasDeCiclo(ciclo.id).map(serializeVenta),
        },
      };
    }

    if (method === 'GET' && pathname === '/api/ciclos') {
      const estado = q('estado');
      const desde = q('desde') ? new Date(q('desde')) : null;
      const hasta = q('hasta') ? new Date(q('hasta')) : null;
      if (hasta) hasta.setHours(23, 59, 59, 999);

      const limit = Math.min(Number(q('limit')) || 100, 500);
      const ciclos = state.ciclos
        .filter((c) => (estado ? c.estado === estado : true))
        .filter((c) => (desde ? new Date(c.fechaApertura) >= desde : true))
        .filter((c) => (hasta ? new Date(c.fechaApertura) <= hasta : true))
        .sort((a, b) => new Date(b.fechaApertura) - new Date(a.fechaApertura))
        .slice(0, limit)
        .map(serializeCiclo);
      return { status: 200, body: ciclos };
    }

    const cicloMatch = pathname.match(/^\/api\/ciclos\/(\d+)$/);
    if (method === 'GET' && cicloMatch) {
      const ciclo = state.ciclos.find((c) => c.id === Number(cicloMatch[1]));
      if (!ciclo) throw new HttpError(404, 'Ciclo no encontrado');
      return {
        status: 200,
        body: {
          ...serializeCiclo(ciclo),
          resumen: calcularResumenCiclo(ciclo.id),
          ventas: ventasDeCiclo(ciclo.id).map(serializeVenta),
        },
      };
    }

    // --- reportes ---
    if (method === 'GET' && pathname === '/api/reportes/rendimiento') {
      const current = now();
      const hoy = startOfDay(current).getTime();
      const semana = startOfWeek(current).getTime();
      const mes = startOfMonth(current).getTime();
      let totalHoy = 0;
      let totalSemana = 0;
      let totalMes = 0;
      for (const v of state.ventas) {
        const t = new Date(v.fecha).getTime();
        const monto = Number(v.total);
        if (t >= hoy) totalHoy += monto;
        if (t >= semana) totalSemana += monto;
        if (t >= mes) totalMes += monto;
      }
      return {
        status: 200,
        body: {
          hoy: round2(totalHoy),
          semana_actual: round2(totalSemana),
          mes_actual: round2(totalMes),
        },
      };
    }

    if (method === 'GET' && pathname === '/api/reportes/top-productos') {
      const desde = now().getTime() - 30 * 86400000;
      const acc = new Map();
      for (const v of state.ventas) {
        if (new Date(v.fecha).getTime() < desde) continue;
        for (const d of v.detalles) {
          const producto = findProducto(d.productoId);
          if (!producto) continue;
          const row = acc.get(producto.id) ?? {
            id: producto.id,
            nombre: producto.nombre,
            cantidad_vendida: 0,
            ingresos: 0,
          };
          row.cantidad_vendida += d.cantidad;
          row.ingresos = round2(row.ingresos + d.precioUnit * d.cantidad);
          acc.set(producto.id, row);
        }
      }
      const top = [...acc.values()]
        .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
        .slice(0, 10);
      return { status: 200, body: top };
    }

    if (method === 'GET' && pathname === '/api/reportes/ventas-diarias') {
      const dias = Math.min(Math.max(Number(q('dias')) || 30, 7), 90);
      const desde = now().getTime() - dias * 86400000;
      const acc = new Map();
      for (const v of state.ventas) {
        const t = new Date(v.fecha).getTime();
        if (t < desde) continue;
        const key = localDayKey(v.fecha);
        const row = acc.get(key) ?? { dia: key, ingresos: 0, ventas: 0 };
        row.ingresos = round2(row.ingresos + Number(v.total));
        row.ventas += 1;
        acc.set(key, row);
      }
      const body = [...acc.values()]
        .sort((a, b) => a.dia.localeCompare(b.dia))
        .map((r) => {
          const [y, m, d] = r.dia.split('-').map(Number);
          return {
            dia: new Date(y, m - 1, d, 12).toISOString(),
            ingresos: r.ingresos,
            ventas: r.ventas,
          };
        });
      return { status: 200, body };
    }

    if (method === 'GET' && pathname === '/api/reportes/ventas-mensuales') {
      const meses = Math.min(Math.max(Number(q('meses')) || 6, 3), 24);
      const current = now();
      const desde = new Date(
        current.getFullYear(),
        current.getMonth() - (meses - 1),
        1
      ).getTime();
      const acc = new Map();
      for (const v of state.ventas) {
        const t = new Date(v.fecha).getTime();
        if (t < desde) continue;
        const dt = new Date(v.fecha);
        const key = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
        const row = acc.get(key) ?? { mes: key, ingresos: 0, ventas: 0 };
        row.ingresos = round2(row.ingresos + Number(v.total));
        row.ventas += 1;
        acc.set(key, row);
      }
      const body = [...acc.values()]
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map((r) => {
          const [y, m] = r.mes.split('-').map(Number);
          return { mes: new Date(y, m - 1, 1, 12).toISOString(), ingresos: r.ingresos, ventas: r.ventas };
        });
      return { status: 200, body };
    }

    if (method === 'GET' && pathname === '/api/reportes/ventas-por-pago') {
      const dias = Math.min(Math.max(Number(q('dias')) || 30, 7), 365);
      const desde = now().getTime() - dias * 86400000;
      const acc = new Map();
      for (const v of state.ventas) {
        if (new Date(v.fecha).getTime() < desde) continue;
        const metodo = v.metodoPago || 'Otro';
        const row = acc.get(metodo) ?? { metodo, ingresos: 0, ventas: 0 };
        row.ingresos = round2(row.ingresos + Number(v.total));
        row.ventas += 1;
        acc.set(metodo, row);
      }
      const body = [...acc.values()].sort((a, b) => b.ingresos - a.ingresos);
      return { status: 200, body };
    }

    if (method === 'GET' && pathname === '/api/reportes/proximos-vencimientos') {
      const limite = now().getTime() + 30 * 86400000;
      const rows = state.productos
        .filter(
          (p) =>
            p.activo &&
            p.fechaVencimiento &&
            new Date(p.fechaVencimiento).getTime() <= limite
        )
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
        .slice(0, 30)
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          stock: p.stock,
          fechaVencimiento: p.fechaVencimiento,
          proveedorNombre: proveedorNombre(p),
        }));
      return { status: 200, body: rows };
    }

    if (method === 'GET' && pathname === '/api/reportes/contables/mensual') {
      const anio = Number(q('anio')) || now().getFullYear();
      const mes = Number(q('mes')) || now().getMonth() + 1;
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 0, 23, 59, 59, 999);
      const data = buildContables(inicio, fin);
      return {
        status: 200,
        body: {
          anio,
          mes,
          totalMes: data.total,
          jornadas: data.jornadas,
          cantidadTickets: data.cantidadTickets,
          porPago: data.porPago,
          porDia: data.porDia,
          ventas: data.ventas,
        },
      };
    }

    if (method === 'GET' && pathname === '/api/reportes/contables/semanal') {
      let anio = Number(q('anio'));
      let semana = Number(q('semana'));
      const semanaIso = q('semanaIso');
      if (semanaIso) {
        const [y, w] = String(semanaIso).split('-W');
        anio = Number(y);
        semana = Number(w);
      }
      if (!anio || !semana) {
        const current = now();
        anio = current.getFullYear();
        const jan4 = new Date(anio, 0, 4);
        const dayOfWeek = current.getDay() || 7;
        const thursday = new Date(current);
        thursday.setDate(current.getDate() + 4 - dayOfWeek);
        semana = Math.ceil(((thursday - jan4) / 86400000 + jan4.getDay() + 1) / 7);
      }
      const { inicio, fin } = isoWeekRange(anio, semana);
      const data = buildContables(inicio, fin);
      return {
        status: 200,
        body: {
          anio,
          semana,
          totalSemana: data.total,
          jornadas: data.jornadas,
          cantidadTickets: data.cantidadTickets,
          porPago: data.porPago,
          porDia: data.porDia,
          ventas: data.ventas,
          periodoInicio: inicio.toISOString(),
          periodoFin: fin.toISOString(),
        },
      };
    }

    if (method === 'GET' && pathname === '/api/reportes/contables/anual') {
      const anio = Number(q('anio')) || now().getFullYear();
      const inicio = new Date(anio, 0, 1);
      const fin = new Date(anio, 11, 31, 23, 59, 59, 999);
      const ciclos = state.ciclos.filter(
        (c) => c.estado === 'cerrado' && inRange(c.fechaApertura, inicio, fin)
      );
      const ids = new Set(ciclos.map((c) => c.id));
      const ventas = state.ventas.filter((v) => ids.has(v.cicloId));

      const porMes = Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        total: 0,
        ventas: 0,
        jornadas: 0,
      }));
      for (const c of ciclos) {
        const idx = new Date(c.fechaApertura).getMonth();
        porMes[idx].total = round2(porMes[idx].total + Number(c.totalDia ?? 0));
        porMes[idx].jornadas += 1;
      }
      for (const v of ventas) {
        const idx = new Date(v.fecha).getMonth();
        porMes[idx].ventas += 1;
      }

      const totalAnual = round2(porMes.reduce((s, m) => s + m.total, 0));
      const conDatos = porMes.filter((m) => m.total > 0);
      const mesMayor = conDatos.length
        ? conDatos.reduce((a, b) => (b.total > a.total ? b : a))
        : null;
      const mesMenor = conDatos.length
        ? conDatos.reduce((a, b) => (b.total < a.total ? b : a))
        : null;

      return {
        status: 200,
        body: {
          anio,
          totalAnual,
          cantidadTickets: ventas.length,
          jornadas: ciclos.length,
          porMes,
          mesMayor,
          mesMenor,
        },
      };
    }

    if (method === 'GET' && pathname === '/api/reportes/contables/rango') {
      const desde = q('desde') ? new Date(q('desde')) : null;
      const hasta = q('hasta') ? new Date(q('hasta')) : null;
      if (!desde || !hasta || Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
        throw new HttpError(400, 'Parámetros desde y hasta obligatorios');
      }
      const fin = new Date(hasta);
      fin.setHours(23, 59, 59, 999);
      const metodoPago = q('metodoPago') || null;
      const buscar = String(q('q') || '').trim();

      let ventas = state.ventas
        .filter((v) => v.cicloId != null && inRange(v.fecha, desde, fin))
        .filter((v) => (metodoPago ? v.metodoPago === metodoPago : true))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (buscar) {
        const needle = buscar.toLowerCase();
        const monto = Number(buscar.replace(',', '.'));
        ventas = ventas.filter((v) => {
          if (!Number.isNaN(monto) && Math.abs(Number(v.total) - monto) < 0.01) return true;
          return v.detalles.some((d) =>
            (findProducto(d.productoId)?.nombre ?? '').toLowerCase().includes(needle)
          );
        });
      }

      const porPago = {};
      let total = 0;
      for (const v of ventas) {
        const monto = Number(v.total);
        total += monto;
        const metodo = v.metodoPago || 'Otro';
        porPago[metodo] = round2((porPago[metodo] || 0) + monto);
      }

      return {
        status: 200,
        body: {
          desde: desde.toISOString(),
          hasta: fin.toISOString(),
          total: round2(total),
          cantidadTickets: ventas.length,
          porPago,
          ventas: ventas.map(serializeVentaReporte),
        },
      };
    }

    // --- stock ---
    if (method === 'POST' && pathname === '/api/stock/ingreso') {
      requirePin();
      const { productoId, cantidad, fechaVencimiento } = body || {};
      const qty = Number(cantidad);
      if (!productoId || !qty || qty <= 0) {
        throw new HttpError(400, 'productoId y cantidad positiva son obligatorios');
      }
      let venc = null;
      if (fechaVencimiento) {
        venc = new Date(fechaVencimiento);
        if (Number.isNaN(venc.getTime())) {
          throw new HttpError(400, 'fechaVencimiento inválida');
        }
        venc = venc.toISOString();
      }
      const producto = findProducto(productoId);
      if (!producto || !producto.activo) {
        throw new HttpError(404, 'Producto no encontrado');
      }

      const ingreso = {
        id: nextId(state.ingresos),
        productoId: producto.id,
        cantidadIngresada: qty,
        fechaVencimiento: venc,
        fechaIngreso: now().toISOString(),
      };
      state.ingresos.push(ingreso);
      producto.stock += qty;
      if (venc) producto.fechaVencimiento = venc;
      producto.updatedAt = now().toISOString();
      persist();
      return {
        status: 201,
        body: { ingreso, producto: serializeProducto(producto) },
      };
    }

    // --- aumentos ---
    if (method === 'POST' && pathname === '/api/aumentos') {
      const { tipo, id, porcentaje } = body || {};
      if (!['item', 'proveedor', 'marca'].includes(tipo)) {
        throw new HttpError(400, 'tipo debe ser item, proveedor o marca');
      }
      const pct = Number(porcentaje);
      if (!pct || pct <= 0) throw new HttpError(400, 'porcentaje inválido');

      const productos = state.productos.filter((p) => {
        if (!p.activo) return false;
        if (tipo === 'item') return p.id === Number(id);
        if (tipo === 'proveedor') return p.proveedorId === Number(id);
        return p.marcaId === Number(id);
      });
      if (!productos.length) throw new HttpError(404, 'No hay productos para actualizar');

      const fecha = now().toISOString();
      state.historialAumentos.push({
        id: nextId(state.historialAumentos),
        tipo,
        referenciaId: Number(id),
        porcentaje: pct,
        fecha,
      });

      const factor = 1 + pct / 100;
      const actualizados = productos.map((p) => {
        const precioViejo = Number(p.precio);
        const precioNuevo = round2(precioViejo * factor);
        p.precio = precioNuevo;
        p.updatedAt = fecha;
        state.historialPrecios.push({
          id: nextId(state.historialPrecios),
          productoId: p.id,
          precioViejo,
          precioNuevo,
          fecha,
        });
        return serializeProducto(p);
      });
      persist();
      return { status: 200, body: { actualizados: actualizados.length, productos: actualizados } };
    }

    if (method === 'GET' && pathname === '/api/aumentos/historial') {
      const limit = Math.min(Number(q('limit')) || 50, 200);
      const historial = [...state.historialAumentos]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, limit)
        .map((h) => ({ ...h, porcentaje: Number(h.porcentaje) }));
      return { status: 200, body: historial };
    }

    const historialProductoMatch = pathname.match(/^\/api\/aumentos\/historial\/(\d+)$/);
    if (method === 'GET' && historialProductoMatch) {
      const productoId = Number(historialProductoMatch[1]);
      const historial = state.historialPrecios
        .filter((h) => h.productoId === productoId)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 50)
        .map((h) => ({
          ...h,
          precioViejo: Number(h.precioViejo),
          precioNuevo: Number(h.precioNuevo),
        }));
      return { status: 200, body: historial };
    }

    // --- clientes ---
    if (method === 'GET' && pathname === '/api/clientes') {
      const termino = String(q('q') || '').trim();
      let clientes = state.clientes
        .filter((c) => c.activo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 500);
      if (termino) {
        clientes = clientes.filter((c) => matchesSearch(c.nombre, termino));
      }
      return { status: 200, body: clientes.map(serializeCliente) };
    }

    if (method === 'GET' && pathname === '/api/clientes/resumen') {
      const resultado = [];
      for (const c of state.clientes.filter((x) => x.activo)) {
        const saldo = getSaldo({ clienteId: c.id, clienteNombre: null });
        const visibles = state.movimientos.filter(
          (m) => m.clienteId === c.id && m.visibleEnCuentas !== false
        ).length;
        if (Math.abs(saldo) > EPS || visibles > 0) {
          resultado.push({
            clienteId: c.id,
            clienteNombre: c.nombre,
            telefono: c.telefono,
            registrado: true,
            saldo,
          });
        }
      }

      const libres = new Map();
      for (const m of state.movimientos) {
        if (m.clienteId != null || !m.clienteNombre) continue;
        const row = libres.get(m.clienteNombre) ?? {
          clienteId: null,
          clienteNombre: m.clienteNombre,
          telefono: null,
          registrado: false,
          saldo: 0,
          visibles: 0,
        };
        row.saldo += m.tipo === 'CARGO' ? Number(m.monto) : -Number(m.monto);
        if (m.visibleEnCuentas !== false) row.visibles += 1;
        libres.set(m.clienteNombre, row);
      }
      for (const row of libres.values()) {
        if (Math.abs(row.saldo) > EPS || row.visibles > 0) {
          resultado.push({ ...row, saldo: round2(row.saldo), visibles: undefined });
        }
      }

      resultado.sort(
        (a, b) => b.saldo - a.saldo || a.clienteNombre.localeCompare(b.clienteNombre, 'es')
      );
      return { status: 200, body: resultado.map(({ visibles, ...rest }) => rest) };
    }

    if (method === 'GET' && pathname === '/api/clientes/verificar') {
      const nombre = normalizarNombre(q('nombre'));
      if (!nombre) throw new HttpError(400, 'Nombre obligatorio');
      return { status: 200, body: verificarDuplicadoCuenta(nombre) };
    }

    if (method === 'POST' && pathname === '/api/clientes/pago-libre') {
      const nombre = String(body?.clienteNombre || '').trim();
      const monto = Number(body?.monto);
      if (!nombre) throw new HttpError(400, 'Nombre obligatorio');
      if (!monto || monto <= 0) throw new HttpError(400, 'Monto positivo obligatorio');
      const result = procesarPago({
        clienteNombre: nombre,
        monto,
        notas: body?.notas,
      });
      persist();
      return { status: 201, body: result };
    }

    if (method === 'POST' && pathname === '/api/clientes') {
      const nombre = normalizarNombre(body?.nombre);
      if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
      assertClienteNoDuplicado(nombre, 409);
      const cliente = {
        id: nextId(state.clientes),
        nombre,
        telefono: body?.telefono?.trim() || null,
        activo: true,
        createdAt: now().toISOString(),
      };
      state.clientes.push(cliente);
      persist();
      return { status: 201, body: serializeCliente(cliente) };
    }

    const clienteNombreMatch = pathname.match(/^\/api\/clientes\/nombre\/(.+)$/);
    if (method === 'GET' && clienteNombreMatch) {
      const nombre = decodeURIComponent(clienteNombreMatch[1]).trim();
      const canon = findCuentaLibreNombre(nombre);
      if (!canon) throw new HttpError(404, 'Cuenta no encontrada');
      const ref = { clienteId: null, clienteNombre: canon };
      const movimientos = movimientosDe(ref)
        .filter((m) => m.visibleEnCuentas !== false)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 100)
        .map(serializeMovimiento);
      return {
        status: 200,
        body: {
          clienteNombre: canon,
          registrado: false,
          saldo: getSaldo(ref),
          movimientos,
        },
      };
    }

    const clienteLibreDelete = pathname.match(/^\/api\/clientes\/libre\/(.+)$/);
    if (method === 'DELETE' && clienteLibreDelete) {
      const nombre = decodeURIComponent(clienteLibreDelete[1]).trim();
      const canon = findCuentaLibreNombre(nombre);
      if (!canon) throw new HttpError(404, 'Cuenta no encontrada');
      const ref = { clienteId: null, clienteNombre: canon };
      const saldo = getSaldo(ref);
      if (saldo > EPS) {
        throw new HttpError(400, 'No se puede eliminar una cuenta con deuda pendiente');
      }
      state.movimientos = state.movimientos.filter(
        (m) => !(m.clienteId == null && m.clienteNombre === canon)
      );
      persist();
      return { status: 200, body: { ok: true } };
    }

    const movMatch = pathname.match(/^\/api\/clientes\/movimientos\/(\d+)$/);
    if (method === 'DELETE' && movMatch) {
      const mensaje = anularTicket(movMatch[1]);
      persist();
      return { status: 200, body: { ok: true, mensaje } };
    }

    const pagoMatch = pathname.match(/^\/api\/clientes\/(\d+)\/pagos$/);
    if (method === 'POST' && pagoMatch) {
      const id = Number(pagoMatch[1]);
      const monto = Number(body?.monto);
      if (!monto || monto <= 0) throw new HttpError(400, 'Monto positivo obligatorio');
      const cliente = findCliente(id);
      if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
      const result = procesarPago({ clienteId: id, monto, notas: body?.notas });
      persist();
      return { status: 201, body: result };
    }

    const clienteMatch = pathname.match(/^\/api\/clientes\/(\d+)$/);
    if (clienteMatch) {
      const id = Number(clienteMatch[1]);
      const cliente = findCliente(id);
      if (!cliente) throw new HttpError(404, 'Cliente no encontrado');

      if (method === 'GET') {
        const movimientos = state.movimientos
          .filter((m) => m.clienteId === id && m.visibleEnCuentas !== false)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          .slice(0, 100)
          .map(serializeMovimiento);
        return {
          status: 200,
          body: {
            ...serializeCliente(cliente),
            saldo: getSaldo({ clienteId: id, clienteNombre: null }),
            movimientos,
          },
        };
      }

      if (method === 'DELETE') {
        const saldo = getSaldo({ clienteId: id, clienteNombre: null });
        if (saldo > EPS) {
          throw new HttpError(400, 'No se puede eliminar un cliente con deuda pendiente');
        }
        state.movimientos = state.movimientos.filter((m) => m.clienteId !== id);
        cliente.activo = false;
        persist();
        return { status: 200, body: { ok: true } };
      }
    }

    // --- sync ---
    if (method === 'GET' && pathname === '/api/sync/queue') {
      return {
        status: 200,
        body: state.syncQueue.filter((entry) => !entry.sincronizado),
      };
    }
    if (method === 'POST' && pathname === '/api/sync/queue') {
      const entry = {
        id: nextId(state.syncQueue),
        tabla: body?.tabla,
        operacion: body?.operacion,
        payload: body?.payload ?? null,
        sincronizado: false,
        createdAt: now().toISOString(),
      };
      state.syncQueue.push(entry);
      persist();
      return { status: 201, body: entry };
    }
    if (method === 'POST' && pathname === '/api/sync/process-offline') {
      const results = [];
      const errores = [];
      for (const ventaPayload of body?.ventas || []) {
        try {
          const venta = registrarVenta(ventaPayload);
          results.push(serializeVenta(venta));
        } catch (err) {
          errores.push({ metodoPago: ventaPayload.metodoPago, error: err.message });
        }
      }
      if (!results.length && errores.length) {
        throw new HttpError(400, errores[0].error, { errores });
      }
      if (results.length) persist();
      return { status: 200, body: { procesadas: results.length, ventas: results, errores } };
    }

    // --- backup (not part of the static demo) ---
    if (method === 'GET' && pathname === '/api/backup') {
      return { status: 200, body: [] };
    }
    const backupEstadoMatch = pathname.match(/^\/api\/backup\/estado\/(\d+)\/(\d+)$/);
    if (method === 'GET' && backupEstadoMatch) {
      return {
        status: 200,
        body: {
          anio: Number(backupEstadoMatch[1]),
          mes: Number(backupEstadoMatch[2]),
          nube: null,
          fisico: null,
        },
      };
    }
    if (pathname.startsWith('/api/backup/')) {
      throw new HttpError(501, DEMO_UNSUPPORTED);
    }

    throw new HttpError(404, `Ruta API no encontrada: ${method} ${pathname}`);
  }

  function handle(method, rawPath, { body, headers } = {}) {
    try {
      return route(
        String(method || 'GET').toUpperCase(),
        rawPath,
        body || {},
        headers || {}
      );
    } catch (err) {
      if (err instanceof HttpError) {
        return { status: err.status, body: { error: err.message, ...err.extra } };
      }
      console.error('Demo backend error:', err);
      return {
        status: 500,
        body: { error: err?.message || 'Error interno de la demo' },
      };
    }
  }

  return { handle, reset };
}
