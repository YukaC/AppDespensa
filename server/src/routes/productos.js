import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { matchesSearch } from '../lib/search.js';

const router = Router();

function serializeProducto(p) {
  return {
    ...p,
    precio: Number(p.precio),
    fechaVencimiento: p.fechaVencimiento ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { q, activo } = req.query;
    const where = {};
    if (activo !== 'false') where.activo = true;
    let productos = await prisma.producto.findMany({
      where,
      include: { marca: true, proveedor: true },
      take: 2000,
    });
    if (q) {
      const termino = String(q).trim();
      const codigo = termino.replace(/\s+/g, '');
      productos = productos.filter(
        (p) =>
          matchesSearch(p.nombre, termino) ||
          (p.codigoBarras && p.codigoBarras.includes(codigo))
      );
    }
    productos.sort((a, b) => {
      const fa = a.stock <= a.stockMinimo;
      const fb = b.stock <= b.stockMinimo;
      if (fa !== fb) return fa ? -1 : 1;
      const prov = (a.proveedor?.nombre || '').localeCompare(b.proveedor?.nombre || '', 'es');
      if (prov !== 0) return prov;
      if (a.stock !== b.stock) return a.stock - b.stock;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
    res.json(productos.map(serializeProducto));
  } catch (e) {
    next(e);
  }
});

router.get('/faltantes', async (_req, res, next) => {
  try {
    const all = await prisma.$queryRaw`
      SELECT p.*, m.nombre as "marcaNombre", pr.nombre as "proveedorNombre",
             p."fechaVencimiento"
      FROM "Producto" p
      LEFT JOIN "Marca" m ON p."marcaId" = m.id
      LEFT JOIN "Proveedor" pr ON p."proveedorId" = pr.id
      WHERE p.stock <= p."stockMinimo" AND p.activo = true
      ORDER BY pr.nombre ASC, p.stock ASC, p.nombre ASC
    `;
    res.json(
      all.map((p) => ({
        ...p,
        precio: Number(p.precio),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/faltantes/count', async (_req, res, next) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "Producto"
      WHERE stock <= "stockMinimo" AND activo = true
    `;
    res.json({ count: result[0]?.count ?? 0 });
  } catch (e) {
    next(e);
  }
});

router.get('/barcode/:codigo', async (req, res, next) => {
  try {
    const producto = await prisma.producto.findFirst({
      where: { codigoBarras: req.params.codigo, activo: true },
      include: { marca: true, proveedor: true },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(serializeProducto(producto));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: Number(req.params.id) },
      include: { marca: true, proveedor: true },
    });
    if (!producto) return res.status(404).json({ error: 'No encontrado' });
    res.json(serializeProducto(producto));
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { codigoBarras, nombre, precio, stock, stockMinimo, marcaId, proveedorId } =
      req.body;
    const producto = await prisma.producto.create({
      data: {
        codigoBarras: codigoBarras || null,
        nombre,
        precio,
        stock: stock ?? 0,
        stockMinimo: stockMinimo ?? 5,
        marcaId: marcaId || null,
        proveedorId: proveedorId || null,
      },
      include: { marca: true, proveedor: true },
    });
    res.status(201).json(serializeProducto(producto));
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };
    if (data.precio !== undefined) data.precio = data.precio;
    const producto = await prisma.producto.update({
      where: { id },
      data,
      include: { marca: true, proveedor: true },
    });
    res.json(serializeProducto(producto));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const producto = await prisma.producto.update({
      where: { id: Number(req.params.id) },
      data: { activo: false },
    });
    res.json(serializeProducto(producto));
  } catch (e) {
    next(e);
  }
});

export default router;
