import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requirePin } from '../middleware/requirePin.js';

const router = Router();

router.post('/ingreso', requirePin, async (req, res, next) => {
  try {
    const { productoId, cantidad, fechaVencimiento } = req.body;
    const qty = Number(cantidad);
    if (!productoId || !qty || qty <= 0) {
      return res.status(400).json({ error: 'productoId y cantidad positiva son obligatorios' });
    }

    const venc = fechaVencimiento ? new Date(fechaVencimiento) : null;
    if (fechaVencimiento && Number.isNaN(venc?.getTime())) {
      return res.status(400).json({ error: 'fechaVencimiento inválida' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({
        where: { id: Number(productoId) },
      });
      if (!producto || !producto.activo) {
        throw new Error('Producto no encontrado');
      }

      const ingreso = await tx.ingresoMercaderia.create({
        data: {
          productoId: Number(productoId),
          cantidadIngresada: qty,
          fechaVencimiento: venc,
        },
      });

      const updated = await tx.producto.update({
        where: { id: Number(productoId) },
        data: {
          stock: { increment: qty },
          fechaVencimiento: venc,
        },
        include: { marca: true, proveedor: true },
      });

      await tx.syncQueue.create({
        data: {
          tabla: 'IngresoMercaderia',
          operacion: 'INSERT',
          payload: { ingreso, productoId: updated.id, stock: updated.stock },
        },
      });

      return { ingreso, producto: updated };
    });

    res.status(201).json({
      ingreso: result.ingreso,
      producto: {
        ...result.producto,
        precio: Number(result.producto.precio),
      },
    });
  } catch (e) {
    if (e.message === 'Producto no encontrado') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;
