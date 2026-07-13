import prisma from './prisma.js';
import { cuentaWhere } from './cuenta.js';

const EPS = 0.005;

export function mesAnioKey(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

export function rangoMes(anio, mes) {
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0, 23, 59, 59, 999);
  return { inicio, fin };
}

/** FIFO: ids de CARGO (con venta) totalmente cubiertos por PAGO. */
export function idsMovimientosPagados(movimientos) {
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id
  );
  const cargos = ordenados.filter((m) => m.tipo === 'CARGO' && m.visibleEnCuentas !== false);
  const pagos = ordenados.filter((m) => m.tipo === 'PAGO' && m.visibleEnCuentas !== false);

  const ocultar = new Set();
  let pagoIdx = 0;
  let pagoRestante = 0;

  for (const cargo of cargos) {
    let restante = Number(cargo.monto);
    while (restante > EPS) {
      if (pagoRestante < EPS) {
        if (pagoIdx >= pagos.length) break;
        pagoRestante = Number(pagos[pagoIdx].monto);
      }
      if (pagoRestante < EPS) break;

      const aplicar = Math.min(restante, pagoRestante);
      restante -= aplicar;
      pagoRestante -= aplicar;

      if (pagoRestante < EPS) {
        ocultar.add(pagos[pagoIdx].id);
        pagoIdx += 1;
      }
    }

    if (restante < EPS) {
      ocultar.add(cargo.id);
    }
  }

  return ocultar;
}

async function movimientosCuenta(ref, tx = prisma) {
  const where = cuentaWhere(ref);
  return tx.cuentaMovimiento.findMany({
    where,
    orderBy: { fecha: 'asc' },
  });
}

export async function archivarPagadosCuenta(ref, tx = prisma) {
  const movs = await movimientosCuenta(ref, tx);
  const ids = idsMovimientosPagados(movs);
  if (!ids.size) return 0;

  const now = new Date();
  await tx.cuentaMovimiento.updateMany({
    where: { id: { in: [...ids] } },
    data: { visibleEnCuentas: false, archivadoAt: now },
  });
  return ids.size;
}

export async function archivarPagadosMes(anio, mes, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT DISTINCT "clienteId", "clienteNombre"
    FROM "CuentaMovimiento"
    WHERE "visibleEnCuentas" = true
  `;

  let total = 0;
  for (const row of rows) {
    if (!row.clienteId && !row.clienteNombre) continue;
    total += await archivarPagadosCuenta(
      { clienteId: row.clienteId, clienteNombre: row.clienteNombre },
      tx
    );
  }

  return { archivados: total, mesAnio: mesAnioKey(anio, mes) };
}

export async function listarCuentasConMovimientosVisibles(tx = prisma) {
  const registrados = await tx.cliente.findMany({ where: { activo: true } });
  const resultado = [];

  for (const c of registrados) {
    const saldo = await tx.$queryRaw`
      SELECT COALESCE(SUM(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END), 0)::float AS saldo
      FROM "CuentaMovimiento"
      WHERE "clienteId" = ${c.id}
    `;
    const visibles = await tx.cuentaMovimiento.count({
      where: { clienteId: c.id, visibleEnCuentas: true },
    });
    if (Number(saldo[0]?.saldo ?? 0) > EPS || visibles > 0) {
      resultado.push({
        clienteId: c.id,
        clienteNombre: c.nombre,
        telefono: c.telefono,
        registrado: true,
        saldo: Number(saldo[0]?.saldo ?? 0),
      });
    }
  }

  const libres = await tx.$queryRaw`
    SELECT "clienteNombre",
      SUM(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END)::float AS saldo,
      SUM(CASE WHEN "visibleEnCuentas" THEN 1 ELSE 0 END)::int AS visibles
    FROM "CuentaMovimiento"
    WHERE "clienteId" IS NULL
    GROUP BY "clienteNombre"
    HAVING SUM(CASE WHEN tipo = 'CARGO' THEN monto ELSE -monto END) <> 0
       OR SUM(CASE WHEN "visibleEnCuentas" THEN 1 ELSE 0 END) > 0
  `;

  for (const r of libres) {
    resultado.push({
      clienteId: null,
      clienteNombre: r.clienteNombre,
      telefono: null,
      registrado: false,
      saldo: Number(r.saldo),
    });
  }

  return resultado.sort(
    (a, b) => b.saldo - a.saldo || a.clienteNombre.localeCompare(b.clienteNombre)
  );
}
