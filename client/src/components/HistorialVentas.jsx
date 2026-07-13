import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SkeletonList } from './Skeleton';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function HistorialVentas() {
  const [ventas, setVentas] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.ventas
      .list(page)
      .then((data) => {
        if (data) {
          setVentas(data.ventas || []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => {
        setVentas([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <section className="card-panel p-5">
      <h3 className="mb-3 font-semibold text-slate-200">Historial de ventas</h3>

      {loading && <SkeletonList rows={3} />}

      {!loading && ventas.length === 0 && (
        <p className="empty-state border-0 bg-transparent py-4">Sin ventas registradas.</p>
      )}

      <div className="space-y-3">
        {ventas.map((venta) => (
          <article
            key={venta.id}
            className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/40"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-slate-800/80 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Venta #{venta.id}
                </p>
                <p className="text-xs text-slate-400">{formatFecha(venta.fecha)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-400">{formatMoney(venta.total)}</p>
                <p className="text-xs text-slate-500">
                  {venta.metodoPago}
                  {venta.metodoPago === 'Cuenta' &&
                    (venta.cliente?.nombre || venta.clienteNombre) &&
                    ` · ${venta.cliente?.nombre || venta.clienteNombre}`}
                </p>
              </div>
            </header>
            <ul className="divide-y divide-slate-700/60 px-4 py-1">
              {venta.detalles.map((det) => (
                <li
                  key={det.id}
                  className="flex justify-between gap-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    {det.producto?.nombre ?? `Producto #${det.productoId}`} × {det.cantidad}
                  </span>
                  <span className="shrink-0 text-slate-400">
                    {formatMoney(det.precioUnit * det.cantidad)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-secondary min-w-[5.5rem] text-xs disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-center text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary min-w-[5.5rem] text-xs disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </section>
  );
}
