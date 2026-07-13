import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const marcas = await prisma.marca.findMany({ orderBy: { nombre: 'asc' } });
    res.json(marcas);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const marca = await prisma.marca.create({ data: { nombre: req.body.nombre } });
    res.status(201).json(marca);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const marca = await prisma.marca.update({
      where: { id: Number(req.params.id) },
      data: { nombre: req.body.nombre },
    });
    res.json(marca);
  } catch (e) {
    next(e);
  }
});

export default router;
