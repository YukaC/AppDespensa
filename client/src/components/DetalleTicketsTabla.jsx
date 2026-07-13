import { formatFecha, formatHora, formatMoney } from '../lib/negocio';

export default function DetalleTicketsTabla({ ventas, className = '' }) {
  if (!ventas?.length) return null;

  return (
    <div className={className}>
      <h4 className="mb-2 text-sm font-semibold text-slate-300">Detalle de tickets</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600 text-slate-400">
              <th className="py-2 pr-2">Ticket</th>
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Hora</th>
              <th className="py-2 pr-2">Detalle</th>
              <th className="py-2 pr-2">Pago</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="border-b border-slate-700/50 align-top">
                <td className="py-2 pr-2">#{v.id}</td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  {formatFecha(v.fecha, { dateStyle: 'short' })}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap">{formatHora(v.fecha)}</td>
                <td className="py-2 pr-2 max-w-xs">
                  {(v.detalles || [])
                    .map((d) => `${d.producto ?? 'Producto'} ×${d.cantidad}`)
                    .join(', ')}
                </td>
                <td className="py-2 pr-2">{v.metodoPago}</td>
                <td className="py-2 whitespace-nowrap">{formatMoney(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
