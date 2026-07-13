import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatFecha, formatHora, formatMoney } from '../lib/negocio';
import { imprimirElemento, pdfResumenCiclo, pdfTicketVenta } from '../lib/pdfFacturacion';
import Modal from '../components/Modal';
import CicloInicioCard from '../components/CicloInicioCard';
import { toast } from '../lib/toast';

export default function Facturacion() {
  const [ciclo, setCiclo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState('');
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [resumenCierre, setResumenCierre] = useState(null);
  const [detalleVenta, setDetalleVenta] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.ciclos.actual();
      setCiclo(data);
    } catch (e) {
      toast(e.message || 'Error al cargar ciclo', 'error');
      setCiclo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function confirmarCierre() {
    if (!ciclo?.id) return;
    setAccion('cerrar');
    try {
      const data = await api.ciclos.cerrar(ciclo.id);
      setResumenCierre(data);
      setCerrarOpen(false);
      setCiclo(null);
      toast('Ciclo cerrado', 'success');
    } catch (e) {
      toast(e.message || 'No se pudo cerrar el ciclo', 'error');
    } finally {
      setAccion('');
    }
  }

  const ventas = ciclo?.ventas ?? [];
  const resumen = ciclo?.resumen;
  const abierto = ciclo?.estado === 'abierto';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Facturación</h2>
          <p className="page-subtitle">Ciclo diario y tickets para el contador</p>
        </div>
        <Link to="/reportes-contables" className="btn-secondary text-sm">
          Reportes →
        </Link>
        <Link to="/cierre-mensual" className="btn-secondary text-sm">
          Cierre mensual →
        </Link>
      </div>

      <section className="card-panel p-4 sm:p-5">
        {loading && <p className="text-sm text-slate-400">Cargando ciclo...</p>}

        {!loading && !abierto && (
          <CicloInicioCard
            onCicloAbierto={(data) => {
              setCiclo(data);
            }}
          />
        )}

        {!loading && ciclo && abierto && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    abierto
                      ? 'bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-700/50'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {abierto ? 'Ciclo abierto' : 'Ciclo cerrado'}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Apertura: {formatFecha(ciclo.fechaApertura)}
                </p>
              </div>
              {abierto && (
                <button
                  type="button"
                  onClick={() => setCerrarOpen(true)}
                  className="btn-secondary text-red-300 hover:bg-red-950/40"
                >
                  Cerrar ciclo
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-800/60 p-3">
                <p className="text-xs text-slate-500">Total parcial</p>
                <p className="text-xl font-bold text-green-400">
                  {formatMoney(resumen?.totalDia ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-3">
                <p className="text-xs text-slate-500">Tickets</p>
                <p className="text-xl font-bold">{resumen?.cantidadTickets ?? 0}</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-3">
                <p className="text-xs text-slate-500">Estado Caja</p>
                <p className="text-sm font-medium text-emerald-300">
                  {abierto ? 'Ventas habilitadas' : 'Bloqueado'}
                </p>
              </div>
            </div>

            {resumen?.porPago && Object.keys(resumen.porPago).length > 0 && (
              <div className="rounded-lg border border-slate-700 p-3">
                <p className="mb-2 text-sm font-medium text-slate-300">Por método de pago</p>
                <ul className="space-y-1 text-sm">
                  {Object.entries(resumen.porPago).map(([metodo, monto]) => (
                    <li key={metodo} className="flex justify-between">
                      <span className="text-slate-400">{metodo}</span>
                      <span>{formatMoney(monto)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {ciclo && (
        <section className="card-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Tickets del ciclo</h3>
            {abierto && (
              <Link to="/" className="btn-primary text-xs">
                Ir a Caja
              </Link>
            )}
          </div>

          {ventas.length === 0 && (
            <p className="empty-state border-0 bg-transparent py-4">
              Sin ventas en este ciclo. Cargá tickets desde Caja.
            </p>
          )}

          <div className="space-y-2">
            {ventas.map((venta, idx) => (
              <article
                key={venta.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    #{String(idx + 1).padStart(3, '0')} · {formatHora(venta.fecha)}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {(venta.detalles || [])
                      .map((d) => `${d.producto?.nombre ?? 'Producto'} ×${d.cantidad}`)
                      .join(', ')}
                  </p>
                  <p className="text-xs text-slate-500">{venta.metodoPago}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold text-green-400">
                    {formatMoney(venta.total)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetalleVenta({ venta, numero: idx + 1 })}
                    className="btn-secondary text-xs"
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => pdfTicketVenta(venta, idx + 1)}
                    className="btn-secondary text-xs"
                  >
                    PDF
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <Modal open={cerrarOpen} onClose={() => setCerrarOpen(false)} title="Cerrar ciclo del día">
        <p className="mb-4 text-sm text-slate-300">
          ¿Cerrás el ciclo del día? Ya no podrás agregar ventas a esta jornada.
        </p>
        <p className="mb-4 text-center text-2xl font-bold text-green-400">
          Total del día: {formatMoney(resumen?.totalDia ?? 0)}
        </p>
        <p className="mb-4 text-center text-sm text-slate-400">
          {resumen?.cantidadTickets ?? 0} ticket(s)
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCerrarOpen(false)} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarCierre}
            disabled={accion === 'cerrar'}
            className="btn-success flex-1"
          >
            {accion === 'cerrar' ? 'Cerrando...' : 'Confirmar cierre'}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!resumenCierre}
        onClose={() => setResumenCierre(null)}
        title="Ciclo cerrado"
        wide
      >
        {resumenCierre && (
          <div id="resumen-ciclo-print" className="space-y-4">
            <p className="text-sm text-slate-400">
              {formatFecha(resumenCierre.fechaApertura, { dateStyle: 'long' })}
            </p>
            <p>
              Apertura: {formatFecha(resumenCierre.fechaApertura)} · Cierre:{' '}
              {formatFecha(resumenCierre.fechaCierre)}
            </p>
            <p className="text-2xl font-bold text-green-400">
              {formatMoney(resumenCierre.resumen?.totalDia ?? resumenCierre.totalDia)}
            </p>
            <p>{resumenCierre.resumen?.cantidadTickets ?? resumenCierre.cantidadTickets} tickets</p>
            <ul className="space-y-1 text-sm">
              {Object.entries(resumenCierre.resumen?.porPago ?? {}).map(([m, t]) => (
                <li key={m} className="flex justify-between">
                  <span>{m}</span>
                  <span>{formatMoney(t)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  pdfResumenCiclo(
                    resumenCierre,
                    resumenCierre.ventas ?? [],
                    resumenCierre.resumen
                  )
                }
                className="btn-primary"
              >
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => imprimirElemento('resumen-ciclo-print')}
                className="btn-secondary"
              >
                Imprimir
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!detalleVenta}
        onClose={() => setDetalleVenta(null)}
        title={
          detalleVenta
            ? `Ticket #${String(detalleVenta.numero).padStart(3, '0')}`
            : 'Detalle'
        }
      >
        {detalleVenta && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">{formatFecha(detalleVenta.venta.fecha)}</p>
            <ul className="divide-y divide-slate-700 text-sm">
              {(detalleVenta.venta.detalles || []).map((d) => (
                <li key={d.id} className="flex justify-between py-2">
                  <span>
                    {d.producto?.nombre ?? `Producto #${d.productoId}`} × {d.cantidad}
                  </span>
                  <span>{formatMoney(d.precioUnit * d.cantidad)}</span>
                </li>
              ))}
            </ul>
            <p className="font-bold text-green-400">
              Total: {formatMoney(detalleVenta.venta.total)}
            </p>
            <button
              type="button"
              onClick={() => pdfTicketVenta(detalleVenta.venta, detalleVenta.numero)}
              className="btn-primary w-full"
            >
              Exportar PDF
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
