import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatMesAnio, MESES } from '../lib/negocio';
import FloatingField from '../components/FloatingField';
import Modal from '../components/Modal';
import { toast } from '../lib/toast';

const now = new Date();

function mesAnterior() {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

export default function CierreMensual() {
  const prev = mesAnterior();
  const [anio, setAnio] = useState(prev.anio);
  const [mes, setMes] = useState(prev.mes);
  const [estado, setEstado] = useState(null);
  const [pinOpen, setPinOpen] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState('');

  const cargarEstado = () => {
    api.backup.estado(anio, mes).then(setEstado).catch(() => setEstado(null));
  };

  useEffect(() => {
    cargarEstado();
  }, [anio, mes]);

  async function descargarFisico() {
    setLoading('download');
    try {
      await api.backup.descargarFisico(anio, mes);
      toast('Backup descargado. Guardalo en la PC de administración.', 'success');
    } catch (e) {
      toast(e.message || 'Error al descargar', 'error');
    } finally {
      setLoading('');
    }
  }

  async function ejecutarConPin(accion) {
    setPinError('');
    try {
      const verificado = await api.verifyPin(pin);
      if (!verificado?.ok) {
        setPinError('PIN incorrecto');
        return;
      }

      if (accion === 'nube') {
        const res = await api.backup.crearNube(anio, mes, pin);
        toast(res?.mensaje || 'Backup en nube creado', 'success');
      } else if (accion === 'fisico') {
        const res = await api.backup.registrarFisico(anio, mes, pin);
        toast(res?.mensaje || 'Backup físico registrado', 'success');
      } else if (accion === 'archivar') {
        const res = await api.backup.archivarCuentas(anio, mes, pin);
        toast(res?.mensaje || 'Cuentas archivadas', 'success');
      } else if (accion === 'purgar') {
        const res = await api.backup.purgarNube(pin);
        toast(res?.mensaje || 'Purge completado', 'success');
      }

      setPinOpen(null);
      setPin('');
      cargarEstado();
    } catch (e) {
      setPinError(e.message || 'Error');
    }
  }

  const tieneFisico = Boolean(estado?.fisico);
  const tieneNube = Boolean(estado?.nube);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Cierre mensual</h2>
          <p className="page-subtitle">
            Backups, archivado visual de cuentas pagadas y retención en nube
          </p>
        </div>
        <Link to="/reportes-contables" className="btn-secondary text-sm">
          ← Reportes
        </Link>
      </div>

      <section className="card-panel space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingField
            label="Año"
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          />
          <FloatingField
            as="select"
            label="Mes a cerrar"
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
          >
            {MESES.map((nombre, i) => (
              <option key={nombre} value={i + 1}>
                {nombre}
              </option>
            ))}
          </FloatingField>
        </div>

        <p className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-sm text-slate-300">
          Período: <strong>{formatMesAnio(anio, mes)}</strong>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className={`rounded-lg border p-3 ${
              tieneNube ? 'border-emerald-800/50 bg-emerald-950/20' : 'border-slate-700'
            }`}
          >
            <p className="text-sm font-medium">Backup nube</p>
            <p className="text-xs text-slate-400">
              {tieneNube
                ? `Registrado ${new Date(estado.nube.createdAt).toLocaleString('es-AR')}`
                : 'Pendiente'}
            </p>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              tieneFisico ? 'border-emerald-800/50 bg-emerald-950/20' : 'border-slate-700'
            }`}
          >
            <p className="text-sm font-medium">Backup físico (PC admin)</p>
            <p className="text-xs text-slate-400">
              {tieneFisico
                ? `Confirmado ${new Date(estado.fisico.createdAt).toLocaleString('es-AR')}`
                : 'Pendiente — descargá y guardá el archivo'}
            </p>
          </div>
        </div>

        <ol className="space-y-3 text-sm text-slate-300">
          <li className="rounded-lg border border-slate-700/80 p-3">
            <p className="mb-2 font-medium">1. Crear backup en nube</p>
            <button
              type="button"
              onClick={() => setPinOpen('nube')}
              className="btn-primary text-sm"
            >
              Generar backup nube
            </button>
          </li>
          <li className="rounded-lg border border-slate-700/80 p-3">
            <p className="mb-2 font-medium">2. Descargar backup físico</p>
            <p className="mb-2 text-xs text-slate-500">
              JSON completo del mes para guardar en la PC de administración (disco/USB).
            </p>
            <button
              type="button"
              onClick={descargarFisico}
              disabled={loading === 'download'}
              className="btn-secondary text-sm"
            >
              {loading === 'download' ? 'Descargando...' : 'Descargar backup físico'}
            </button>
          </li>
          <li className="rounded-lg border border-slate-700/80 p-3">
            <p className="mb-2 font-medium">3. Confirmar backup físico guardado</p>
            <button
              type="button"
              onClick={() => setPinOpen('fisico')}
              className="btn-secondary text-sm"
            >
              Registrar backup en PC
            </button>
          </li>
          <li className="rounded-lg border border-slate-700/80 p-3">
            <p className="mb-2 font-medium">4. Ocultar tickets pagados en Cuentas</p>
            <p className="mb-2 text-xs text-slate-500">
              Solo visual: los datos siguen en la base. Requiere backup físico registrado.
            </p>
            <button
              type="button"
              onClick={() => setPinOpen('archivar')}
              disabled={!tieneFisico}
              className="btn-success text-sm disabled:opacity-40"
            >
              Archivar pagados del mes
            </button>
          </li>
        </ol>

        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-100">
          <p className="font-medium text-amber-200">Retención nube</p>
          <p className="mt-1">
            Backups de nube con más de 3 meses se eliminan automáticamente{' '}
            <strong>solo si existe backup físico</strong> del mismo mes en la PC de
            administración.
          </p>
          <button
            type="button"
            onClick={() => setPinOpen('purgar')}
            className="btn-secondary mt-3 text-xs"
          >
            Ejecutar purga manual
          </button>
        </div>
      </section>

      <Modal
        open={!!pinOpen}
        onClose={() => {
          setPinOpen(null);
          setPin('');
          setPinError('');
        }}
        title="Confirmar con PIN"
      >
        <p className="text-sm text-slate-400">
          Acción:{' '}
          {pinOpen === 'nube' && 'crear backup en nube'}
          {pinOpen === 'fisico' && 'registrar backup físico'}
          {pinOpen === 'archivar' && 'archivar tickets pagados en Cuentas'}
          {pinOpen === 'purgar' && 'purgar backups viejos en nube'}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ejecutarConPin(pinOpen);
          }}
          className="space-y-4"
        >
          <FloatingField
            label="PIN de acceso"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          {pinError && <p className="text-sm text-red-400">{pinError}</p>}
          <button type="submit" className="btn-primary w-full">
            Confirmar
          </button>
        </form>
      </Modal>
    </div>
  );
}
