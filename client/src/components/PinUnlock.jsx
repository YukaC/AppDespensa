import { useState } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import FloatingField from './FloatingField';

export default function PinUnlock({ onUnlock }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.verifyPin(pin);
      if (res?.ok) {
        sessionStorage.setItem('admin_pin_ok', '1');
        onUnlock(true);
        setOpen(false);
        setPin('');
      } else {
        setError('PIN incorrecto');
      }
    } catch {
      setError('No se pudo verificar (sin conexión)');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 underline hover:text-slate-300"
      >
        Ingresar PIN
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Modo empleado">
        <form onSubmit={submit} className="space-y-5">
          <FloatingField
            label="PIN"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full"
          >
            Ingresar
          </button>
        </form>
      </Modal>
    </>
  );
}
