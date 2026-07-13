import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

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
      producto: d.producto?.nombre,
    })),
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

async function buildContablesResumen(inicio, fin, extra = {}) {
  const ciclos = await prisma.ciclo.findMany({
    where: {
      estado: 'cerrado',
      fechaApertura: { gte: inicio, lte: fin },
    },
    orderBy: { fechaApertura: 'asc' },
  });

  const cicloIds = ciclos.map((c) => c.id);
  const ventas =
    cicloIds.length > 0
      ? await prisma.venta.findMany({
          where: { cicloId: { in: cicloIds } },
          orderBy: { fecha: 'asc' },
          include: { detalles: { include: { producto: true } } },
        })
      : [];

  const porPago = {};
  let total = 0;
  for (const v of ventas) {
    const monto = Number(v.total);
    total += monto;
    const metodo = v.metodoPago || 'Otro';
    porPago[metodo] = (porPago[metodo] || 0) + monto;
  }

  const porDia = ciclos.map((c) => ({
    fecha: c.fechaApertura,
    total: Number(c.totalDia ?? 0),
    tickets: c.cantidadTickets,
    horaApertura: c.fechaApertura,
    horaCierre: c.fechaCierre,
  }));

  return {
    ...extra,
    total,
    jornadas: ciclos.length,
    cantidadTickets: ventas.length,
    porPago,
    porDia,
    ventas: ventas.map(serializeVentaReporte),
    periodoInicio: inicio,
    periodoFin: fin,
  };
}

router.get('/rendimiento', async (_req, res, next) => {
  try {
    const [row] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN fecha >= date_trunc('day', NOW()) THEN total ELSE 0 END), 0)::float AS hoy,
        COALESCE(SUM(CASE WHEN fecha >= date_trunc('week', NOW()) THEN total ELSE 0 END), 0)::float AS semana_actual,
        COALESCE(SUM(CASE WHEN fecha >= date_trunc('month', NOW()) THEN total ELSE 0 END), 0)::float AS mes_actual
      FROM "Venta"
    `;
    res.json({
      hoy: Number(row?.hoy ?? 0),
      semana_actual: Number(row?.semana_actual ?? 0),
      mes_actual: Number(row?.mes_actual ?? 0),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/top-productos', async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT p.id, p.nombre, SUM(vd.cantidad)::int AS cantidad_vendida,
             SUM(vd.cantidad * vd."precioUnit")::float AS ingresos
      FROM "VentaDetalle" vd
      INNER JOIN "Venta" v ON vd."ventaId" = v.id
      INNER JOIN "Producto" p ON vd."productoId" = p.id
      WHERE v.fecha >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.nombre
      ORDER BY cantidad_vendida DESC
      LIMIT 10
    `;
    res.json(
      rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        cantidad_vendida: Number(r.cantidad_vendida),
        ingresos: Number(r.ingresos),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/ventas-diarias', async (req, res, next) => {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 7), 90);
    const rows = await prisma.$queryRaw`
      SELECT date_trunc('day', fecha)::date AS dia,
             COALESCE(SUM(total), 0)::float AS ingresos,
             COUNT(*)::int AS ventas
      FROM "Venta"
      WHERE fecha >= NOW() - (${dias} * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    res.json(
      rows.map((r) => ({
        dia: r.dia,
        ingresos: Number(r.ingresos),
        ventas: Number(r.ventas),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/ventas-mensuales', async (req, res, next) => {
  try {
    const meses = Math.min(Math.max(Number(req.query.meses) || 6, 3), 24);
    const rows = await prisma.$queryRaw`
      SELECT date_trunc('month', fecha)::date AS mes,
             COALESCE(SUM(total), 0)::float AS ingresos,
             COUNT(*)::int AS ventas
      FROM "Venta"
      WHERE fecha >= NOW() - (${meses} * INTERVAL '1 month')
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    res.json(
      rows.map((r) => ({
        mes: r.mes,
        ingresos: Number(r.ingresos),
        ventas: Number(r.ventas),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/ventas-por-pago', async (req, res, next) => {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 7), 365);
    const rows = await prisma.$queryRaw`
      SELECT "metodoPago" AS metodo,
             COALESCE(SUM(total), 0)::float AS ingresos,
             COUNT(*)::int AS ventas
      FROM "Venta"
      WHERE fecha >= NOW() - (${dias} * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY ingresos DESC
    `;
    res.json(
      rows.map((r) => ({
        metodo: r.metodo,
        ingresos: Number(r.ingresos),
        ventas: Number(r.ventas),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/proximos-vencimientos', async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT p.id, p.nombre, p.stock, p."fechaVencimiento",
             pr.nombre AS "proveedorNombre"
      FROM "Producto" p
      LEFT JOIN "Proveedor" pr ON p."proveedorId" = pr.id
      WHERE p.activo = true
        AND p."fechaVencimiento" IS NOT NULL
        AND p."fechaVencimiento" <= NOW() + INTERVAL '30 days'
      ORDER BY p."fechaVencimiento" ASC
      LIMIT 30
    `;
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/contables/mensual', async (req, res, next) => {
  try {
    const anio = Number(req.query.anio) || new Date().getFullYear();
    const mes = Number(req.query.mes) || new Date().getMonth() + 1;
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59, 999);

    const data = await buildContablesResumen(inicio, fin, { anio, mes });
    res.json({
      anio,
      mes,
      totalMes: data.total,
      jornadas: data.jornadas,
      cantidadTickets: data.cantidadTickets,
      porPago: data.porPago,
      porDia: data.porDia,
      ventas: data.ventas,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/contables/semanal', async (req, res, next) => {
  try {
    let anio = Number(req.query.anio);
    let semana = Number(req.query.semana);

    if (req.query.semanaIso) {
      const [y, w] = String(req.query.semanaIso).split('-W');
      anio = Number(y);
      semana = Number(w);
    }

    if (!anio || !semana) {
      const now = new Date();
      anio = now.getFullYear();
      const jan4 = new Date(anio, 0, 4);
      const dayOfWeek = now.getDay() || 7;
      const thursday = new Date(now);
      thursday.setDate(now.getDate() + 4 - dayOfWeek);
      semana = Math.ceil(((thursday - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    }

    const { inicio, fin } = isoWeekRange(anio, semana);
    const data = await buildContablesResumen(inicio, fin, { anio, semana });

    res.json({
      anio,
      semana,
      totalSemana: data.total,
      jornadas: data.jornadas,
      cantidadTickets: data.cantidadTickets,
      porPago: data.porPago,
      porDia: data.porDia,
      ventas: data.ventas,
      periodoInicio: inicio,
      periodoFin: fin,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/contables/anual', async (req, res, next) => {
  try {
    const anio = Number(req.query.anio) || new Date().getFullYear();
    const inicio = new Date(anio, 0, 1);
    const fin = new Date(anio, 11, 31, 23, 59, 59, 999);

    const ciclos = await prisma.ciclo.findMany({
      where: {
        estado: 'cerrado',
        fechaApertura: { gte: inicio, lte: fin },
      },
    });

    const cicloIds = ciclos.map((c) => c.id);
    const ventas =
      cicloIds.length > 0
        ? await prisma.venta.findMany({
            where: { cicloId: { in: cicloIds } },
          })
        : [];

    const porMes = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      total: 0,
      ventas: 0,
      jornadas: 0,
    }));

    for (const c of ciclos) {
      const idx = new Date(c.fechaApertura).getMonth();
      porMes[idx].total += Number(c.totalDia ?? 0);
      porMes[idx].jornadas += 1;
    }
    for (const v of ventas) {
      const idx = new Date(v.fecha).getMonth();
      porMes[idx].ventas += 1;
    }

    const totalAnual = porMes.reduce((s, m) => s + m.total, 0);
    const conDatos = porMes.filter((m) => m.total > 0);
    const mesMayor = conDatos.length
      ? conDatos.reduce((a, b) => (b.total > a.total ? b : a))
      : null;
    const mesMenor = conDatos.length
      ? conDatos.reduce((a, b) => (b.total < a.total ? b : a))
      : null;

    res.json({
      anio,
      totalAnual,
      cantidadTickets: ventas.length,
      jornadas: ciclos.length,
      porMes,
      mesMayor,
      mesMenor,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/contables/rango', async (req, res, next) => {
  try {
    const desde = req.query.desde ? new Date(req.query.desde) : null;
    const hasta = req.query.hasta ? new Date(req.query.hasta) : null;
    const metodoPago = req.query.metodoPago || null;
    const buscar = req.query.q?.trim() || null;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Parámetros desde y hasta obligatorios' });
    }
    const fin = new Date(hasta);
    fin.setHours(23, 59, 59, 999);

    const where = {
      fecha: { gte: desde, lte: fin },
      cicloId: { not: null },
    };
    if (metodoPago) where.metodoPago = metodoPago;

    let ventas = await prisma.venta.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        detalles: { include: { producto: true } },
        ciclo: true,
      },
    });

    if (buscar) {
      const q = buscar.toLowerCase();
      const monto = Number(buscar.replace(',', '.'));
      ventas = ventas.filter((v) => {
        if (!Number.isNaN(monto) && Math.abs(Number(v.total) - monto) < 0.01) return true;
        return v.detalles.some((d) =>
          d.producto?.nombre?.toLowerCase().includes(q)
        );
      });
    }

    const porPago = {};
    let total = 0;
    for (const v of ventas) {
      const monto = Number(v.total);
      total += monto;
      const metodo = v.metodoPago || 'Otro';
      porPago[metodo] = (porPago[metodo] || 0) + monto;
    }

    res.json({
      desde,
      hasta: fin,
      total,
      cantidadTickets: ventas.length,
      porPago,
      ventas: ventas.map((v) => ({
        id: v.id,
        total: Number(v.total),
        metodoPago: v.metodoPago,
        fecha: v.fecha,
        cicloId: v.cicloId,
        detalles: v.detalles.map((d) => ({
          cantidad: d.cantidad,
          precioUnit: Number(d.precioUnit),
          producto: d.producto?.nombre,
        })),
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
