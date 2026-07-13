import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import FloatingField from '../components/FloatingField';
import { toast } from '../lib/toast';

export default function Aumentos() {
  const [tipo, setTipo] = useState('marca');
  const [id, setId] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    api.aumentos.historialGlobal(20).then((h) => h && setHistorial(h)).catch(() => {});
  }, [result]);

  useEffect(() => {
    Promise.allSettled([
      api.marcas.list(),
      api.proveedores.list(),
      api.productos.list(),
    ]).then(([mRes, prRes, pRes]) => {
      if (mRes.status === 'fulfilled' && mRes.value) setMarcas(mRes.value);
      if (prRes.status === 'fulfilled' && prRes.value) setProveedores(prRes.value);
      if (pRes.status === 'fulfilled' && pRes.value) setProductos(pRes.value);
    });
  }, []);

  const options =
    tipo === 'marca'
      ? marcas
      : tipo === 'proveedor'
        ? proveedores
        : productos.map((p) => ({ id: p.id, nombre: p.nombre }));

  async function aplicar(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.aumentos.apply({
        tipo,
        id: Number(id),
        porcentaje: Number(porcentaje),
      });
      setResult(res);
      toast(`Aumento aplicado a ${res.actualizados} productos`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h2 className="page-title">Aumentos masivos</h2>
        <p className="page-subtitle">Por marca, proveedor o producto individual</p>
      </div>
      <form onSubmit={aplicar} className="card-panel space-y-5 p-5">
        <div className="flex gap-2">
          {['marca', 'proveedor', 'item'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTipo(t);
                setId('');
              }}
              className={`seg-btn ${tipo === t ? 'seg-btn-active' : 'seg-btn-inactive'}`}
            >
              {t === 'item' ? 'Producto' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <FloatingField
          as="select"
          label="Seleccionar"
          required
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </FloatingField>
        <FloatingField
          label="% de aumento"
          required
          type="number"
          step="0.1"
          min="0.1"
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-amber-600 py-2.5 font-medium text-white shadow-md shadow-amber-900/30 transition-all hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50 sm:min-h-0 min-h-[44px]"
        >
          {loading ? 'Aplicando...' : 'Aplicar aumento'}
        </button>
      </form>
      {result && (
        <p className="rounded-lg bg-green-900/30 p-3 text-green-300">
          Actualizados: {result.actualizados} productos (historial registrado)
        </p>
      )}

      {historial.length > 0 && (
        <div className="card-panel p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Historial de aumentos</h3>
          <ul className="max-h-48 space-y-1 overflow-auto text-sm">
            {historial.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-800 py-2.5"
              >
                <span className="font-medium text-slate-200">
                  {h.tipo} #{h.referenciaId}
                </span>
                <span className="text-amber-400">+{h.porcentaje}%</span>
                <span className="w-full text-xs text-slate-500 sm:w-auto">
                  {new Date(h.fecha).toLocaleString('es-AR')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
