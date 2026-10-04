import prisma from '../lib/prisma.js';

export async function runNightlySync() {
  const url = process.env.CLOUD_SYNC_URL;
  const token = process.env.CLOUD_SYNC_TOKEN;

  let totalSynced = 0;
  while (true) {
    const pending = await prisma.syncQueue.findMany({
      where: { sincronizado: false },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    if (!pending.length) break;

    if (!url) {
      return { ok: true, synced: totalSynced, message: 'CLOUD_SYNC_URL no configurada', pending: pending.length };
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ items: pending }),
    });

    if (!response.ok) {
      throw new Error(`Cloud sync failed: ${response.status}`);
    }

    const ids = pending.map((p) => p.id);
    await prisma.syncQueue.updateMany({
      where: { id: { in: ids } },
      data: { sincronizado: true },
    });

    totalSynced += ids.length;
    if (pending.length < 500) break;
  }

  return { ok: true, synced: totalSynced };
}
