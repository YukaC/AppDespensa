export function daysUntilExpiry(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const end = new Date(fechaVencimiento);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / 86400000);
}

export function formatVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  return new Date(fechaVencimiento).toLocaleDateString('es-AR');
}

export function vencimientoClass(fechaVencimiento) {
  const days = daysUntilExpiry(fechaVencimiento);
  if (days === null) return 'text-slate-500';
  if (days < 15) return 'text-red-400 font-medium';
  return 'text-amber-400/90';
}
