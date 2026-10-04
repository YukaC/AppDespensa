import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('backup.js uses HTTP signal timeout', () => {
  const content = readFileSync('server/src/lib/backup.js', 'utf-8');
  assert.ok(content.includes('signal:') || content.includes('AbortSignal.timeout'), 'backup.js fetch missing timeout signal');
});

test('cloudSync.js uses HTTP signal timeout', () => {
  const content = readFileSync('server/src/services/cloudSync.js', 'utf-8');
  assert.ok(content.includes('signal:') || content.includes('AbortSignal.timeout'), 'cloudSync.js fetch missing timeout signal');
});

test('backup.js and cuenta.js use query limits (take)', () => {
  const backupContent = readFileSync('server/src/lib/backup.js', 'utf-8');
  const cuentaContent = readFileSync('server/src/lib/cuenta.js', 'utf-8');
  assert.ok(backupContent.includes('take:'), 'backup.js findMany missing take limit');
  assert.ok(cuentaContent.includes('take:'), 'cuenta.js findMany missing take limit');
});
