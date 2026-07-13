import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requirePin } from '../middleware/requirePin.js';
import {
  assertCicloAbierto,
  calcularResumenCiclo,
  cerrarCiclo,
  getCicloAbierto,
  serializeCiclo,
  serializeVenta,
} from '../lib/ciclo.js';

const router = Router();

router.get('/actual', async (_req, res, next) => {
  try {
    const ciclo = await getCicloAbierto();
    if (!ciclo) return res.json(null);

    const resumen = await calcularResumenCiclo(ciclo.id);
    const ventas = await prisma.venta.findMany({
      where: { cicloId: ciclo.id },
      orderBy: { fecha: 'asc' },
      include: {
        detalles: { include: { producto: true } },
        cliente: true,
      },
    });

    res.json({
      ...serializeCiclo(ciclo),
      resumen,
      ventas: ventas.map(serializeVenta),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const estado = req.query.estado;
    const desde = req.query.desde ? new Date(req.query.desde) : null;
    const hasta = req.query.hasta ? new Date(req.query.hasta) : null;

    const where = {};
    if (estado) where.estado = estado;
    if (desde || hasta) {
      where.fechaApertura = {};
      if (desde) where.fechaApertura.gte = desde;
      if (hasta) {
        const fin = new Date(hasta);
        fin.setHours(23, 59, 59, 999);
        where.fechaApertura.lte = fin;
      }
    }

    const ciclos = await prisma.ciclo.findMany({
      where,
      orderBy: { fechaApertura: 'desc' },
      take: Math.min(Number(req.query.limit) || 100, 500),
    });

    res.json(ciclos.map(serializeCiclo));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ciclo = await prisma.ciclo.findUnique({
      where: { id },
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
    if (!ciclo) return res.status(404).json({ error: 'Ciclo no encontrado' });

    const resumen = await calcularResumenCiclo(id);
    res.json({
      ...serializeCiclo(ciclo),
      resumen,
      ventas: ciclo.ventas.map(serializeVenta),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/abrir', requirePin, async (_req, res, next) => {
  try {
    const abierto = await getCicloAbierto();
    if (abierto) {
      return res.status(400).json({
        error: 'Ya hay un ciclo abierto. Cerralo antes de abrir uno nuevo.',
        cicloId: abierto.id,
      });
    }

    const ciclo = await prisma.ciclo.create({
      data: { estado: 'abierto' },
    });

    res.status(201).json(serializeCiclo(ciclo));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/cerrar', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { ciclo, resumen } = await prisma.$transaction((tx) => cerrarCiclo(id, tx));

    res.json({
      ...serializeCiclo(ciclo),
      resumen,
      ventas: ciclo.ventas.map(serializeVenta),
    });
  } catch (e) {
    if (e.message?.includes('no encontrado') || e.message?.includes('cerrado')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

export { assertCicloAbierto, getCicloAbierto };
export default router;
