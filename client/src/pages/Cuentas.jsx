import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import FloatingField from '../components/FloatingField';
import Modal from '../components/Modal';
import { SkeletonList } from '../components/Skeleton';
import { toast } from '../lib/toast';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function cuentaKey(c) {
  return `${c.clienteId ?? 'libre'}-${c.clienteNombre}`;
}

async function recargarDetalle(cuenta) {
  if (cuenta.registrado) {
    const data = await api.clientes.get(cuenta.clienteId);
    return data ? { ...data, registrado: true } : null;
  }
  const data = await api.clientes.getPorNombre(cuenta.clienteNombre);
  return data || null;
}

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [cuentaAbierta, setCuentaAbierta] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoNotas, setPagoNotas] = useState('');
  const [pagoError, setPagoError] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoError, setNuevoError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function cargarResumen() {
    setLoading(true);
    setError('');
    try {
      const data = await api.clientes.resumen();
      if (data === null) {
        setError('Sin conexión al servidor. Ejecutá npm run dev:server (o npm run dev).');
        setCuentas([]);
        return;
      }
      setCuentas(data || []);
    } catch (e) {
      setError(
        e.message?.includes('fetch') || e.message?.includes('Failed')
          ? 'Servidor no disponible. Ejecutá npm run dev:server en otra terminal (o npm run dev).'
          : e.message || 'Error al cargar cuentas'
      );
      setCuentas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  useEffect(() => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setNuevoError('');
      return;
    }
    const t = setTimeout(() => {
      api.clientes
        .verificar(nombre)
        .then((check) => {
          if (check?.duplicado) setNuevoError(check.mensaje);
          else setNuevoError('');
        })
        .catch(() => setNuevoError(''));
    }, 300);
    return () => clearTimeout(t);
  }, [nuevoNombre]);

  async function refrescarAbierta() {
    if (!cuentaAbierta) return;
    setLoadingDetalle(true);
    try {
      const data = await recargarDetalle(cuentaAbierta);
      setDetalle(data);
      if (!data) {
        setExpandedKey(null);
        setCuentaAbierta(null);
      }
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function toggleCuenta(cuenta) {
    const key = cuentaKey(cuenta);
    if (expandedKey === key) {
      setExpandedKey(null);
      setCuentaAbierta(null);
      setDetalle(null);
      return;
    }

    setExpandedKey(key);
    setCuentaAbierta(cuenta);
    setDetalle(null);
    setLoadingDetalle(true);
    try {
      const data = await recargarDetalle(cuenta);
      setDetalle(data);
    } catch {
      setDetalle(null);
    } finally {
      setLoadingDetalle(false);
    }
  }

  function abrirPago() {
    setPagoError('');
    setPagoMonto('');
    setPagoNotas('');
    setPagoOpen(true);
  }

  async function registrarPago(e) {
    e.preventDefault();
    const monto = Number(pagoMonto);
    if (!detalle) return;
    if (!monto || monto <= 0) {
      setPagoError('Ingresá un monto válido.');
      return;
    }
    if (monto > detalle.saldo) {
      setPagoError(
        `No podés cobrar más que la deuda (${formatMoney(detalle.saldo)}). No se permite saldo a favor.`
      );
      return;
    }
    setPagoError('');
    try {
      const res = detalle.registrado
        ? await api.clientes.pago(detalle.id, { monto, notas: pagoNotas })
        : await api.clientes.pagoLibre({
            clienteNombre: detalle.clienteNombre,
            monto,
            notas: pagoNotas,
          });
      setPagoOpen(false);
      setPagoMonto('');
      setPagoNotas('');
      toast(res?.mensaje || 'Cobro registrado', 'success');
      if (res?.mensaje) setAviso(res.mensaje);
      await cargarResumen();
      await refrescarAbierta();
    } catch (err) {
      setPagoError(err.message || 'Error al registrar pago');
    }
  }

  async function anularTicket(mov) {
    if (!mov.ventaId) return;
    if (
      !confirm(
        `¿Anular ticket #${mov.ventaId} por ${formatMoney(mov.monto)}? Se restaurará el stock.`
      )
    ) {
      return;
    }
    try {
      const res = await api.clientes.anularTicket(mov.id);
      if (res?.mensaje) setAviso(res.mensaje);
      await cargarResumen();
      await refrescarAbierta();
    } catch (err) {
      toast(err.message || 'Error al anular ticket', 'error');
    }
  }

  async function eliminarCuenta() {
    if (!detalle || !cuentaAbierta) return;
    if (detalle.saldo > 0) {
      toast('No se puede eliminar una cuenta con deuda pendiente.', 'warning');
      return;
    }
    const nombre = detalle.nombre ?? detalle.clienteNombre;
    if (!confirm(`¿Eliminar la cuenta de ${nombre}?`)) return;
    try {
      if (detalle.registrado) {
        await api.clientes.delete(detalle.id);
      } else {
        await api.clientes.deleteLibre(detalle.clienteNombre);
      }
      setAviso(`Cuenta de ${nombre} eliminada`);
      setExpandedKey(null);
      setCuentaAbierta(null);
      setDetalle(null);
      await cargarResumen();
    } catch (err) {
      toast(err.message || 'Error al eliminar cuenta', 'error');
    }
  }

  async function crearCliente(e) {
    e.preventDefault();
    if (!nuevoNombre.trim() || nuevoError) return;
    try {
      await api.clientes.create({
        nombre: nuevoNombre.trim(),
        telefono: nuevoTelefono.trim() || undefined,
      });
      setNuevoOpen(false);
      setNuevoNombre('');
      setNuevoTelefono('');
      setNuevoError('');
      toast('Cliente creado', 'success');
      await cargarResumen();
    } catch (err) {
      setNuevoError(err.message || 'Error al crear cliente');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Cuentas corrientes</h2>
          <p className="page-subtitle">Deudas, tickets y cobros</p>
        </div>
        <button type="button" onClick={() => setNuevoOpen(true)} className="btn-primary text-sm">
          + Cliente
        </button>
      </div>

      {aviso && (
        <p className="rounded-lg border border-green-800/50 bg-green-950/30 p-3 text-sm text-green-300">
          {aviso}
          <button
            type="button"
            onClick={() => setAviso('')}
            className="ml-3 text-xs underline opacity-70"
          >
            Cerrar
          </button>
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && <SkeletonList rows={4} />}

      {!loading && !error && cuentas.length === 0 && (
        <p className="empty-state">No hay clientes ni cuentas con movimientos.</p>
      )}

      <div className="space-y-2">
        {cuentas.map((c) => {
          const key = cuentaKey(c);
          const abierta = expandedKey === key;

          return (
            <article
              key={key}
              className={`card-panel overflow-hidden transition-colors ${
                abierta ? 'ring-1 ring-amber-700/40' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggleCuenta(c)}
                className={`flex w-full items-center justify-between gap-3 p-4 text-left transition-colors ${
                  abierta ? 'bg-slate-800/60' : 'hover:bg-slate-800/80'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 text-slate-500 transition-transform duration-200 ${
                      abierta ? 'rotate-90' : ''
                    }`}
                    aria-hidden
                  >
                    ▸
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.clienteNombre}</p>
                    <p className="text-xs text-slate-500">
                      {c.registrado ? 'Registrado' : 'Sin registro'}
                      {c.telefono ? ` · ${c.telefono}` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-lg font-bold ${
                    c.saldo > 0 ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  {formatMoney(c.saldo)}
                </span>
              </button>

              {abierta && (
                <div className="border-t border-slate-700/80 bg-slate-900/40 px-4 py-3">
                  {loadingDetalle && (
                    <p className="py-2 text-sm text-slate-500">Cargando movimientos...</p>
                  )}

                  {!loadingDetalle && detalle && (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-slate-400">
                          Saldo:{' '}
                          <span
                            className={
                              detalle.saldo > 0 ? 'font-semibold text-amber-400' : 'text-slate-300'
                            }
                          >
                            {formatMoney(detalle.saldo)}
                          </span>
                        </p>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                          <button
                            type="button"
                            onClick={abrirPago}
                            disabled={detalle.saldo <= 0}
                            className="btn-success w-full text-sm disabled:opacity-40 sm:w-auto"
                          >
                            Registrar cobro
                          </button>
                          <button
                            type="button"
                            onClick={eliminarCuenta}
                            disabled={detalle.saldo > 0}
                            className="text-xs text-red-400 underline hover:text-red-300 disabled:opacity-40 disabled:no-underline"
                          >
                            Eliminar cuenta
                          </button>
                        </div>
                      </div>

                      {detalle.movimientos?.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {detalle.movimientos.map((m) => (
                            <li
                              key={m.id}
                              className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3"
                            >
                              <div className="flex justify-between gap-3">
                                <div className="min-w-0">
                                  <span
                                    className={
                                      m.tipo === 'CARGO' ? 'text-red-300' : 'text-green-300'
                                    }
                                  >
                                    {m.tipo === 'CARGO' ? 'Ticket' : 'Pago'}
                                  </span>
                                  {m.ventaId && (
                                    <span className="ml-2 font-medium text-slate-200">
                                      #{m.ventaId}
                                    </span>
                                  )}
                                  <span className="ml-2 text-slate-500">
                                    {formatFecha(m.fecha)}
                                  </span>
                                  {m.notas && (
                                    <p className="text-xs text-slate-500">{m.notas}</p>
                                  )}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="font-medium">{formatMoney(m.monto)}</span>
                                  {m.tipo === 'CARGO' && m.ventaId && (
                                    <button
                                      type="button"
                                      onClick={() => anularTicket(m)}
                                      className="text-xs text-red-400 underline hover:text-red-300"
                                    >
                                      Anular ticket
                                    </button>
                                  )}
                                </div>
                              </div>
                              {m.tipo === 'CARGO' && m.venta?.detalles?.length > 0 && (
                                <ul className="mt-2 space-y-0.5 border-t border-slate-700/50 pt-2 text-xs text-slate-400">
                                  {m.venta.detalles.map((d) => (
                                    <li key={d.id} className="flex justify-between gap-2">
                                      <span className="truncate">
                                        {d.producto?.nombre ?? `Producto #${d.productoId}`} ×{' '}
                                        {d.cantidad}
                                      </span>
                                      <span className="shrink-0">
                                        {formatMoney(d.precioUnit * d.cantidad)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-2 text-sm text-slate-500">Sin movimientos aún.</p>
                      )}
                    </>
                  )}

                  {!loadingDetalle && !detalle && (
                    <p className="py-2 text-sm text-red-400">No se pudo cargar el detalle.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <Modal
        open={pagoOpen}
        onClose={() => {
          setPagoOpen(false);
          setPagoError('');
        }}
        title="Registrar cobro"
      >
        <form onSubmit={registrarPago} className="space-y-4">
          {detalle && (
            <div className="space-y-2 text-sm text-slate-400">
              <p>
                Cliente:{' '}
                <span className="text-slate-200">
                  {detalle.nombre ?? detalle.clienteNombre}
                </span>
                {' · '}
                Deuda: <span className="text-amber-400">{formatMoney(detalle.saldo)}</span>
              </p>
              <button
                type="button"
                onClick={() => setPagoMonto(String(detalle.saldo))}
                className="btn-secondary w-full text-xs sm:w-auto"
              >
                Cobrar deuda completa ({formatMoney(detalle.saldo)})
              </button>
              <p className="text-xs text-slate-500">
                El cobro se registra en la cuenta. Las ventas siguen en facturación y cierre del
                día.
              </p>
            </div>
          )}
          <FloatingField
            label="Monto cobrado"
            type="number"
            step="0.01"
            min="0.01"
            max={detalle?.saldo > 0 ? detalle.saldo : undefined}
            required
            value={pagoMonto}
            onChange={(e) => {
              setPagoMonto(e.target.value);
              setPagoError('');
            }}
          />
          {detalle?.saldo > 0 && (
            <p className="text-xs text-slate-500">
              Máximo: {formatMoney(detalle.saldo)} (no se permite saldo a favor)
            </p>
          )}
          {pagoError && <p className="text-sm text-red-400">{pagoError}</p>}
          <FloatingField
            label="Notas (opcional)"
            value={pagoNotas}
            onChange={(e) => setPagoNotas(e.target.value)}
          />
          <button type="submit" className="btn-success w-full">
            Confirmar cobro
          </button>
        </form>
      </Modal>

      <Modal
        open={nuevoOpen}
        onClose={() => {
          setNuevoOpen(false);
          setNuevoError('');
        }}
        title="Nuevo cliente"
      >
        <form onSubmit={crearCliente} className="space-y-4">
          <FloatingField
            label="Nombre"
            required
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
          />
          {nuevoError && <p className="text-sm text-red-400">{nuevoError}</p>}
          <FloatingField
            label="Teléfono (opcional)"
            value={nuevoTelefono}
            onChange={(e) => setNuevoTelefono(e.target.value)}
          />
          <button
            type="submit"
            disabled={Boolean(nuevoError)}
            className="btn-primary w-full disabled:opacity-40"
          >
            Guardar cliente
          </button>
        </form>
      </Modal>
    </div>
  );
}
