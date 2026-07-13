import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import CicloInicioCard from '../components/CicloInicioCard';
import { crearVentaConFallback } from '../lib/offlineSync';
import { playError, playSuccess } from '../lib/sounds';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import Modal from '../components/Modal';
import FloatingField from '../components/FloatingField';
import FaltantesList from '../components/FaltantesList';
import { useFaltantes } from '../hooks/useFaltantes';
import { toast } from '../lib/toast';

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cuenta'];

const ATAJOS = [
  ['F1', 'Ayuda'],
  ['F2', 'Buscar producto'],
  ['F3', 'Limpiar venta'],
  ['F4', 'Faltantes'],
  ['F8 / Espacio', 'Cobrar'],
  ['Supr / Delete', 'Quitar último item'],
];

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export default function Caja() {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);
  const [faltantesOpen, setFaltantesOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [cuentaModo, setCuentaModo] = useState('registrado');
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [registrarCliente, setRegistrarCliente] = useState(false);
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [cuentaDuplicado, setCuentaDuplicado] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [cicloAbierto, setCicloAbierto] = useState(null);
  const [cicloLoading, setCicloLoading] = useState(true);
  const searchRef = useRef(null);
  const { list: faltantesList, refresh: refreshFaltantes } = useFaltantes();

  const total = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const addToCart = useCallback((producto, qty = 1) => {
    if (!cicloAbierto) {
      playError();
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.productoId === producto.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          cantidad: next[idx].cantidad + qty,
          stockUi: (producto.stock ?? next[idx].stockUi) - qty,
        };
        return next;
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: Number(producto.precio),
          cantidad: qty,
          stockUi: (producto.stock ?? 0) - qty,
        },
      ];
    });
    playSuccess();
  }, [cicloAbierto]);

  const handleScan = useCallback(
    async (codigo) => {
      if (!cicloAbierto) {
        playError();
        return;
      }
      try {
        const producto = await api.productos.barcode(codigo);
        if (producto) {
          addToCart(producto);
          setSearch('');
          setResults([]);
          return;
        }
      } catch {
        // 404 o offline
      }
      playError();
      setNotFoundCode(codigo);
    },
    [addToCart, cicloAbierto]
  );

  useBarcodeScanner(handleScan);

  useEffect(() => {
    setCicloLoading(true);
    api.ciclos
      .actual()
      .then((data) => setCicloAbierto(data?.estado === 'abierto' ? data : null))
      .catch(() => setCicloAbierto(null))
      .finally(() => setCicloLoading(false));
  }, []);

  useEffect(() => {
    if (!cobroOpen || metodoPago !== 'Cuenta') return;
    api.clientes.list().then((data) => data && setClientes(data)).catch(() => {});
  }, [cobroOpen, metodoPago]);

  useEffect(() => {
    if (metodoPago !== 'Cuenta' || cuentaModo !== 'libre') {
      setCuentaDuplicado('');
      return;
    }
    const nombre = clienteNombre.trim();
    if (!nombre) {
      setCuentaDuplicado('');
      return;
    }
    const t = setTimeout(() => {
      api.clientes
        .verificar(nombre)
        .then((check) => {
          if (!check?.duplicado) {
            setCuentaDuplicado('');
            return;
          }
          if (check.tipo === 'registrado' || check.tipo === 'registrado_inactivo') {
            setCuentaDuplicado(check.mensaje);
          } else if (registrarCliente) {
            setCuentaDuplicado(check.mensaje);
          } else {
            setCuentaDuplicado('');
          }
        })
        .catch(() => setCuentaDuplicado(''));
    }, 300);
    return () => clearTimeout(t);
  }, [metodoPago, cuentaModo, clienteNombre, registrarCliente]);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await api.productos.list(search);
        if (data) setResults(data.slice(0, 15));
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  function clearCart() {
    setCart([]);
    setSelectedIdx(-1);
  }

  function removeItem(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx((prev) => {
      if (prev === idx) return -1;
      if (prev > idx) return prev - 1;
      return prev;
    });
  }

  function removeLast() {
    if (selectedIdx >= 0 && selectedIdx < cart.length) {
      removeItem(selectedIdx);
      return;
    }
    if (cart.length) removeItem(cart.length - 1);
  }

  function resetCobroCuenta() {
    setCuentaModo('registrado');
    setClienteId('');
    setClienteNombre('');
    setRegistrarCliente(false);
    setClienteTelefono('');
    setCuentaDuplicado('');
  }

  async function confirmarVenta() {
    if (!cart.length) return;
    if (!cicloAbierto) {
      toast('Abrí el ciclo del día en Facturación antes de cobrar.', 'warning');
      return;
    }
    if (metodoPago === 'Cuenta') {
      if (!navigator.onLine) {
        toast('Cuenta corriente requiere conexión.', 'warning');
        return;
      }
      if (cuentaModo === 'registrado' && !clienteId) {
        toast('Seleccioná un cliente registrado.', 'warning');
        return;
      }
      if (cuentaModo === 'libre' && !clienteNombre.trim()) {
        toast('Ingresá el nombre de la persona.', 'warning');
        return;
      }
      if (cuentaDuplicado) {
        toast(cuentaDuplicado, 'error');
        return;
      }
    }
    const items = cart.map((c) => ({
      productoId: c.productoId,
      cantidad: c.cantidad,
    }));
    const cuentaData =
      metodoPago === 'Cuenta'
        ? cuentaModo === 'registrado'
          ? { clienteId: Number(clienteId) }
          : {
              clienteNombre: clienteNombre.trim(),
              registrarCliente,
              clienteTelefono: registrarCliente ? clienteTelefono.trim() : undefined,
            }
        : {};
    try {
      const res = await crearVentaConFallback({ items, metodoPago, ...cuentaData });
      playSuccess();
      clearCart();
      setCobroOpen(false);
      resetCobroCuenta();
      if (res?.offline) {
        toast('Venta guardada offline. Se sincronizará al reconectar.', 'warning');
      } else if (metodoPago === 'Cuenta') {
        toast('Anotado en cuenta corriente', 'success');
      } else {
        toast('Venta registrada', 'success');
      }
      api.ciclos.actual().then((data) => {
        if (data?.estado === 'abierto') setCicloAbierto(data);
      }).catch(() => {});
      refreshFaltantes();
    } catch (e) {
      toast(e.message || 'Error al registrar venta', 'error');
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (cobroOpen && e.key === 'Escape') {
        setCobroOpen(false);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setFaltantesOpen(true);
      } else if (e.key === 'F8' || (e.key === ' ' && !cobroOpen && cart.length && cicloAbierto)) {
        if (document.activeElement?.tagName === 'INPUT' && e.key === ' ') return;
        e.preventDefault();
        if (cart.length) setCobroOpen(true);
      } else if (e.key === 'Delete') {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        removeLast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.length, cobroOpen, selectedIdx, cicloAbierto]);

  if (cicloLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-400">Verificando ciclo de facturación...</p>
      </div>
    );
  }

  if (!cicloAbierto) {
    return <CicloInicioCard onCicloAbierto={setCicloAbierto} />;
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Caja</h2>
          <p className="page-subtitle hidden sm:block">F2 buscar · F8 cobrar · Supr quitar</p>
          <p className="page-subtitle sm:hidden">Escaneá o buscá productos</p>
        </div>
        <div className="flex gap-2 lg:hidden">
          <button type="button" onClick={() => setHelpOpen(true)} className="btn-secondary text-xs">
            Ayuda
          </button>
          <button
            type="button"
            onClick={() => setFaltantesOpen(true)}
            className="btn-secondary text-xs"
          >
            Faltantes
          </button>
          {cart.length > 0 && (
            <button type="button" onClick={clearCart} className="btn-secondary text-xs text-red-300">
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
        Ciclo abierto · {cicloAbierto.resumen?.cantidadTickets ?? 0} tickets ·{' '}
        {formatMoney(cicloAbierto.resumen?.totalDia ?? 0)} hoy
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
      <section className="card-panel space-y-4 p-4 sm:p-5">
        <FloatingField
          ref={searchRef}
          label="Buscar por nombre o código (F2)"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-allow-scanner="true"
          size="lg"
          clearable
          inputClassName="!bg-slate-800/95"
        />
        {results.length > 0 && (
          <ul className="max-h-48 overflow-auto rounded-lg border border-slate-700 bg-slate-800">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full justify-between px-3 py-3 text-left transition-colors hover:bg-slate-700 active:bg-slate-600"
                  onClick={() => {
                    addToCart(p);
                    setSearch('');
                    setResults([]);
                  }}
                >
                  <span>{p.nombre}</span>
                  <span className="text-blue-400">{formatMoney(Number(p.precio))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          Escaneá con lector USB o usá la cámara desde Consulta. F1 = ayuda.
        </p>
      </section>

      <section className="card-panel p-4 sm:p-5 lg:sticky lg:top-24 lg:self-start">
        <h2 className="mb-3 text-lg font-semibold">Carrito</h2>
        <ul className="mb-4 max-h-48 space-y-1 overflow-auto sm:max-h-64">
          {cart.map((item, idx) => (
            <li
              key={`${item.productoId}-${idx}`}
              className={`flex items-center gap-1 rounded-lg px-1 py-1.5 sm:py-1 ${
                selectedIdx === idx ? 'bg-blue-900/50' : 'hover:bg-slate-700/80'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 px-2 py-1 text-left sm:min-h-0"
              >
                <span className="truncate">
                  {item.nombre} × {item.cantidad}
                </span>
                <span className="shrink-0">{formatMoney(item.precio * item.cantidad)}</span>
              </button>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                title="Quitar producto (Supr)"
                aria-label={`Quitar ${item.nombre}`}
                className="btn-icon shrink-0 text-sm text-red-400 hover:bg-red-950/50 hover:text-red-300"
              >
                ✕
              </button>
            </li>
          ))}
          {!cart.length && (
            <li className="empty-state border-0 bg-transparent py-4">
              Vacío — escaneá o buscá (F2)
            </li>
          )}
        </ul>
        <div className="hidden items-center justify-between border-t border-slate-600 pt-3 lg:flex">
          <span className="text-2xl font-bold">{formatMoney(total)}</span>
          <button
            type="button"
            disabled={!cart.length || !cicloAbierto}
            onClick={() => setCobroOpen(true)}
            className="btn-success px-6 py-3 disabled:opacity-40 disabled:active:scale-100"
          >
            Cobrar (F8)
          </button>
        </div>
      </section>
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-20 border-t border-slate-700/90 bg-slate-900/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">{cart.length} producto{cart.length !== 1 ? 's' : ''}</p>
              <p className="text-xl font-bold text-green-400">{formatMoney(total)}</p>
            </div>
            <button
              type="button"
              disabled={!cicloAbierto}
              onClick={() => setCobroOpen(true)}
              className="btn-success shrink-0 px-5 py-3 disabled:opacity-40"
            >
              Cobrar
            </button>
          </div>
        </div>
      )}

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Atajos de teclado">
        <ul className="space-y-2">
          {ATAJOS.map(([k, d]) => (
            <li key={k} className="flex justify-between border-b border-slate-700 py-1">
              <kbd className="rounded bg-slate-700 px-2">{k}</kbd>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={faltantesOpen} onClose={() => setFaltantesOpen(false)} title="Faltantes" wide>
        <FaltantesList productos={faltantesList} />
      </Modal>

      <Modal
        open={cobroOpen}
        onClose={() => {
          setCobroOpen(false);
          resetCobroCuenta();
        }}
        title="Confirmar cobro"
      >
        <p className="mb-4 text-center text-3xl font-bold text-green-400 sm:text-left">
          {formatMoney(total)}
        </p>
        <p className="mb-2 text-sm font-medium text-slate-400">Método de pago</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {METODOS_PAGO.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodoPago(m)}
              className={`seg-btn ${
                metodoPago === m
                  ? m === 'Cuenta'
                    ? 'seg-btn-active !bg-amber-600'
                    : 'seg-btn-active'
                  : 'seg-btn-inactive'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {metodoPago === 'Cuenta' && (
          <div className="mb-4 space-y-3 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
            <p className="text-sm text-amber-200">Anotar en cuenta corriente</p>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setCuentaModo('registrado')}
                className={`seg-btn ${
                  cuentaModo === 'registrado' ? 'seg-btn-active !bg-amber-600' : 'seg-btn-inactive'
                }`}
              >
                Registrado
              </button>
              <button
                type="button"
                onClick={() => setCuentaModo('libre')}
                className={`seg-btn ${
                  cuentaModo === 'libre' ? 'seg-btn-active !bg-amber-600' : 'seg-btn-inactive'
                }`}
              >
                Sin registro
              </button>
            </div>

            {cuentaModo === 'registrado' ? (
              <FloatingField
                as="select"
                label="Cliente"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.telefono ? ` (${c.telefono})` : ''}
                  </option>
                ))}
              </FloatingField>
            ) : (
              <>
                <FloatingField
                  label="Nombre"
                  required
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={registrarCliente}
                    onChange={(e) => setRegistrarCliente(e.target.checked)}
                    className="rounded"
                  />
                  Registrar cliente para después
                </label>
                {registrarCliente && (
                  <FloatingField
                    label="Teléfono (opcional)"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                  />
                )}
                {cuentaDuplicado && (
                  <p className="text-sm text-red-400">{cuentaDuplicado}</p>
                )}
                {cuentaModo === 'libre' && !registrarCliente && clienteNombre.trim() && (
                  <p className="text-xs text-slate-500">
                    Si el nombre ya existe sin registro, se suma a esa misma cuenta.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={confirmarVenta}
          disabled={metodoPago === 'Cuenta' && Boolean(cuentaDuplicado)}
          className="btn-success w-full disabled:opacity-40"
        >
          {metodoPago === 'Cuenta' ? 'Anotar en cuenta' : 'Confirmar venta'}
        </button>
      </Modal>

      <Modal
        open={!!notFoundCode}
        onClose={() => setNotFoundCode(null)}
        title="Código no encontrado"
      >
        <p className="mb-3">
          Código <strong>{notFoundCode}</strong> no está en el sistema. ¿Cargar producto?
        </p>
        <Link
          to={`/productos?codigo=${encodeURIComponent(notFoundCode || '')}`}
          onClick={() => setNotFoundCode(null)}
          className="btn-primary inline-block"
        >
          Ir a cargar producto
        </Link>
      </Modal>
    </div>
  );
}
