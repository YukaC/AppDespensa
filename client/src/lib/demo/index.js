/**
 * Demo-mode façade.
 *
 * `createDemoApi()` returns exactly the same object contract that
 * `lib/api.js` exposes to the pages, but every call is answered by the
 * in-browser backend instead of `fetch`. Pages do not know the difference.
 */

import { createDemoBackend, createMemoryStorage } from './backend.js';
import { DEMO_STORAGE_KEY } from './config.js';

function resolveStorage() {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Storage blocked (private mode): keep the demo working in memory.
  }
  return createMemoryStorage();
}

function isResetRequested() {
  try {
    return new URLSearchParams(globalThis.location?.search || '').get('demo-reset') === '1';
  } catch {
    return false;
  }
}

export function createDemoApi(options = {}) {
  const storage = options.storage ?? resolveStorage();

  if (isResetRequested()) {
    try {
      storage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // Nothing to reset if storage is unavailable.
    }
  }

  const backend =
    options.backend ?? createDemoBackend({ storage, now: options.now });

  async function request(method, path, { body, pin } = {}) {
    const res = backend.handle(method, path, {
      body,
      headers: pin != null ? { 'x-admin-pin': String(pin) } : {},
    });
    if (res.status >= 400) {
      throw new Error(res.body?.error || `Error ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.body;
  }

  return {
    health: () => request('GET', '/api/health'),
    verifyPin: (pin) =>
      request('POST', '/api/auth/pin', { body: { pin } }),

    productos: {
      list: (q) =>
        request(
          'GET',
          `/api/productos${q ? `?q=${encodeURIComponent(q)}` : ''}`
        ),
      get: (id) => request('GET', `/api/productos/${id}`),
      barcode: (codigo) =>
        request('GET', `/api/productos/barcode/${encodeURIComponent(codigo)}`),
      faltantes: () => request('GET', '/api/productos/faltantes'),
      faltantesCount: () => request('GET', '/api/productos/faltantes/count'),
      create: (data) => request('POST', '/api/productos', { body: data }),
      update: (id, data) =>
        request('PUT', `/api/productos/${id}`, { body: data }),
      delete: (id) => request('DELETE', `/api/productos/${id}`),
    },

    proveedores: {
      list: () => request('GET', '/api/proveedores'),
      create: (nombre) =>
        request('POST', '/api/proveedores', { body: { nombre } }),
    },

    marcas: {
      list: () => request('GET', '/api/marcas'),
      create: (nombre) => request('POST', '/api/marcas', { body: { nombre } }),
    },

    ventas: {
      list: (page = 1) => request('GET', `/api/ventas?page=${page}`),
      create: (data) => request('POST', '/api/ventas', { body: data }),
    },

    ciclos: {
      actual: () => request('GET', '/api/ciclos/actual'),
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/api/ciclos${qs ? `?${qs}` : ''}`);
      },
      get: (id) => request('GET', `/api/ciclos/${id}`),
      abrir: (pin) =>
        request('POST', '/api/ciclos/abrir', { body: { pin }, pin }),
      cerrar: (id) => request('POST', `/api/ciclos/${id}/cerrar`),
    },

    reportes: {
      rendimiento: () => request('GET', '/api/reportes/rendimiento'),
      topProductos: () => request('GET', '/api/reportes/top-productos'),
      proximosVencimientos: () =>
        request('GET', '/api/reportes/proximos-vencimientos'),
      ventasDiarias: (dias = 30) =>
        request('GET', `/api/reportes/ventas-diarias?dias=${dias}`),
      ventasMensuales: (meses = 6) =>
        request('GET', `/api/reportes/ventas-mensuales?meses=${meses}`),
      ventasPorPago: (dias = 30) =>
        request('GET', `/api/reportes/ventas-por-pago?dias=${dias}`),
      contablesMensual: (anio, mes) =>
        request(
          'GET',
          `/api/reportes/contables/mensual?anio=${anio}&mes=${mes}`
        ),
      contablesSemanal: (semanaIso) =>
        request(
          'GET',
          `/api/reportes/contables/semanal?semanaIso=${encodeURIComponent(semanaIso)}`
        ),
      contablesAnual: (anio) =>
        request('GET', `/api/reportes/contables/anual?anio=${anio}`),
      contablesRango: (params) => {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/api/reportes/contables/rango?${qs}`);
      },
    },

    stock: {
      ingreso: (data, pin) =>
        request('POST', '/api/stock/ingreso', { body: data, pin }),
    },

    aumentos: {
      apply: (data) => request('POST', '/api/aumentos', { body: data }),
      historialGlobal: (limit = 50) =>
        request('GET', `/api/aumentos/historial?limit=${limit}`),
      historial: (productoId) =>
        request('GET', `/api/aumentos/historial/${productoId}`),
    },

    clientes: {
      list: (q) =>
        request('GET', `/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      resumen: () => request('GET', '/api/clientes/resumen'),
      verificar: (nombre) =>
        request('GET', `/api/clientes/verificar?nombre=${encodeURIComponent(nombre)}`),
      create: (data) => request('POST', '/api/clientes', { body: data }),
      get: (id) => request('GET', `/api/clientes/${id}`),
      getPorNombre: (nombre) =>
        request('GET', `/api/clientes/nombre/${encodeURIComponent(nombre)}`),
      pago: (id, data) =>
        request('POST', `/api/clientes/${id}/pagos`, { body: data }),
      pagoLibre: (data) =>
        request('POST', '/api/clientes/pago-libre', { body: data }),
      delete: (id) => request('DELETE', `/api/clientes/${id}`),
      deleteLibre: (nombre) =>
        request('DELETE', `/api/clientes/libre/${encodeURIComponent(nombre)}`),
      anularTicket: (movId) =>
        request('DELETE', `/api/clientes/movimientos/${movId}`),
    },

    sync: {
      processOffline: (ventas) =>
        request('POST', '/api/sync/process-offline', { body: { ventas } }),
      enqueue: (data) => request('POST', '/api/sync/queue', { body: data }),
    },

    backup: {
      estado: (anio, mes) => request('GET', `/api/backup/estado/${anio}/${mes}`),
      list: () => request('GET', '/api/backup'),
      crearNube: (anio, mes, pin) =>
        request('POST', '/api/backup/nube', { body: { anio, mes }, pin }),
      registrarFisico: (anio, mes, pin, extra = {}) =>
        request('POST', '/api/backup/fisico', {
          body: { anio, mes, ...extra },
          pin,
        }),
      archivarCuentas: (anio, mes, pin) =>
        request('POST', '/api/backup/archivar-cuentas', {
          body: { anio, mes },
          pin,
        }),
      purgarNube: (pin) =>
        request('POST', '/api/backup/purgar-nube', { body: {}, pin }),
      descargarFisico: (anio, mes) =>
        request('GET', `/api/backup/export/${anio}/${mes}`),
    },
  };
}
