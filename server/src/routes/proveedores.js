import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const proveedores = await prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } });
    res.json(proveedores);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const proveedor = await prisma.proveedor.create({ data: { nombre: req.body.nombre } });
    res.status(201).json(proveedor);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const proveedor = await prisma.proveedor.update({
      where: { id: Number(req.params.id) },
      data: { nombre: req.body.nombre },
    });
    res.json(proveedor);
  } catch (e) {
    next(e);
  }
});

export default router;
