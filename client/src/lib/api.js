import { db } from './db';
import { matchesSearch } from './search.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function isOnline() {
  return navigator.onLine;
}

async function cacheProductos(list) {
  if (!list?.length) return;
  try {
    await db.productosCache.bulkPut(list);
  } catch (e) {
    console.warn('No se pudo cachear productos:', e);
  }
}

async function findCachedProductos(q) {
  const all = await db.productosCache.toArray();
  if (!q) return all;
  const termino = String(q).trim();
  const codigo = termino.replace(/\s+/g, '');
  return all.filter(
    (p) =>
      matchesSearch(p.nombre, termino) ||
      (p.codigoBarras && p.codigoBarras.includes(codigo))
  );
}

async function request(path, options = {}) {
  try {
    const { pin, ...fetchOptions } = options;
    const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };
    if (pin) headers['X-Admin-Pin'] = pin;
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  } catch (e) {
    if (!navigator.onLine) return null;
    throw e;
  }
}

export const api = {
  health: () => request('/health'),
  verifyPin: (pin) =>
    request('/auth/pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  productos: {
    list: async (q) => {
      if (!navigator.onLine) return findCachedProductos(q);
      const data = await request(`/productos${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      if (data) await cacheProductos(data);
      return data;
    },
    get: (id) => request(`/productos/${id}`),
    barcode: async (codigo) => {
      if (!navigator.onLine) {
        const p = await db.productosCache.where('codigoBarras').equals(codigo).first();
        return p || null;
      }
      const data = await request(`/productos/barcode/${encodeURIComponent(codigo)}`);
      if (data) {
        try {
          await db.productosCache.put(data);
        } catch (e) {
          console.warn('No se pudo cachear producto:', e);
        }
      }
      return data;
    },
    faltantes: () => request('/productos/faltantes'),
    faltantesCount: () => request('/productos/faltantes/count'),
    create: (data) =>
      request('/productos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/productos/${id}`, { method: 'DELETE' }),
  },
  proveedores: {
    list: () => request('/proveedores'),
    create: (nombre) =>
      request('/proveedores', { method: 'POST', body: JSON.stringify({ nombre }) }),
  },
  marcas: {
    list: () => request('/marcas'),
    create: (nombre) =>
      request('/marcas', { method: 'POST', body: JSON.stringify({ nombre }) }),
  },
  ventas: {
    list: (page = 1) => request(`/ventas?page=${page}`),
    create: (data) =>
      request('/ventas', { method: 'POST', body: JSON.stringify(data) }),
  },
  ciclos: {
    actual: () => request('/ciclos/actual'),
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/ciclos${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/ciclos/${id}`),
    abrir: (pin) =>
      request('/ciclos/abrir', {
        method: 'POST',
        body: JSON.stringify({ pin }),
        pin,
      }),
    cerrar: (id) => request(`/ciclos/${id}/cerrar`, { method: 'POST' }),
  },
  reportes: {
    rendimiento: () => request('/reportes/rendimiento'),
    topProductos: () => request('/reportes/top-productos'),
    proximosVencimientos: () => request('/reportes/proximos-vencimientos'),
    ventasDiarias: (dias = 30) => request(`/reportes/ventas-diarias?dias=${dias}`),
    ventasMensuales: (meses = 6) => request(`/reportes/ventas-mensuales?meses=${meses}`),
    ventasPorPago: (dias = 30) => request(`/reportes/ventas-por-pago?dias=${dias}`),
    contablesMensual: (anio, mes) =>
      request(`/reportes/contables/mensual?anio=${anio}&mes=${mes}`),
    contablesSemanal: (semanaIso) =>
      request(`/reportes/contables/semanal?semanaIso=${encodeURIComponent(semanaIso)}`),
    contablesAnual: (anio) => request(`/reportes/contables/anual?anio=${anio}`),
    contablesRango: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/reportes/contables/rango?${q}`);
    },
  },
  stock: {
    ingreso: (data, pin) =>
      request('/stock/ingreso', {
        method: 'POST',
        body: JSON.stringify(data),
        pin,
      }),
  },
  aumentos: {
    apply: (data) =>
      request('/aumentos', { method: 'POST', body: JSON.stringify(data) }),
    historialGlobal: (limit = 50) =>
      request(`/aumentos/historial?limit=${limit}`),
    historial: (productoId) => request(`/aumentos/historial/${productoId}`),
  },
  clientes: {
    list: (q) =>
      request(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    resumen: () => request('/clientes/resumen'),
    verificar: (nombre) =>
      request(`/clientes/verificar?nombre=${encodeURIComponent(nombre)}`),
    create: (data) =>
      request('/clientes', { method: 'POST', body: JSON.stringify(data) }),
    get: (id) => request(`/clientes/${id}`),
    getPorNombre: (nombre) =>
      request(`/clientes/nombre/${encodeURIComponent(nombre)}`),
    pago: (id, data) =>
      request(`/clientes/${id}/pagos`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    pagoLibre: (data) =>
      request('/clientes/pago-libre', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id) => request(`/clientes/${id}`, { method: 'DELETE' }),
    deleteLibre: (nombre) =>
      request(`/clientes/libre/${encodeURIComponent(nombre)}`, { method: 'DELETE' }),
    anularTicket: (movId) =>
      request(`/clientes/movimientos/${movId}`, { method: 'DELETE' }),
  },
  sync: {
    processOffline: (ventas) =>
      request('/sync/process-offline', {
        method: 'POST',
        body: JSON.stringify({ ventas }),
      }),
    enqueue: (data) =>
      request('/sync/queue', { method: 'POST', body: JSON.stringify(data) }),
  },
  backup: {
    estado: (anio, mes) => request(`/backup/estado/${anio}/${mes}`),
    list: () => request('/backup'),
    crearNube: (anio, mes, pin) =>
      request('/backup/nube', {
        method: 'POST',
        body: JSON.stringify({ anio, mes }),
        pin,
      }),
    registrarFisico: (anio, mes, pin, extra = {}) =>
      request('/backup/fisico', {
        method: 'POST',
        body: JSON.stringify({ anio, mes, ...extra }),
        pin,
      }),
    archivarCuentas: (anio, mes, pin) =>
      request('/backup/archivar-cuentas', {
        method: 'POST',
        body: JSON.stringify({ anio, mes }),
        pin,
      }),
    purgarNube: (pin) =>
      request('/backup/purgar-nube', { method: 'POST', body: '{}', pin }),
    descargarFisico: async (anio, mes) => {
      const res = await fetch(`${API_BASE}/backup/export/${anio}/${mes}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const checksum = res.headers.get('X-Backup-Checksum');
      const mesKey = `${anio}-${String(mes).padStart(2, '0')}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-fisico-${mesKey}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { checksum, mesKey };
    },
  },
};
