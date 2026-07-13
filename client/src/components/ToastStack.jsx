import { useEffect, useState } from 'react';
import { subscribeToast } from '../lib/toast';

const STYLES = {
  success: 'border-green-700/60 bg-green-950/90 text-green-100',
  error: 'border-red-700/60 bg-red-950/90 text-red-100',
  warning: 'border-amber-700/60 bg-amber-950/90 text-amber-100',
  info: 'border-slate-600/80 bg-slate-800/95 text-slate-100',
};

export default function ToastStack() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToast((item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, item.duration);
    });
  }, []);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-item pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/40 backdrop-blur-sm ${STYLES[t.type] || STYLES.info}`}
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
