import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatVencimiento, vencimientoClass } from '../lib/expiry';
import VentasGraficos from '../components/VentasGraficos';
import HistorialVentas from '../components/HistorialVentas';
import { SkeletonCards } from '../components/Skeleton';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export default function Dashboard() {
  const [rendimiento, setRendimiento] = useState(null);
  const [top, setTop] = useState([]);
  const [vencimientos, setVencimientos] = useState([]);
  const [ventasDiarias, setVentasDiarias] = useState([]);
  const [ventasMensuales, setVentasMensuales] = useState([]);
  const [ventasPorPago, setVentasPorPago] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([
      api.reportes.rendimiento(),
      api.reportes.topProductos(),
      api.reportes.proximosVencimientos(),
      api.reportes.ventasDiarias(30),
      api.reportes.ventasMensuales(6),
      api.reportes.ventasPorPago(30),
    ]).then(([rRes, tRes, vRes, dRes, mRes, pRes]) => {
      if (rRes.status === 'fulfilled' && rRes.value) setRendimiento(rRes.value);
      else if (rRes.status === 'rejected') {
        setError(rRes.reason?.message || 'Error al cargar ingresos');
      }
      if (tRes.status === 'fulfilled' && tRes.value) setTop(tRes.value);
      if (vRes.status === 'fulfilled' && vRes.value) setVencimientos(vRes.value);
      if (dRes.status === 'fulfilled' && dRes.value) setVentasDiarias(dRes.value);
      if (mRes.status === 'fulfilled' && mRes.value) setVentasMensuales(mRes.value);
      if (pRes.status === 'fulfilled' && pRes.value) setVentasPorPago(pRes.value);
    });
  }, []);

  const cards = rendimiento
    ? [
        { label: 'Ingresos hoy', value: rendimiento.hoy },
        { label: 'Esta semana', value: rendimiento.semana_actual },
        { label: 'Este mes', value: rendimiento.mes_actual },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Resumen de ventas y alertas</p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="card-panel bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-5"
          >
            <p className="text-sm text-slate-400">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-green-400">{formatMoney(c.value)}</p>
          </div>
        ))}
        {!rendimiento && !error && <SkeletonCards count={3} />}
      </div>

      <VentasGraficos
        diarias={ventasDiarias}
        mensuales={ventasMensuales}
        porPago={ventasPorPago}
      />

      <section className="card-panel p-5">
        <h3 className="mb-3 font-semibold text-blue-300">Top 10 productos (30 días)</h3>
        {top.length === 0 ? (
          <p className="empty-state border-0 bg-transparent py-4">Sin ventas registradas en el período.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-700/60 md:hidden">
              {top.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <span className="mr-2 text-xs text-slate-500">#{i + 1}</span>
                    <span className="font-medium">{p.nombre}</span>
                    <p className="text-xs text-slate-500">{p.cantidad_vendida} uds.</p>
                  </div>
                  <span className="shrink-0 font-semibold text-green-400">
                    {formatMoney(p.ingresos)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="table-scroll hidden md:block">
              <table className="w-full min-w-[24rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-600 text-slate-400">
                    <th className="py-2">#</th>
                    <th className="py-2">Producto</th>
                    <th className="py-2 text-right">Unidades</th>
                    <th className="py-2 text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-700/50">
                      <td className="py-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 font-medium">{p.nombre}</td>
                      <td className="py-2 text-right">{p.cantidad_vendida}</td>
                      <td className="py-2 text-right text-green-400">
                        {formatMoney(p.ingresos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <HistorialVentas />

      <section className="card-panel p-5">
        <h3 className="mb-3 font-semibold text-amber-300">Próximos vencimientos</h3>
        {vencimientos.length === 0 ? (
          <p className="empty-state border-0 bg-transparent py-4">
            No hay vencimientos en los próximos 30 días.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-700/60 md:hidden">
              {vencimientos.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{p.nombre}</p>
                    <p className="mt-1 text-xs text-slate-500">Stock: {p.stock}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-medium ${vencimientoClass(p.fechaVencimiento)}`}
                  >
                    {formatVencimiento(p.fechaVencimiento)}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="hidden divide-y divide-slate-700 md:block">
              {vencimientos.map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <span>{p.nombre}</span>
                  <span className="flex gap-3">
                    <span className="text-slate-500">stk {p.stock}</span>
                    <span className={vencimientoClass(p.fechaVencimiento)}>
                      {formatVencimiento(p.fechaVencimiento)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
