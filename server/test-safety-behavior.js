import test from 'node:test';
import assert from 'node:assert/strict';
import { generarSnapshot } from './src/lib/backup.js';
import { runNightlySync } from './src/services/cloudSync.js';
import { findClientePorNombre } from './src/lib/cuenta.js';

test('generarSnapshot fetches all clientes without take:500 truncation', async () => {
  // Mock prisma client with 600 fake clientes
  const fakeClientes = Array.from({ length: 600 }, (_, i) => ({
    id: i + 1,
    nombre: `Cliente ${i + 1}`,
    activo: true,
  }));

  const mockPrisma = {
    venta: { findMany: async () => [] },
    ciclo: { findMany: async () => [] },
    cuentaMovimiento: { findMany: async () => [] },
    cliente: {
      findMany: async ({ skip = 0, take = 500 }) => {
        return fakeClientes.slice(skip, skip + take);
      },
    },
  };

  // Replace global prisma temporarily for unit behavior check
  const originalPrisma = (await import('./src/lib/prisma.js')).default;
  Object.assign(originalPrisma, mockPrisma);

  const snapshot = await generarSnapshot(2026, 10);
  assert.equal(snapshot.clientes.length, 600, 'Snapshot must include all 600 clientes without truncation');
});

test('runNightlySync processes all pending sync items iteratively', async () => {
  const fakeSyncItems = Array.from({ length: 600 }, (_, i) => ({
    id: i + 1,
    sincronizado: false,
    createdAt: new Date(),
  }));

  let syncedCount = 0;
  const mockPrisma = {
    syncQueue: {
      findMany: async ({ take = 500 }) => {
        return fakeSyncItems.filter((i) => !i.sincronizado).slice(0, take);
      },
      updateMany: async ({ where }) => {
        const ids = where.id.in;
        for (const item of fakeSyncItems) {
          if (ids.includes(item.id)) {
            item.sincronizado = true;
            syncedCount++;
          }
        }
      },
    },
  };

  const originalPrisma = (await import('./src/lib/prisma.js')).default;
  Object.assign(originalPrisma, mockPrisma);

  // Mock global fetch for cloudSync
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.signal.aborted, false);
    return { ok: true };
  };

  process.env.CLOUD_SYNC_URL = 'http://localhost/mock-sync';
  const result = await runNightlySync();
  globalThis.fetch = originalFetch;

  assert.equal(result.synced, 600, 'runNightlySync must sync all 600 pending items across batches');
});
