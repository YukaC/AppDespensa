import { useCallback, useEffect, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '../lib/api';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import FloatingField from '../components/FloatingField';
export default function IngresoMercaderia() {
  const [pinOk, setPinOk] = useState(
    () => sessionStorage.getItem('ingreso_pin_ok') === '1'
  );
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const buscarCodigo = useCallback(async (codigo) => {
    try {
      const p = await api.productos.barcode(codigo);
      if (p) {
        setProducto(p);
        setMensaje('');
        if (p.fechaVencimiento) {
          setFechaVencimiento(p.fechaVencimiento.slice(0, 10));
        }
        return;
      }
    } catch {
      // ignore
    }
    setMensaje(`Código ${codigo} no encontrado`);
    setProducto(null);
  }, []);

  useBarcodeScanner(buscarCodigo);

  useEffect(() => {
    if (!cameraOn) return;
    const reader = new BrowserMultiFormatReader();
    let active = true;
    reader
      .decodeFromVideoDevice(undefined, 'video-ingreso', (result) => {
        if (result && active) {
          buscarCodigo(result.getText());
          setCameraOn(false);
        }
      })
      .catch(() => setCameraOn(false));
    return () => {
      active = false;
      reader.reset();
    };
  }, [cameraOn, buscarCodigo]);

  async function verificarPin(e) {
    e.preventDefault();
    setPinError('');
    try {
      const res = await api.verifyPin(pin);
      if (res?.ok) {
        sessionStorage.setItem('ingreso_pin_ok', '1');
        sessionStorage.setItem('ingreso_pin_value', pin);
        setPinOk(true);
        setPin('');
      } else {
        setPinError('PIN incorrecto');
      }
    } catch {
      setPinError('Sin conexión para verificar PIN');
    }
  }

  async function confirmar(e) {
    e.preventDefault();
    if (!producto) return;
    const qty = Number(cantidad);
    if (!qty || qty <= 0) {
      setMensaje('Ingresá una cantidad válida');
      return;
    }
    if (!fechaVencimiento) {
      setMensaje('La fecha de vencimiento es obligatoria');
      return;
    }

    const storedPin = sessionStorage.getItem('ingreso_pin_value') || pin;
    setLoading(true);
    setMensaje('');
    try {
      await api.stock.ingreso(
        {
          productoId: producto.id,
          cantidad: qty,
          fechaVencimiento,
        },
        storedPin
      );
      setMensaje(`Ingreso OK: +${qty} a ${producto.nombre}`);
      setProducto(null);
      setCantidad('');
      setFechaVencimiento('');
    } catch (err) {
      if (err.message?.includes('PIN')) {
        sessionStorage.removeItem('ingreso_pin_ok');
        sessionStorage.removeItem('ingreso_pin_value');
        setPinOk(false);
      }
      setMensaje(err.message || 'Error al registrar ingreso');
    } finally {
      setLoading(false);
    }
  }

  if (!pinOk) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col justify-center space-y-5 px-1">
        <div className="text-center">
          <h2 className="page-title">Ingreso de mercadería</h2>
          <p className="page-subtitle">PIN operativo de 4 dígitos</p>
        </div>
        <form onSubmit={verificarPin} className="card-panel space-y-5 p-5">
          <FloatingField
            label="PIN"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputClassName="text-center text-xl tracking-widest"
            autoFocus
          />
          {pinError && <p className="text-sm text-red-400">{pinError}</p>}
          <button
            type="submit"
            className="btn-primary w-full"
          >
            Desbloquear
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h2 className="page-title">Ingreso de depósito</h2>
        <p className="page-subtitle">Escaneá, ingresá cantidad y vencimiento</p>
      </div>

      <button
        type="button"
        onClick={() => setCameraOn((v) => !v)}
        className="btn-secondary w-full text-sm sm:w-auto"
      >
        {cameraOn ? '✕ Cerrar cámara' : '📷 Escanear código'}
      </button>
      {cameraOn && (
        <video id="video-ingreso" className="max-h-48 w-full rounded-lg bg-black" />
      )}
      <p className="text-xs text-slate-500">También podés usar lector USB (escaneá en esta pantalla).</p>

      {producto && (
        <div className="rounded-xl border border-green-800 bg-green-950/30 p-4">
          <p className="font-semibold">{producto.nombre}</p>
          <p className="text-sm text-slate-400">Stock actual: {producto.stock}</p>
        </div>
      )}

      <form onSubmit={confirmar} className="card-panel space-y-5 p-5">
        <FloatingField
          label="Cantidad ingresada"
          required
          type="number"
          min="1"
          inputMode="numeric"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          inputClassName="text-lg"
        />
        <FloatingField
          label="Nueva fecha de vencimiento"
          required
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !producto}
          className="btn-success w-full disabled:opacity-40 disabled:active:scale-100"
        >
          {loading ? 'Guardando...' : 'Confirmar ingreso'}
        </button>
      </form>

      {mensaje && (
        <p
          className={`rounded-lg p-3 text-sm ${
            mensaje.startsWith('Ingreso OK') ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-300'
          }`}
        >
          {mensaje}
        </p>
      )}

    </div>
  );
}
