import { groupByProveedor } from '../lib/groupProducts';
import { daysUntilExpiry, formatVencimiento, vencimientoClass } from '../lib/expiry';

export default function FaltantesList({ productos }) {
  if (!productos?.length) {
    return <p className="text-slate-400">No hay faltantes por ahora.</p>;
  }

  const groups = groupByProveedor(productos);

  function vencimientoLabel(p) {
    if (!p.fechaVencimiento) return '—';
    const days = daysUntilExpiry(p.fechaVencimiento);
    return (
      <>
        {formatVencimiento(p.fechaVencimiento)}
        {days !== null && days < 15 && <span className="ml-1">⚠</span>}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([proveedor, items]) => (
        <section key={proveedor} className="rounded-lg border border-slate-700">
          <h3 className="border-b border-slate-700 bg-red-950/30 px-3 py-2.5 text-sm font-semibold text-red-300">
            {proveedor}
          </h3>

          <ul className="divide-y divide-slate-700/60 md:hidden">
            {items.map((p) => (
              <li key={p.id} className="px-3 py-3">
                <p className="font-medium leading-snug">{p.nombre}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>
                    Stock: <strong className="text-red-400">{p.stock}</strong>
                  </span>
                  <span>Mín: {p.stockMinimo}</span>
                  <span className={vencimientoClass(p.fechaVencimiento)}>
                    Vence: {vencimientoLabel(p)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="table-scroll hidden md:block">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-slate-400">
                  <th className="py-2 pl-3 pr-2">Producto</th>
                  <th className="py-2 pr-2">Stock</th>
                  <th className="py-2 pr-2">Mín.</th>
                  <th className="py-2 pr-3">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700/50">
                    <td className="py-2 pl-3 pr-2 font-medium">{p.nombre}</td>
                    <td className="py-2 pr-2 text-red-400">{p.stock}</td>
                    <td className="py-2 pr-2">{p.stockMinimo}</td>
                    <td className={`py-2 pr-3 text-xs ${vencimientoClass(p.fechaVencimiento)}`}>
                      {vencimientoLabel(p)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-slate-500">Agrupado por proveedor para pedido al preventista</p>
    </div>
  );
}
