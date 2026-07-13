import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  currentISOWeekValue,
  formatFecha,
  formatMesAnio,
  formatMoney,
  formatSemanaIso,
  MESES,
} from '../lib/negocio';
import {
  imprimirElemento,
  pdfResumenAnual,
  pdfResumenMensual,
  pdfResumenSemanal,
} from '../lib/pdfFacturacion';
import DetalleTicketsTabla from '../components/DetalleTicketsTabla';
import FloatingField from '../components/FloatingField';
import Modal from '../components/Modal';
import { toast } from '../lib/toast';

const METODOS_PAGO = ['', 'Efectivo', 'Transferencia', 'Tarjeta', 'Cuenta'];
const now = new Date();

function ResumenPeriodoBody({
  titulo,
  totalLabel,
  total,
  data,
  printId,
  incluirTicketsPrint,
  onExportPdf,
  onExportPrint,
}) {
  return (
    <div id={printId} className="space-y-4">
      <h3 className="text-lg font-semibold">{titulo}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">{totalLabel}</p>
          <p className="text-xl font-bold text-green-400">{formatMoney(total)}</p>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Jornadas</p>
          <p className="text-xl font-bold">{data.jornadas}</p>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Tickets</p>
          <p className="text-xl font-bold">{data.cantidadTickets}</p>
        </div>
      </div>

      {Object.keys(data.porPago || {}).length > 0 && (
        <ul className="space-y-1 text-sm">
          {Object.entries(data.porPago).map(([m, t]) => (
            <li key={m} className="flex justify-between border-b border-slate-700/60 py-1">
              <span className="text-slate-400">{m}</span>
              <span>{formatMoney(t)}</span>
            </li>
          ))}
        </ul>
      )}

      {data.porDia?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-slate-400">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {data.porDia.map((d, i) => (
                <tr key={i} className="border-b border-slate-700/50">
                  <td className="py-2 pr-3">{formatFecha(d.fecha, { dateStyle: 'short' })}</td>
                  <td className="py-2 pr-3">{formatMoney(d.total)}</td>
                  <td className="py-2">{d.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {incluirTicketsPrint && (
        <DetalleTicketsTabla ventas={data.ventas} className="border-t border-slate-700 pt-4" />
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExportPdf} className="btn-primary">
          Exportar PDF
        </button>
        <button type="button" onClick={onExportPrint} className="btn-secondary">
          Imprimir
        </button>
      </div>
    </div>
  );
}

export default function ReportesContables() {
  const [vista, setVista] = useState('mensual');
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [semanaIso, setSemanaIso] = useState(currentISOWeekValue());
  const [dataMensual, setDataMensual] = useState(null);
  const [dataSemanal, setDataSemanal] = useState(null);
  const [dataAnual, setDataAnual] = useState(null);
  const [dataRango, setDataRango] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportAsk, setExportAsk] = useState(null);
  const [incluirTicketsPrint, setIncluirTicketsPrint] = useState(false);

  useEffect(() => {
    setIncluirTicketsPrint(false);
  }, [vista, mes, semanaIso, anio]);

  useEffect(() => {
    if (vista !== 'mensual') return;
    setLoading(true);
    api.reportes
      .contablesMensual(anio, mes)
      .then(setDataMensual)
      .catch((e) => toast(e.message || 'Error al cargar reporte', 'error'))
      .finally(() => setLoading(false));
  }, [vista, anio, mes]);

  useEffect(() => {
    if (vista !== 'semanal') return;
    setLoading(true);
    api.reportes
      .contablesSemanal(semanaIso)
      .then(setDataSemanal)
      .catch((e) => toast(e.message || 'Error al cargar reporte', 'error'))
      .finally(() => setLoading(false));
  }, [vista, semanaIso]);

  useEffect(() => {
    if (vista !== 'anual') return;
    setLoading(true);
    api.reportes
      .contablesAnual(anio)
      .then(setDataAnual)
      .catch((e) => toast(e.message || 'Error al cargar reporte', 'error'))
      .finally(() => setLoading(false));
  }, [vista, anio]);

  async function buscarRango() {
    if (!desde || !hasta) {
      toast('Indicá fecha desde y hasta', 'warning');
      return;
    }
    setLoading(true);
    try {
      const params = { desde, hasta };
      if (metodoPago) params.metodoPago = metodoPago;
      if (buscar.trim()) params.q = buscar.trim();
      const data = await api.reportes.contablesRango(params);
      setDataRango(data);
    } catch (e) {
      toast(e.message || 'Error en búsqueda', 'error');
    } finally {
      setLoading(false);
    }
  }

  function pedirExport(modo, targetVista) {
    setExportAsk({ modo, vista: targetVista });
  }

  function confirmarExport(conDetalle) {
    if (!exportAsk) return;
    const { modo, vista: targetVista } = exportAsk;

    if (targetVista === 'mensual' && dataMensual) {
      if (modo === 'pdf') {
        pdfResumenMensual(dataMensual, { incluirTickets: conDetalle });
      } else {
        setIncluirTicketsPrint(conDetalle);
        requestAnimationFrame(() => imprimirElemento('reporte-mensual-print'));
      }
    }

    if (targetVista === 'semanal' && dataSemanal) {
      if (modo === 'pdf') {
        pdfResumenSemanal(dataSemanal, { incluirTickets: conDetalle });
      } else {
        setIncluirTicketsPrint(conDetalle);
        requestAnimationFrame(() => imprimirElemento('reporte-semanal-print'));
      }
    }

    setExportAsk(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Reportes contables</h2>
        <p className="page-subtitle">Resúmenes semanales, mensuales, anuales y búsqueda</p>
        <Link to="/cierre-mensual" className="mt-2 inline-block text-sm text-blue-400 underline">
          Cierre mensual: backups y archivado de cuentas →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['semanal', 'Semanal'],
          ['mensual', 'Mensual'],
          ['anual', 'Anual'],
          ['rango', 'Por rango'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={`seg-btn ${vista === id ? 'seg-btn-active' : 'seg-btn-inactive'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'semanal' && (
        <section className="card-panel space-y-4 p-4 sm:p-5">
          <FloatingField
            label="Semana"
            type="week"
            value={semanaIso}
            onChange={(e) => setSemanaIso(e.target.value)}
          />
          {loading && <p className="text-sm text-slate-400">Cargando...</p>}
          {dataSemanal && !loading && (
            <ResumenPeriodoBody
              titulo={formatSemanaIso(semanaIso)}
              totalLabel="Total de la semana"
              total={dataSemanal.totalSemana}
              data={dataSemanal}
              printId="reporte-semanal-print"
              incluirTicketsPrint={incluirTicketsPrint}
              onExportPdf={() => pedirExport('pdf', 'semanal')}
              onExportPrint={() => pedirExport('print', 'semanal')}
            />
          )}
        </section>
      )}

      {vista === 'mensual' && (
        <section className="card-panel space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingField
              label="Año"
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
            />
            <FloatingField
              as="select"
              label="Mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i + 1}>
                  {nombre}
                </option>
              ))}
            </FloatingField>
          </div>

          {loading && <p className="text-sm text-slate-400">Cargando...</p>}

          {dataMensual && !loading && (
            <ResumenPeriodoBody
              titulo={formatMesAnio(anio, mes)}
              totalLabel="Total del mes"
              total={dataMensual.totalMes}
              data={dataMensual}
              printId="reporte-mensual-print"
              incluirTicketsPrint={incluirTicketsPrint}
              onExportPdf={() => pedirExport('pdf', 'mensual')}
              onExportPrint={() => pedirExport('print', 'mensual')}
            />
          )}
        </section>
      )}

      {vista === 'anual' && (
        <section className="card-panel space-y-4 p-4 sm:p-5">
          <FloatingField
            label="Año"
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          />

          {loading && <p className="text-sm text-slate-400">Cargando...</p>}

          {dataAnual && !loading && (
            <div id="reporte-anual-print" className="space-y-4">
              <h3 className="text-lg font-semibold">Año {anio}</h3>
              <p className="text-2xl font-bold text-green-400">
                {formatMoney(dataAnual.totalAnual)}
              </p>
              {dataAnual.mesMayor && dataAnual.mesMenor && (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p className="rounded-lg bg-emerald-950/30 p-2 text-emerald-300">
                    Mayor: {MESES[dataAnual.mesMayor.mes - 1]} —{' '}
                    {formatMoney(dataAnual.mesMayor.total)}
                  </p>
                  <p className="rounded-lg bg-slate-800/60 p-2 text-slate-300">
                    Menor: {MESES[dataAnual.mesMenor.mes - 1]} —{' '}
                    {formatMoney(dataAnual.mesMenor.total)}
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-600 text-slate-400">
                      <th className="py-2 pr-3">Mes</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Ventas</th>
                      <th className="py-2">Jornadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dataAnual.porMes || []).map((m) => (
                      <tr key={m.mes} className="border-b border-slate-700/50">
                        <td className="py-2 pr-3">{MESES[m.mes - 1]}</td>
                        <td className="py-2 pr-3">{formatMoney(m.total)}</td>
                        <td className="py-2 pr-3">{m.ventas}</td>
                        <td className="py-2">{m.jornadas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => pdfResumenAnual(dataAnual)}
                  className="btn-primary"
                >
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={() => imprimirElemento('reporte-anual-print')}
                  className="btn-secondary"
                >
                  Imprimir
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {vista === 'rango' && (
        <section className="card-panel space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingField
              label="Desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
            <FloatingField
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
            <FloatingField
              as="select"
              label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="">Todos</option>
              {METODOS_PAGO.filter(Boolean).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </FloatingField>
            <FloatingField
              label="Buscar producto o monto"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </div>
          <button type="button" onClick={buscarRango} disabled={loading} className="btn-primary">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>

          {dataRango && (
            <div className="space-y-3 pt-2">
              <p className="text-lg font-semibold text-green-400">
                {formatMoney(dataRango.total)} · {dataRango.cantidadTickets} tickets
              </p>
              <div className="max-h-96 space-y-2 overflow-auto">
                {(dataRango.ventas || []).map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm"
                  >
                    <div className="flex justify-between">
                      <span>{formatFecha(v.fecha)}</span>
                      <span className="font-medium">{formatMoney(v.total)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {v.metodoPago} ·{' '}
                      {(v.detalles || []).map((d) => d.producto).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <Modal
        open={!!exportAsk}
        onClose={() => setExportAsk(null)}
        title="Exportar resumen"
      >
        <p className="text-sm text-slate-300">
          ¿Querés incluir el detalle de cada ticket en el mismo{' '}
          {exportAsk?.modo === 'pdf' ? 'PDF' : 'documento impreso'}?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => confirmarExport(false)}
            className="btn-secondary flex-1"
          >
            Solo resumen
          </button>
          <button
            type="button"
            onClick={() => confirmarExport(true)}
            className="btn-primary flex-1"
          >
            Con detalle de tickets
          </button>
        </div>
      </Modal>
    </div>
  );
}
