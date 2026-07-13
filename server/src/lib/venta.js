import {
  crearCargoVenta,
  assertClienteNoDuplicado,
  resolverCuentaLibre,
  normalizarNombre,
} from './cuenta.js';
import { assertCicloAbierto } from './ciclo.js';

export async function registrarVenta(tx, payload) {
  const {
    items,
    metodoPago = 'Efectivo',
    clienteId,
    clienteNombre,
    registrarCliente,
    clienteTelefono,
    fecha,
  } = payload;

  if (!items?.length) {
    throw new Error('La venta debe tener al menos un item');
  }

  if (metodoPago === 'Cuenta') {
    if (!clienteId && !String(clienteNombre || '').trim()) {
      throw new Error('Indicá un cliente registrado o un nombre para anotar en cuenta');
    }
  }

  const ciclo = await assertCicloAbierto(tx);
  let total = 0;
  const detallesData = [];

  for (const item of items) {
    const producto = await tx.producto.findUnique({
      where: { id: item.productoId },
    });
    if (!producto || !producto.activo) {
      throw new Error(`Producto ${item.productoId} no disponible`);
    }
    if (producto.stock < item.cantidad) {
      throw new Error(`Stock insuficiente para ${producto.nombre}`);
    }
    const precioUnit = Number(producto.precio);
    total += precioUnit * item.cantidad;
    detallesData.push({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnit,
    });
  }

  let ventaClienteId = clienteId ? Number(clienteId) : null;
  let ventaClienteNombre = null;

  if (metodoPago === 'Cuenta') {
    if (ventaClienteId) {
      const existe = await tx.cliente.findUnique({ where: { id: ventaClienteId } });
      if (!existe?.activo) throw new Error('Cliente no encontrado');
    } else {
      const nombre = normalizarNombre(clienteNombre);
      if (registrarCliente) {
        await assertClienteNoDuplicado(nombre, tx);
        const nuevo = await tx.cliente.create({
          data: {
            nombre,
            telefono: clienteTelefono?.trim() || null,
          },
        });
        ventaClienteId = nuevo.id;
      } else {
        ventaClienteNombre = await resolverCuentaLibre(nombre, tx);
      }
    }
  }

  const nuevaVenta = await tx.venta.create({
    data: {
      total,
      metodoPago,
      cicloId: ciclo.id,
      clienteId: ventaClienteId,
      clienteNombre: ventaClienteNombre,
      fecha: fecha ? new Date(fecha) : new Date(),
      detalles: { create: detallesData },
    },
    include: { detalles: { include: { producto: true } } },
  });

  if (metodoPago === 'Cuenta') {
    await crearCargoVenta(tx, {
      ventaId: nuevaVenta.id,
      clienteId: ventaClienteId,
      clienteNombre: ventaClienteNombre,
      monto: total,
    });
  }

  for (const item of items) {
    await tx.producto.update({
      where: { id: item.productoId },
      data: { stock: { decrement: item.cantidad } },
    });
  }

  await tx.syncQueue.create({
    data: {
      tabla: 'Venta',
      operacion: 'INSERT',
      payload: nuevaVenta,
    },
  });

  return nuevaVenta;
}

export function serializeVentaResponse(venta) {
  return {
    ...venta,
    total: Number(venta.total),
    detalles: venta.detalles.map((d) => ({
      ...d,
      precioUnit: Number(d.precioUnit),
    })),
  };
}
