import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { runNightlySync } from '../services/cloudSync.js';
import { registrarVenta, serializeVentaResponse } from '../lib/venta.js';

const router = Router();

router.get('/queue', async (_req, res, next) => {
  try {
    const pending = await prisma.syncQueue.findMany({
      where: { sincronizado: false },
      orderBy: { createdAt: 'asc' },
    });
    res.json(pending);
  } catch (e) {
    next(e);
  }
});

router.post('/queue', async (req, res, next) => {
  try {
    const { tabla, operacion, payload } = req.body;
    const entry = await prisma.syncQueue.create({
      data: { tabla, operacion, payload },
    });
    res.status(201).json(entry);
  } catch (e) {
    next(e);
  }
});

router.post('/process-offline', async (req, res, next) => {
  try {
    const { ventas } = req.body;
    const results = [];
    const errores = [];

    for (const ventaPayload of ventas || []) {
      try {
        const venta = await prisma.$transaction((tx) => registrarVenta(tx, ventaPayload));
        results.push(serializeVentaResponse(venta));
      } catch (e) {
        errores.push({
          metodoPago: ventaPayload.metodoPago,
          error: e.message,
        });
      }
    }

    if (!results.length && errores.length) {
      return res.status(400).json({
        error: errores[0].error,
        errores,
      });
    }

    res.json({ procesadas: results.length, ventas: results, errores });
  } catch (e) {
    next(e);
  }
});

router.post('/cloud', async (_req, res, next) => {
  try {
    const result = await runNightlySync();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
