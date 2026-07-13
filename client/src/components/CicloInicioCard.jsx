import { useState } from 'react';
import { api } from '../lib/api';
import FloatingField from './FloatingField';
import { toast } from '../lib/toast';

export default function CicloInicioCard({ onCicloAbierto }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function iniciar(e) {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Ingresá el PIN');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const verificado = await api.verifyPin(pin);
      if (!verificado?.ok) {
        setError('PIN incorrecto');
        return;
      }
      await api.ciclos.abrir(pin);
      const ciclo = await api.ciclos.actual();
      if (ciclo?.estado === 'abierto') {
        toast('Ciclo de facturación iniciado', 'success');
        onCicloAbierto(ciclo);
        setPin('');
      } else {
        setError('No se pudo confirmar el ciclo abierto');
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el ciclo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-md flex-col justify-center px-1">
      <div className="card-panel space-y-5 border-amber-700/40 p-6 shadow-xl shadow-black/30">
        <div className="text-center">
          <p className="text-3xl" aria-hidden>
            🧾
          </p>
          <h2 className="page-title mt-2">Ciclo de facturación cerrado</h2>
          <p className="page-subtitle mt-1">
            Las ventas están bloqueadas hasta iniciar la jornada con PIN de acceso.
          </p>
        </div>

        <form onSubmit={iniciar} className="space-y-4">
          <FloatingField
            label="PIN de acceso"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputClassName="text-center text-xl tracking-widest"
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-success w-full">
            {loading ? 'Iniciando...' : 'Iniciar ciclo de facturación'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Solo personal autorizado puede abrir la jornada contable del día.
        </p>
      </div>
    </div>
  );
}
