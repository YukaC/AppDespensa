import { createHash } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './prisma.js';
import { mesAnioKey, rangoMes } from './cuentaArchivo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_ROOT = path.join(__dirname, '../../backups');
const NUBE_DIR = path.join(BACKUP_ROOT, 'nube');
const RETENCION_NUBE_MESES = 3;

export function checksumBuffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export async function generarSnapshot(anio, mes) {
  const { inicio, fin } = rangoMes(anio, mes);
  const mesKey = mesAnioKey(anio, mes);

  const [ventas, ciclos, movimientos, clientes] = await Promise.all([
    prisma.venta.findMany({
      where: { fecha: { gte: inicio, lte: fin } },
      include: { detalles: { include: { producto: true } }, cliente: true },
    }),
    prisma.ciclo.findMany({
      where: { fechaApertura: { gte: inicio, lte: fin } },
    }),
    prisma.cuentaMovimiento.findMany({
      where: { fecha: { gte: inicio, lte: fin } },
    }),
    prisma.cliente.findMany(),
  ]);

  return {
    meta: {
      tipo: 'backup-mensual',
      mesAnio: mesKey,
      generadoEn: new Date().toISOString(),
      periodo: { inicio, fin },
    },
    ventas,
    ciclos,
    movimientos,
    clientes,
  };
}

export async function crearBackupNube(anio, mes) {
  await mkdir(NUBE_DIR, { recursive: true });
  const snapshot = await generarSnapshot(anio, mes);
  const json = JSON.stringify(snapshot, null, 2);
  const buf = Buffer.from(json, 'utf8');
  const checksum = checksumBuffer(buf);
  const mesKey = mesAnioKey(anio, mes);
  const filename = `${mesKey}.json`;
  const filepath = path.join(NUBE_DIR, filename);

  await writeFile(filepath, buf);

  const url = process.env.CLOUD_BACKUP_URL;
  const token = process.env.CLOUD_BACKUP_TOKEN || process.env.CLOUD_SYNC_TOKEN;
  if (url) {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        mesAnio: mesKey,
        checksum,
        payload: snapshot,
      }),
    });
  }

  const registro = await prisma.backupRegistro.create({
    data: {
      tipo: 'nube',
      mesAnio: mesKey,
      archivo: filepath,
      checksum,
      tamanoBytes: buf.length,
      notas: url ? 'Subido a CLOUD_BACKUP_URL' : 'Almacenado local en server/backups/nube',
    },
  });

  return { registro, checksum, filename, tamanoBytes: buf.length };
}

export async function registrarBackupFisico(anio, mes, { checksum, notas }) {
  const mesKey = mesAnioKey(anio, mes);
  const existente = await prisma.backupRegistro.findFirst({
    where: { tipo: 'fisico', mesAnio: mesKey, eliminado: false },
  });
  if (existente) {
    return { registro: existente, yaExistia: true };
  }

  const registro = await prisma.backupRegistro.create({
    data: {
      tipo: 'fisico',
      mesAnio: mesKey,
      checksum: checksum || null,
      notas: notas?.trim() || 'Backup guardado en PC de administración',
    },
  });

  return { registro, yaExistia: false };
}

export async function tieneBackupFisico(mesKey) {
  const row = await prisma.backupRegistro.findFirst({
    where: { tipo: 'fisico', mesAnio: mesKey, eliminado: false },
  });
  return Boolean(row);
}

export async function purgarBackupsNubeAntiguos() {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - RETENCION_NUBE_MESES);

  const candidatos = await prisma.backupRegistro.findMany({
    where: {
      tipo: 'nube',
      eliminado: false,
      createdAt: { lt: limite },
    },
    orderBy: { createdAt: 'asc' },
  });

  const purgados = [];
  const omitidos = [];

  for (const backup of candidatos) {
    const fisico = await tieneBackupFisico(backup.mesAnio);
    if (!fisico) {
      omitidos.push({
        id: backup.id,
        mesAnio: backup.mesAnio,
        motivo: 'Sin backup físico registrado para ese mes',
      });
      continue;
    }

    if (backup.archivo) {
      try {
        await unlink(backup.archivo);
      } catch {
        // archivo ya no existe
      }
    }

    await prisma.backupRegistro.update({
      where: { id: backup.id },
      data: { eliminado: true, eliminadoAt: new Date() },
    });

    purgados.push({ id: backup.id, mesAnio: backup.mesAnio });
  }

  return { purgados, omitidos, retencionMeses: RETENCION_NUBE_MESES };
}

export async function listarBackups() {
  return prisma.backupRegistro.findMany({
    where: { eliminado: false },
    orderBy: { createdAt: 'desc' },
    take: 48,
  });
}

export async function estadoBackupsMes(anio, mes) {
  const mesKey = mesAnioKey(anio, mes);
  const [fisico, nube] = await Promise.all([
    prisma.backupRegistro.findFirst({
      where: { tipo: 'fisico', mesAnio: mesKey, eliminado: false },
    }),
    prisma.backupRegistro.findFirst({
      where: { tipo: 'nube', mesAnio: mesKey, eliminado: false },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { mesAnio: mesKey, fisico, nube };
}
