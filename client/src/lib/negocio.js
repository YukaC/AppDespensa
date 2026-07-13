export const NEGOCIO = {
  nombre: 'Autoservicio FALL',
  leyendaTicket: 'Este documento no reemplaza la factura electrónica oficial',
  leyendaResumen: 'Resumen interno para archivo contable · No válido como comprobante fiscal',
};

export function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function formatFecha(iso, opts = { dateStyle: 'short', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat('es-AR', opts).format(new Date(iso));
}

export function formatHora(iso) {
  return new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' }).format(new Date(iso));
}

export function currentISOWeekValue(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function formatSemanaIso(semanaIso) {
  const [y, w] = String(semanaIso).split('-W');
  return `Semana ${Number(w)} · ${y}`;
}

export function formatMesAnio(anio, mes) {
  const d = new Date(anio, mes - 1, 1);
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d);
}

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
