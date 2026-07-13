import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { tipo, id, porcentaje } = req.body;
    if (!['item', 'proveedor', 'marca'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser item, proveedor o marca' });
    }
    const pct = Number(porcentaje);
    if (!pct || pct <= 0) {
      return res.status(400).json({ error: 'porcentaje inválido' });
    }

    let where = { activo: true };
    if (tipo === 'item') where.id = Number(id);
    else if (tipo === 'proveedor') where.proveedorId = Number(id);
    else if (tipo === 'marca') where.marcaId = Number(id);

    const productos = await prisma.producto.findMany({ where });
    if (!productos.length) {
      return res.status(404).json({ error: 'No hay productos para actualizar' });
    }

    const factor = 1 + pct / 100;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.historialAumento.create({
        data: {
          tipo,
          referenciaId: Number(id),
          porcentaje: pct,
        },
      });

      const results = [];
      for (const p of productos) {
        const precioViejo = p.precio;
        const precioNuevo = Number(
          (Number(precioViejo) * factor).toFixed(2)
        );
        const updatedProducto = await tx.producto.update({
          where: { id: p.id },
          data: { precio: precioNuevo },
        });
        await tx.historialPrecio.create({
          data: {
            productoId: p.id,
            precioViejo,
            precioNuevo,
          },
        });
        await tx.syncQueue.create({
          data: {
            tabla: 'Producto',
            operacion: 'UPDATE',
            payload: { id: p.id, precio: precioNuevo },
          },
        });
        results.push({
          ...updatedProducto,
          precio: Number(updatedProducto.precio),
        });
      }
      return results;
    });

    res.json({ actualizados: updated.length, productos: updated });
  } catch (e) {
    next(e);
  }
});

router.get('/historial', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const historial = await prisma.historialAumento.findMany({
      orderBy: { fecha: 'desc' },
      take: limit,
    });
    res.json(
      historial.map((h) => ({
        ...h,
        porcentaje: Number(h.porcentaje),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/historial/:productoId', async (req, res, next) => {
  try {
    const historial = await prisma.historialPrecio.findMany({
      where: { productoId: Number(req.params.productoId) },
      orderBy: { fecha: 'desc' },
      take: 50,
    });
    res.json(
      historial.map((h) => ({
        ...h,
        precioViejo: Number(h.precioViejo),
        precioNuevo: Number(h.precioNuevo),
      }))
    );
  } catch (e) {
    next(e);
  }
});

export default router;
