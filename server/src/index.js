import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import productosRouter from './routes/productos.js';
import proveedoresRouter from './routes/proveedores.js';
import marcasRouter from './routes/marcas.js';
import ventasRouter from './routes/ventas.js';
import aumentosRouter from './routes/aumentos.js';
import reportesRouter from './routes/reportes.js';
import stockRouter from './routes/stock.js';
import syncRouter from './routes/sync.js';
import clientesRouter from './routes/clientes.js';
import ciclosRouter from './routes/ciclos.js';
import backupRouter from './routes/backup.js';
import { runNightlySync } from './services/cloudSync.js';
import { purgarBackupsNubeAntiguos } from './lib/backup.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'autoservicio-fall' });
});

app.post('/api/auth/pin', (req, res) => {
  const pin = process.env.ADMIN_PIN || '1234';
  if (req.body?.pin === pin) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'PIN incorrecto' });
});

app.use('/api/productos', productosRouter);
app.use('/api/proveedores', proveedoresRouter);
app.use('/api/marcas', marcasRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/aumentos', aumentosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/stock', stockRouter);
app.use('/api/sync', syncRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/ciclos', ciclosRouter);
app.use('/api/backup', backupRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.path}` });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Autoservicio FALL en http://0.0.0.0:${PORT}`);
});

// Sincronización nocturna: cada día a las 3:00
function scheduleNightlySync() {
  let lastSyncDay = '';
  let lastPurgeDay = '';
  const check = () => {
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      const dayKey = now.toISOString().slice(0, 10);
      if (dayKey !== lastSyncDay) {
        lastSyncDay = dayKey;
        runNightlySync().catch(console.error);
      }
      if (dayKey !== lastPurgeDay) {
        lastPurgeDay = dayKey;
        purgarBackupsNubeAntiguos().catch(console.error);
      }
    }
  };
  setInterval(check, 60_000);
}
scheduleNightlySync();
