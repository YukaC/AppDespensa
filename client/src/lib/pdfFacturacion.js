import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  NEGOCIO,
  formatFecha,
  formatHora,
  formatMesAnio,
  formatMoney,
  MESES,
} from './negocio';

function addHeader(doc, titulo) {
  doc.setFontSize(16);
  doc.text(NEGOCIO.nombre, 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(titulo, 14, 26);
  doc.setTextColor(0);
}

function addPorPago(doc, porPago, startY) {
  let y = startY;
  doc.setFontSize(10);
  doc.text('Subtotales por método de pago:', 14, y);
  y += 6;
  for (const [metodo, monto] of Object.entries(porPago || {})) {
    doc.text(`${metodo}: ${formatMoney(monto)}`, 18, y);
    y += 5;
  }
  return y + 4;
}

export function pdfTicketVenta(venta, numeroDia) {
  const doc = new jsPDF();
  addHeader(doc, `Venta #${String(numeroDia).padStart(3, '0')}`);

  doc.setFontSize(10);
  let y = 34;
  doc.text(`Fecha: ${formatFecha(venta.fecha)}`, 14, y);
  y += 6;
  doc.text(`Método de pago: ${venta.metodoPago}`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Cant.', 'P. unit.', 'Total']],
    body: (venta.detalles || []).map((d) => [
      d.producto?.nombre ?? `Producto #${d.productoId}`,
      String(d.cantidad),
      formatMoney(d.precioUnit),
      formatMoney(d.precioUnit * d.cantidad),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(12);
  doc.text(`Total: ${formatMoney(venta.total)}`, 14, y);
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(NEGOCIO.leyendaTicket, 14, y, { maxWidth: 180 });

  doc.save(`ticket-venta-${venta.id}.pdf`);
}

export function pdfResumenCiclo(ciclo, ventas, resumen) {
  const doc = new jsPDF();
  const fechaJornada = formatFecha(ciclo.fechaApertura, { dateStyle: 'long' });
  addHeader(doc, `Resumen del día — ${fechaJornada}`);

  doc.setFontSize(10);
  let y = 34;
  doc.text(`Apertura: ${formatFecha(ciclo.fechaApertura)}`, 14, y);
  y += 5;
  if (ciclo.fechaCierre) {
    doc.text(`Cierre: ${formatFecha(ciclo.fechaCierre)}`, 14, y);
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Hora', 'Detalle', 'Pago', 'Total']],
    body: ventas.map((v, i) => {
      const detalle = (v.detalles || [])
        .map((d) => `${d.producto?.nombre ?? 'Producto'} ×${d.cantidad}`)
        .join(', ');
      return [
        String(i + 1).padStart(3, '0'),
        formatHora(v.fecha),
        detalle,
        v.metodoPago,
        formatMoney(v.total),
      ];
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 2: { cellWidth: 70 } },
  });

  y = doc.lastAutoTable.finalY + 6;
  y = addPorPago(doc, resumen?.porPago, y);

  doc.setFontSize(14);
  doc.text(`Total del día: ${formatMoney(resumen?.totalDia ?? ciclo.totalDia ?? 0)}`, 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Operaciones: ${resumen?.cantidadTickets ?? ciclo.cantidadTickets ?? 0}`, 14, y);
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(NEGOCIO.leyendaResumen, 14, y, { maxWidth: 180 });

  const slug = ciclo.fechaApertura?.slice(0, 10) ?? ciclo.id;
  doc.save(`resumen-dia-${slug}.pdf`);
}

function addTicketsDetalleToPdf(doc, ventas, startY) {
  if (!ventas?.length) return startY;

  let y = startY + 4;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text('Detalle de tickets', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Ticket', 'Fecha', 'Hora', 'Detalle', 'Pago', 'Total']],
    body: ventas.map((v) => {
      const detalle = (v.detalles || [])
        .map((d) => `${d.producto ?? 'Producto'} ×${d.cantidad}`)
        .join(', ');
      return [
        `#${v.id}`,
        formatFecha(v.fecha, { dateStyle: 'short' }),
        formatHora(v.fecha),
        detalle,
        v.metodoPago,
        formatMoney(v.total),
      ];
    }),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 3: { cellWidth: 58 } },
  });

  return doc.lastAutoTable.finalY + 8;
}

function buildResumenPeriodoPdf(doc, titulo, data, totalLabel, totalValue, options = {}) {
  addHeader(doc, titulo);

  doc.setFontSize(10);
  let y = 34;
  doc.text(`${totalLabel}: ${formatMoney(totalValue)}`, 14, y);
  y += 5;
  doc.text(`Jornadas cerradas: ${data.jornadas}`, 14, y);
  y += 5;
  doc.text(`Tickets registrados: ${data.cantidadTickets}`, 14, y);
  y += 8;

  y = addPorPago(doc, data.porPago, y);

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Total del día', 'Tickets']],
    body: (data.porDia || []).map((d) => [
      formatFecha(d.fecha, { dateStyle: 'short' }),
      formatMoney(d.total),
      String(d.tickets),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = doc.lastAutoTable.finalY + 6;

  if (options.incluirTickets) {
    y = addTicketsDetalleToPdf(doc, data.ventas, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(NEGOCIO.leyendaResumen, 14, y, { maxWidth: 180 });
}

export function pdfResumenMensual(data, options = {}) {
  const doc = new jsPDF();
  buildResumenPeriodoPdf(
    doc,
    `Resumen mensual — ${formatMesAnio(data.anio, data.mes)}`,
    data,
    'Total del mes',
    data.totalMes,
    options
  );
  doc.save(`resumen-mensual-${data.anio}-${String(data.mes).padStart(2, '0')}.pdf`);
}

export function pdfResumenSemanal(data, options = {}) {
  const doc = new jsPDF();
  const titulo =
    data.periodoInicio && data.periodoFin
      ? `Resumen semanal — ${formatFecha(data.periodoInicio, { dateStyle: 'short' })} al ${formatFecha(data.periodoFin, { dateStyle: 'short' })}`
      : `Resumen semanal — semana ${data.semana} · ${data.anio}`;
  buildResumenPeriodoPdf(
    doc,
    titulo,
    data,
    'Total de la semana',
    data.totalSemana,
    options
  );
  doc.save(`resumen-semanal-${data.anio}-W${String(data.semana).padStart(2, '0')}.pdf`);
}

export function pdfResumenAnual(data) {
  const doc = new jsPDF();
  addHeader(doc, `Resumen anual — ${data.anio}`);

  doc.setFontSize(10);
  let y = 34;
  doc.text(`Total anual: ${formatMoney(data.totalAnual)}`, 14, y);
  y += 5;
  doc.text(`Jornadas: ${data.jornadas} · Tickets: ${data.cantidadTickets}`, 14, y);
  y += 8;

  if (data.mesMayor && data.mesMenor) {
    doc.text(
      `Mayor facturación: ${MESES[data.mesMayor.mes - 1]} (${formatMoney(data.mesMayor.total)})`,
      14,
      y
    );
    y += 5;
    doc.text(
      `Menor facturación: ${MESES[data.mesMenor.mes - 1]} (${formatMoney(data.mesMenor.total)})`,
      14,
      y
    );
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [['Mes', 'Total', 'Ventas', 'Jornadas']],
    body: (data.porMes || []).map((m) => [
      MESES[m.mes - 1],
      formatMoney(m.total),
      String(m.ventas),
      String(m.jornadas),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(NEGOCIO.leyendaResumen, 14, y, { maxWidth: 180 });

  doc.save(`resumen-anual-${data.anio}.pdf`);
}

export function imprimirElemento(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html><head>
      <title>Imprimir</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 1rem; color: #111; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 12px; }
        th { background: #f3f4f6; }
        .total { font-size: 1.25rem; font-weight: bold; margin-top: 1rem; }
        .leyenda { font-size: 10px; color: #666; margin-top: 1.5rem; }
      </style>
    </head><body>${el.innerHTML}</body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
