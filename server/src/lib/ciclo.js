import prisma from './prisma.js';

export function serializeVenta(venta) {
  return {
    ...venta,
    total: Number(venta.total),
    detalles: venta.detalles?.map((d) => ({
      ...d,
      precioUnit: Number(d.precioUnit),
      producto: d.producto
        ? { ...d.producto, precio: Number(d.producto.precio) }
        : null,
    })),
  };
}

export function serializeCiclo(ciclo) {
  return {
    ...ciclo,
    totalDia: ciclo.totalDia != null ? Number(ciclo.totalDia) : null,
  };
}

export async function getCicloAbierto(tx = prisma) {
  return tx.ciclo.findFirst({
    where: { estado: 'abierto' },
    orderBy: { fechaApertura: 'desc' },
  });
}

export async function assertCicloAbierto(tx = prisma) {
  const ciclo = await getCicloAbierto(tx);
  if (!ciclo) {
    throw new Error('No hay ciclo abierto. Abrí el ciclo del día antes de registrar ventas.');
  }
  return ciclo;
}

export async function calcularResumenCiclo(cicloId, tx = prisma) {
  const ventas = await tx.venta.findMany({
    where: { cicloId },
    orderBy: { fecha: 'asc' },
  });

  const porPago = {};
  let totalDia = 0;

  for (const v of ventas) {
    const monto = Number(v.total);
    totalDia += monto;
    const metodo = v.metodoPago || 'Otro';
    porPago[metodo] = (porPago[metodo] || 0) + monto;
  }

  return {
    cantidadTickets: ventas.length,
    totalDia,
    porPago,
    ventas: ventas.map((v) => ({
      id: v.id,
      total: Number(v.total),
      metodoPago: v.metodoPago,
      fecha: v.fecha,
    })),
  };
}

export async function cerrarCiclo(cicloId, tx = prisma) {
  const ciclo = await tx.ciclo.findUnique({ where: { id: cicloId } });
  if (!ciclo) throw new Error('Ciclo no encontrado');
  if (ciclo.estado === 'cerrado') throw new Error('El ciclo ya está cerrado');

  const resumen = await calcularResumenCiclo(cicloId, tx);

  const cerrado = await tx.ciclo.update({
    where: { id: cicloId },
    data: {
      estado: 'cerrado',
      fechaCierre: new Date(),
      totalDia: resumen.totalDia,
      cantidadTickets: resumen.cantidadTickets,
    },
    include: {
      ventas: {
        orderBy: { fecha: 'asc' },
        include: {
          detalles: { include: { producto: true } },
          cliente: true,
        },
      },
    },
  });

  return { ciclo: cerrado, resumen };
}
