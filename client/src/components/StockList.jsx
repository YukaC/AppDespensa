import { organizeProductosConAlertas, isFaltante } from '../lib/groupProducts';
import { daysUntilExpiry, formatVencimiento, vencimientoClass } from '../lib/expiry';
import ProductoDetalleInline from './ProductoDetalleInline';

function VencimientoBadge({ fechaVencimiento }) {
  if (!fechaVencimiento) return null;
  const days = daysUntilExpiry(fechaVencimiento);
  const label = formatVencimiento(fechaVencimiento);
  const extra =
    days !== null && days < 0
      ? ' (vencido)'
      : days !== null && days < 15
        ? ` (${days}d)`
        : '';
  return (
    <span className={`text-xs ${vencimientoClass(fechaVencimiento)}`}>
      Vence: {label}
      {extra}
    </span>
  );
}

function GrupoProveedor({
  proveedor,
  items,
  onSelect,
  showStock,
  destacarAlerta,
  selectedId,
}) {
  return (
    <section
      className={`rounded-lg border ${
        destacarAlerta
          ? 'border-red-800/80 bg-red-950/25'
          : 'border-slate-700 bg-slate-800/40'
      }`}
    >
      <h3
        className={`border-b px-3 py-2 text-sm font-semibold ${
          destacarAlerta
            ? 'border-red-900/60 bg-red-950/40 text-red-300'
            : 'border-slate-700 bg-slate-800 text-blue-300'
        }`}
      >
        {proveedor}
        <span className="ml-2 font-normal text-slate-500">({items.length})</span>
      </h3>
      <ul className="divide-y divide-slate-700/60">
        {items.map((p) => {
          const selected = selectedId === p.id;
          return (
            <li key={p.id} className={selected ? 'bg-slate-800/80' : ''}>
              <button
                type="button"
                onClick={() => onSelect?.(p)}
                disabled={!onSelect}
                className={`flex w-full flex-col gap-1 px-3 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:py-2 ${
                  onSelect ? 'hover:bg-slate-700/80' : ''
                } ${selected ? 'ring-1 ring-inset ring-blue-600/60' : ''}`}
              >
                <span className="font-medium">{p.nombre}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  {showStock && (
                    <span className={isFaltante(p) ? 'font-medium text-red-400' : ''}>
                      Stk {p.stock}
                      {isFaltante(p) && (
                        <span className="ml-1 text-xs text-red-300/80">
                          (mín. {p.stockMinimo})
                        </span>
                      )}
                    </span>
                  )}
                  {p.precio != null && !selected && (
                    <span className="text-green-400">
                      ${Number(p.precio).toLocaleString('es-AR')}
                    </span>
                  )}
                  {!selected && <VencimientoBadge fechaVencimiento={p.fechaVencimiento} />}
                </span>
              </button>
              {selected && <ProductoDetalleInline producto={p} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function StockList({
  productos,
  onSelect,
  showStock = true,
  selectedId = null,
}) {
  if (!productos?.length) {
    return <p className="empty-state">No hay productos para mostrar.</p>;
  }

  const { alertas, regulares } = organizeProductosConAlertas(productos);
  const totalAlertas = alertas.reduce((n, [, items]) => n + items.length, 0);

  const grupoProps = { onSelect, showStock, selectedId };

  return (
    <div className="space-y-4">
      {totalAlertas > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-red-400">
            Stock bajo — {totalAlertas} producto{totalAlertas !== 1 ? 's' : ''}
          </p>
          {alertas.map(([proveedor, items]) => (
            <GrupoProveedor
              key={`alerta-${proveedor}`}
              proveedor={proveedor}
              items={items}
              destacarAlerta
              {...grupoProps}
            />
          ))}
        </div>
      )}

      {regulares.length > 0 && (
        <div className="space-y-3">
          {totalAlertas > 0 && (
            <p className="text-sm font-medium text-slate-400">Resto del stock</p>
          )}
          {regulares.map(([proveedor, items]) => (
            <GrupoProveedor
              key={`regular-${proveedor}`}
              proveedor={proveedor}
              items={items}
              {...grupoProps}
            />
          ))}
        </div>
      )}
    </div>
  );
}
