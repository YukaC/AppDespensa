import Dexie from 'dexie';

export const db = new Dexie('DespensaFernando');

db.version(1).stores({
  ventasPendientes: '++id, fecha, sincronizado',
  productosCache: 'id, codigoBarras, nombre',
  syncQueue: '++id, tabla, operacion, createdAt, sincronizado',
});

/** Asegura que IndexedDB esté abierta antes de leer/escribir. */
export const dbReady = db.open();

export async function guardarVentaOffline(venta) {
  const id = await db.ventasPendientes.add({
    ...venta,
    sincronizado: false,
    fecha: venta.fecha || new Date().toISOString(),
  });
  await db.syncQueue.add({
    tabla: 'Venta',
    operacion: 'INSERT',
    payload: venta,
    sincronizado: false,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function obtenerVentasPendientes() {
  return db.ventasPendientes.filter((v) => !v.sincronizado).toArray();
}

export async function marcarVentasSincronizadas(ids) {
  await db.ventasPendientes.where('id').anyOf(ids).modify({ sincronizado: true });
  await db.syncQueue.filter((q) => !q.sincronizado).modify({ sincronizado: true });
}
