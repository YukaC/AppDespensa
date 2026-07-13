import { api } from './api';
import { db, guardarVentaOffline, marcarVentasSincronizadas } from './db';

function payloadSync(venta) {
  return {
    items: venta.items,
    metodoPago: venta.metodoPago,
    fecha: venta.fecha,
    clienteId: venta.clienteId,
    clienteNombre: venta.clienteNombre,
    registrarCliente: venta.registrarCliente,
    clienteTelefono: venta.clienteTelefono,
  };
}

export async function syncPendingVentas() {
  if (!navigator.onLine) return;
  const pendientes = await db.ventasPendientes
    .filter((v) => !v.sincronizado)
    .toArray();
  if (!pendientes.length) return;

  try {
    for (const venta of pendientes) {
      try {
        await api.sync.processOffline([payloadSync(venta)]);
        await marcarVentasSincronizadas([venta.id]);
      } catch (e) {
        console.warn(`Venta offline #${venta.id} no sincronizada:`, e.message || e);
      }
    }
  } catch (e) {
    console.warn('Error al sincronizar ventas offline:', e);
  }
}

export function startOfflineSync() {
  window.addEventListener('online', () => syncPendingVentas());
  setInterval(() => syncPendingVentas(), 30_000);
}

export async function crearVentaConFallback(ventaData) {
  const esCuenta = ventaData.metodoPago === 'Cuenta';

  if (esCuenta && !navigator.onLine) {
    throw new Error('Cuenta corriente requiere conexión al servidor.');
  }

  try {
    if (navigator.onLine) {
      return await api.ventas.create(ventaData);
    }
  } catch (e) {
    if (esCuenta) {
      throw new Error(
        e.message || 'No se pudo anotar en cuenta. Verificá la conexión con el servidor.'
      );
    }
  }

  if (esCuenta) {
    throw new Error('Cuenta corriente requiere conexión al servidor.');
  }

  await guardarVentaOffline(ventaData);
  return { offline: true, ...ventaData };
}

export { guardarVentaOffline };
