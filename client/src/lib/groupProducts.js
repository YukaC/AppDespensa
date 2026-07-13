export function proveedorNombre(p) {
  return p.proveedorNombre || p.proveedor?.nombre || 'Sin proveedor';
}

export function isFaltante(p) {
  const stock = Number(p.stock ?? 0);
  const minimo = Number(p.stockMinimo ?? 0);
  return stock <= minimo;
}

function sortByStockAsc(a, b) {
  const diff = Number(a.stock ?? 0) - Number(b.stock ?? 0);
  if (diff !== 0) return diff;
  return (a.nombre || '').localeCompare(b.nombre || '', 'es');
}

/** Agrupa por proveedor (A→Z) y ordena ítems por stock de menor a mayor. */
function buildGroups(productos) {
  const groups = new Map();
  for (const p of productos || []) {
    const key = proveedorNombre(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([proveedor, items]) => [proveedor, [...items].sort(sortByStockAsc)]);
}

/** Listado único: proveedor alfabético, stock ascendente dentro del grupo. */
export function groupByProveedor(productos) {
  return buildGroups(productos);
}

/**
 * Faltantes primero (misma regla de orden), después el resto.
 * Para listados de stock / consulta.
 */
export function organizeProductosConAlertas(productos) {
  const faltantes = [];
  const regulares = [];
  for (const p of productos || []) {
    if (isFaltante(p)) faltantes.push(p);
    else regulares.push(p);
  }
  return {
    alertas: buildGroups(faltantes),
    regulares: buildGroups(regulares),
  };
}
