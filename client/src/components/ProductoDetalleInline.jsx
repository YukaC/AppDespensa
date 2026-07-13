import { formatVencimiento, vencimientoClass } from '../lib/expiry';
import { isFaltante } from '../lib/groupProducts';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export default function ProductoDetalleInline({ producto, hero = false }) {
  if (!producto) return null;

  const faltante = isFaltante(producto);

  return (
    <div
      className={`px-4 py-4 ${
        hero
          ? 'bg-gradient-to-br from-slate-800/80 to-blue-950/50'
          : 'border-t border-blue-800/60 bg-blue-950/40'
      }`}
    >
      <p className={hero ? 'price-hero' : 'text-xl font-bold text-green-400'}>
        {formatMoney(Number(producto.precio))}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
            faltante
              ? 'bg-red-950/60 text-red-300 ring-1 ring-red-800/50'
              : 'bg-slate-800/80 text-slate-300 ring-1 ring-slate-700'
          }`}
        >
          Stock: {producto.stock}
          {faltante && ` (mín. ${producto.stockMinimo})`}
        </span>
        {!faltante && (
          <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-400 ring-1 ring-slate-700">
            Mín: {producto.stockMinimo}
          </span>
        )}
        {producto.fechaVencimiento && (
          <span
            className={`rounded-lg px-2.5 py-1 text-xs ring-1 ring-inset ${vencimientoClass(producto.fechaVencimiento)} bg-slate-900/50`}
          >
            Vence: {formatVencimiento(producto.fechaVencimiento)}
          </span>
        )}
      </div>

      {producto.codigoBarras && (
        <p className="mt-3 font-mono text-xs text-slate-500">{producto.codigoBarras}</p>
      )}
    </div>
  );
}
