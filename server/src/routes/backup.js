import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requirePin } from '../middleware/requirePin.js';
import {
  crearBackupNube,
  estadoBackupsMes,
  generarSnapshot,
  listarBackups,
  purgarBackupsNubeAntiguos,
  registrarBackupFisico,
  checksumBuffer,
} from '../lib/backup.js';
import { archivarPagadosMes } from '../lib/cuentaArchivo.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const backups = await listarBackups();
    res.json(backups);
  } catch (e) {
    next(e);
  }
});

router.get('/estado/:anio/:mes', async (req, res, next) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    const estado = await estadoBackupsMes(anio, mes);
    res.json(estado);
  } catch (e) {
    next(e);
  }
});

router.get('/export/:anio/:mes', async (req, res, next) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    const snapshot = await generarSnapshot(anio, mes);
    const json = JSON.stringify(snapshot, null, 2);
    const mesKey = snapshot.meta.mesAnio;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="backup-fisico-${mesKey}.json"`
    );
    res.setHeader('X-Backup-Checksum', checksumBuffer(Buffer.from(json)));
    res.send(json);
  } catch (e) {
    next(e);
  }
});

router.post('/nube', requirePin, async (req, res, next) => {
  try {
    const anio = Number(req.body?.anio);
    const mes = Number(req.body?.mes);
    if (!anio || !mes) {
      return res.status(400).json({ error: 'Año y mes obligatorios' });
    }
    const result = await crearBackupNube(anio, mes);
    res.status(201).json({
      mensaje: `Backup en nube registrado (${result.filename})`,
      ...result,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/fisico', requirePin, async (req, res, next) => {
  try {
    const anio = Number(req.body?.anio);
    const mes = Number(req.body?.mes);
    if (!anio || !mes) {
      return res.status(400).json({ error: 'Año y mes obligatorios' });
    }
    const result = await registrarBackupFisico(anio, mes, {
      checksum: req.body?.checksum,
      notas: req.body?.notas,
    });
    res.status(result.yaExistia ? 200 : 201).json({
      mensaje: result.yaExistia
        ? 'Backup físico ya estaba registrado para ese mes'
        : 'Backup físico registrado en PC de administración',
      ...result,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/archivar-cuentas', requirePin, async (req, res, next) => {
  try {
    const anio = Number(req.body?.anio);
    const mes = Number(req.body?.mes);
    if (!anio || !mes) {
      return res.status(400).json({ error: 'Año y mes obligatorios' });
    }

    const mesKey = `${anio}-${String(mes).padStart(2, '0')}`;
    const fisico = await prisma.backupRegistro.findFirst({
      where: { tipo: 'fisico', mesAnio: mesKey, eliminado: false },
    });
    if (!fisico) {
      return res.status(400).json({
        error:
          'Registrá primero el backup físico del mes en la PC de administración antes de archivar cuentas.',
      });
    }

    const result = await archivarPagadosMes(anio, mes);
    res.json({
      mensaje: `${result.archivados} movimiento(s) pagados ocultos en Cuentas (siguen en la base de datos).`,
      ...result,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/purgar-nube', requirePin, async (_req, res, next) => {
  try {
    const result = await purgarBackupsNubeAntiguos();
    res.json({
      mensaje:
        result.purgados.length > 0
          ? `${result.purgados.length} backup(s) de nube eliminados (> ${result.retencionMeses} meses, con backup físico confirmado).`
          : 'Nada para purgar (falta backup físico o aún no pasaron 3 meses).',
      ...result,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
