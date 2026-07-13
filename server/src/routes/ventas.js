import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { registrarVenta, serializeVentaResponse } from '../lib/venta.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;
    const [total, ventas] = await Promise.all([
      prisma.venta.count(),
      prisma.venta.findMany({
        skip,
        take: limit,
        orderBy: { fecha: 'desc' },
      include: {
        cliente: true,
        detalles: {
          include: { producto: true },
        },
      },
      }),
    ]);
    res.json({
      page,
      limit,
      total,
      ventas: ventas.map((v) => ({
        ...v,
        total: Number(v.total),
        detalles: v.detalles.map((d) => ({
          ...d,
          precioUnit: Number(d.precioUnit),
          producto: d.producto
            ? { ...d.producto, precio: Number(d.producto.precio) }
            : null,
        })),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const venta = await prisma.$transaction((tx) => registrarVenta(tx, req.body));
    res.status(201).json(serializeVentaResponse(venta));
  } catch (e) {
    if (
      e.message?.includes('Stock') ||
      e.message?.includes('Producto') ||
      e.message?.includes('Ya existe') ||
      e.message?.includes('Ya existió') ||
      e.message?.includes('ya está registrado') ||
      e.message?.includes('ciclo abierto') ||
      e.message?.includes('cliente') ||
      e.message?.includes('item')
    ) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

export default router;
