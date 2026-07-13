import { Router } from 'express';
import prisma from '../lib/prisma.js';
import {
  getSaldo,
  serializeMovimiento,
  anularTicket,
  procesarPago,
  assertClienteNoDuplicado,
  verificarDuplicadoCuenta,
  normalizarNombre,
  findCuentaLibreNombre,
} from '../lib/cuenta.js';
import { listarCuentasConMovimientosVisibles } from '../lib/cuentaArchivo.js';
import { matchesSearch } from '../lib/search.js';

const router = Router();

const movimientoInclude = {
  venta: {
    include: {
      detalles: { include: { producto: true } },
    },
  },
};

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    let clientes = await prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      take: 500,
    });
    if (q) {
      clientes = clientes.filter((c) => matchesSearch(c.nombre, q));
    }
    res.json(clientes);
  } catch (e) {
    next(e);
  }
});

router.get('/resumen', async (_req, res, next) => {
  try {
    const cuentas = await listarCuentasConMovimientosVisibles();
    res.json(cuentas);
  } catch (e) {
    next(e);
  }
});

router.get('/verificar', async (req, res, next) => {
  try {
    const nombre = normalizarNombre(req.query.nombre);
    if (!nombre) {
      return res.status(400).json({ error: 'Nombre obligatorio' });
    }
    const check = await verificarDuplicadoCuenta(nombre);
    res.json(check);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const nombre = normalizarNombre(req.body?.nombre);
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    await assertClienteNoDuplicado(nombre);
    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        telefono: req.body?.telefono?.trim() || null,
      },
    });
    res.status(201).json(cliente);
  } catch (e) {
    if (e.message?.includes('Ya existe') || e.message?.includes('Ya existió')) {
      return res.status(409).json({ error: e.message });
    }
    next(e);
  }
});

router.get('/nombre/:nombre', async (req, res, next) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const canon = await findCuentaLibreNombre(nombre);
    if (!canon) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    const movimientos = await prisma.cuentaMovimiento.findMany({
      where: { clienteId: null, clienteNombre: canon, visibleEnCuentas: true },
      orderBy: { fecha: 'desc' },
      include: movimientoInclude,
      take: 100,
    });
    const saldo = await getSaldo({ clienteNombre: canon });
    res.json({
      clienteNombre: canon,
      registrado: false,
      saldo,
      movimientos: movimientos.map(serializeMovimiento),
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/libre/:nombre', async (req, res, next) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const canon = await findCuentaLibreNombre(nombre);
    if (!canon) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    const saldo = await getSaldo({ clienteNombre: canon });
    if (saldo > 0.005) {
      return res.status(400).json({
        error: 'No se puede eliminar una cuenta con deuda pendiente',
      });
    }
    await prisma.cuentaMovimiento.deleteMany({
      where: { clienteId: null, clienteNombre: canon },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/pago-libre', async (req, res, next) => {
  try {
    const nombre = String(req.body?.clienteNombre || '').trim();
    const monto = Number(req.body?.monto);
    if (!nombre) {
      return res.status(400).json({ error: 'Nombre obligatorio' });
    }
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'Monto positivo obligatorio' });
    }

    const result = await procesarPago({
      clienteNombre: nombre,
      monto,
      notas: req.body?.notas,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.message?.includes('deuda') || e.message?.includes('supera')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

router.delete('/movimientos/:movId', async (req, res, next) => {
  try {
    const movId = Number(req.params.movId);
    const mov = await prisma.cuentaMovimiento.findUnique({
      where: { id: movId },
    });
    if (!mov) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    if (mov.tipo !== 'CARGO' || !mov.ventaId) {
      return res.status(400).json({ error: 'Solo se pueden anular tickets (cargos con venta)' });
    }

    await prisma.$transaction(async (tx) => {
      await anularTicket(tx, movId);
    });
    res.json({ ok: true, mensaje: `Ticket #${mov.ventaId} anulado. Stock restaurado.` });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        movimientos: {
          where: { visibleEnCuentas: true },
          orderBy: { fecha: 'desc' },
          include: movimientoInclude,
          take: 100,
        },
      },
    });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const saldo = await getSaldo({ clienteId: id });

    res.json({
      ...cliente,
      saldo,
      movimientos: cliente.movimientos.map(serializeMovimiento),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/pagos', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const monto = Number(req.body?.monto);
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'Monto positivo obligatorio' });
    }
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const result = await procesarPago({
      clienteId: id,
      monto,
      notas: req.body?.notas,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.message?.includes('deuda') || e.message?.includes('supera')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const saldo = await getSaldo({ clienteId: id });
    if (saldo > 0.005) {
      return res.status(400).json({
        error: 'No se puede eliminar un cliente con deuda pendiente',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.cuentaMovimiento.deleteMany({ where: { clienteId: id } });
      await tx.cliente.update({
        where: { id },
        data: { activo: false },
      });
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
