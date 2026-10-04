import prisma from './prisma.js';
import { equalsSearch } from './search.js';

const EPS = 0.005;

export function normalizarNombre(nombre) {
  return String(nombre || '').trim();
}

export async function findClientePorNombre(nombre, tx = prisma) {
  const n = normalizarNombre(nombre);
  if (!n) return null;
  const clientes = await tx.cliente.findMany({ take: 500 });
  return clientes.find((c) => equalsSearch(c.nombre, n)) ?? null;
}

export async function findCuentaLibreNombre(nombre, tx = prisma) {
  const n = normalizarNombre(nombre);
  if (!n) return null;
  const rows = await tx.$queryRaw`
    SELECT DISTINCT "clienteNombre"
    FROM "CuentaMovimiento"
    WHERE "clienteId" IS NULL
  `;
  const match = rows.find((r) => equalsSearch(r.clienteNombre, n));
  return match?.clienteNombre ?? null;
}

export async function verificarDuplicadoCuenta(nombre, tx = prisma) {
  const n = normalizarNombre(nombre);
  if (!n) return { duplicado: false };

  const cliente = await findClientePorNombre(n, tx);
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

  const libre = await findCuentaLibreNombre(n, tx);
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

export async function assertClienteNoDuplicado(nombre, tx = prisma) {
  const check = await verificarDuplicadoCuenta(nombre, tx);
  if (check.duplicado) throw new Error(check.mensaje);
}

export async function resolverCuentaLibre(nombre, tx = prisma) {
  const n = normalizarNombre(nombre);
  const registrado = await findClientePorNombre(n, tx);
  if (registrado?.activo) {
    throw new Error(
      `"${registrado.nombre}" ya está registrado. Seleccioná "Registrado" en Caja.`
    );
  }
  if (registrado && !registrado.activo) {
    throw new Error(`"${registrado.nombre}" ya existió como cliente inactivo`);
  }
  const canon = await findCuentaLibreNombre(n, tx);
  return canon ?? n;
}

export function cuentaWhere({ clienteId, clienteNombre }) {
  if (clienteId) return { clienteId: Number(clienteId) };
  return { clienteId: null, clienteNombre: String(clienteNombre).trim() };
}

export async function saldoRegistrado(clienteId, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END), 0)::float AS saldo
    FROM "CuentaMovimiento"
    WHERE "clienteId" = ${clienteId}
  `;
  return Number(row?.saldo ?? 0);
}

export async function saldoLibre(nombre, tx = prisma) {
  const canon = await findCuentaLibreNombre(nombre, tx);
  if (!canon) return 0;
  const [row] = await tx.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END), 0)::float AS saldo
    FROM "CuentaMovimiento"
    WHERE "clienteId" IS NULL AND "clienteNombre" = ${canon}
  `;
  return Number(row?.saldo ?? 0);
}

export async function getSaldo({ clienteId, clienteNombre }, tx = prisma) {
  return clienteId
    ? saldoRegistrado(clienteId, tx)
    : saldoLibre(clienteNombre, tx);
}

export function validarPago(saldo, monto) {
  if (saldo <= 0) return 'No hay deuda pendiente en esta cuenta';
  if (monto > saldo + EPS) {
    return `El monto supera la deuda (${saldo.toFixed(2)}). No se permite saldo a favor`;
  }
  return null;
}

export function serializeMovimiento(m) {
  if (!m) return m;
  const base = { ...m, monto: Number(m.monto) };
  if (m.venta) {
    base.venta = {
      ...m.venta,
      total: Number(m.venta.total),
      detalles: m.venta.detalles?.map((d) => ({
        ...d,
        precioUnit: Number(d.precioUnit),
        producto: d.producto
          ? { ...d.producto, precio: Number(d.producto.precio) }
          : null,
      })),
    };
  }
  return base;
}

const ventaInclude = {
  detalles: { include: { producto: true } },
};

const movimientoInclude = {
  venta: { include: ventaInclude },
};

export async function registrarCobro(tx, ref, { monto, notas, ventaId }) {
  const notasFinal =
    notas?.trim() ||
    (ventaId ? `Cobro ticket #${ventaId}` : null);

  return tx.cuentaMovimiento.create({
    data: {
      clienteId: ref.clienteId,
      clienteNombre: ref.clienteNombre,
      tipo: 'PAGO',
      monto,
      notas: notasFinal,
    },
  });
}

export async function liquidarTicket(tx, cargoId) {
  const cargo = await tx.cuentaMovimiento.findUnique({
    where: { id: cargoId },
    include: { venta: { include: ventaInclude } },
  });
  if (!cargo?.ventaId) throw new Error('Ticket no encontrado');

  await tx.cuentaMovimiento.delete({ where: { id: cargo.id } });
  await tx.ventaDetalle.deleteMany({ where: { ventaId: cargo.ventaId } });
  await tx.venta.delete({ where: { id: cargo.ventaId } });
  return cargo;
}

export async function anularTicket(tx, cargoId) {
  const cargo = await tx.cuentaMovimiento.findUnique({
    where: { id: cargoId },
    include: { venta: { include: ventaInclude } },
  });
  if (!cargo?.ventaId || !cargo.venta) throw new Error('Ticket no encontrado');

  for (const d of cargo.venta.detalles) {
    await tx.producto.update({
      where: { id: d.productoId },
      data: { stock: { increment: d.cantidad } },
    });
  }
  await liquidarTicket(tx, cargoId);
  return cargo;
}

export async function resolveCuentaRef({ clienteId, clienteNombre }, tx = prisma) {
  if (clienteId) return { clienteId: Number(clienteId), clienteNombre: null };
  const canon =
    (await findCuentaLibreNombre(clienteNombre, tx)) ?? normalizarNombre(clienteNombre);
  return { clienteId: null, clienteNombre: canon };
}

export async function procesarPago({ clienteId, clienteNombre, monto, notas }) {
  return prisma.$transaction(async (tx) => {
    const ref = await resolveCuentaRef({ clienteId, clienteNombre }, tx);
    const saldo = await getSaldo(ref, tx);
    const pagoError = validarPago(saldo, monto);
    if (pagoError) throw new Error(pagoError);

    const where = cuentaWhere(ref);
    const cargos = await tx.cuentaMovimiento.findMany({
      where: { ...where, tipo: 'CARGO', ventaId: { not: null } },
      orderBy: { fecha: 'asc' },
    });

    const matchOne = cargos.find((c) => Math.abs(Number(c.monto) - monto) < EPS);
    if (matchOne) {
      const pago = await registrarCobro(tx, ref, {
        monto,
        notas: notas?.trim() || `Cobro ticket #${matchOne.ventaId}`,
        ventaId: matchOne.ventaId,
      });
      return {
        tipo: 'liquidacion_ticket',
        mensaje: `Ticket #${matchOne.ventaId} cobrado`,
        liquidados: 1,
        ventaId: matchOne.ventaId,
        pago: serializeMovimiento(pago),
      };
    }

    if (Math.abs(monto - saldo) < EPS) {
      const pago = await registrarCobro(tx, ref, {
        monto,
        notas: notas?.trim() || 'Cuenta saldada',
      });
      return {
        tipo: 'cuenta_cerrada',
        mensaje: 'Cuenta saldada. Los tickets siguen en el historial de ventas.',
        liquidados: cargos.length,
        ventaIds: cargos.map((c) => c.ventaId),
        pago: serializeMovimiento(pago),
      };
    }

    const pago = await registrarCobro(tx, ref, {
      monto,
      notas,
    });
    return {
      tipo: 'pago_parcial',
      mensaje: 'Cobro parcial registrado',
      pago: serializeMovimiento(pago),
    };
  });
}

export async function crearCargoVenta(tx, { ventaId, clienteId, clienteNombre, monto }) {
  return tx.cuentaMovimiento.create({
    data: {
      clienteId,
      clienteNombre,
      tipo: 'CARGO',
      monto,
      ventaId,
      notas: `Ticket #${ventaId}`,
    },
  });
}
