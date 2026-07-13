import { useCallback, useEffect, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '../lib/api';
import StockList from '../components/StockList';
import ProductoDetalleInline from '../components/ProductoDetalleInline';
import FloatingField from '../components/FloatingField';
import { SkeletonList } from '../components/Skeleton';

export default function Consulta() {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  const cargarLista = useCallback(async (termino) => {
    setLoading(true);
    try {
      const data = await api.productos.list(termino || undefined);
      setLista(data || []);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setSelectedId(null);
      cargarLista();
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (/^\d{8,}$/.test(q.trim())) {
          const p = await api.productos.barcode(q.trim());
          if (p) {
            setLista([p]);
            setSelectedId(p.id);
          } else {
            setLista([]);
            setSelectedId(null);
          }
          setLoading(false);
          return;
        }
        const data = await api.productos.list(q);
        const items = data || [];
        setLista(items);
        setSelectedId(items.length === 1 ? items[0].id : null);
      } catch {
        setLista([]);
        setSelectedId(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, cargarLista]);

  useEffect(() => {
    if (!cameraOn) return;
    const reader = new BrowserMultiFormatReader();
    let active = true;
    reader
      .decodeFromVideoDevice(undefined, 'video-preview', (result) => {
        if (result && active) {
          setQ(result.getText());
          setCameraOn(false);
        }
      })
      .catch(() => setCameraOn(false));
    return () => {
      active = false;
      reader.reset();
    };
  }, [cameraOn]);

  function handleSelect(p) {
    setSelectedId((prev) => (prev === p.id ? null : p.id));
  }

  const buscando = Boolean(q.trim());
  const singleVisible =
    buscando && lista.length === 1 && selectedId === lista[0]?.id;
  const listVisible = !loading && lista.length > 0 && (!buscando || lista.length > 1);

  return (
    <div className="consulta-page page-static space-y-5">
      <div>
        <h2 className="page-title">Consulta de precios</h2>
        <p className="page-subtitle">Buscá por nombre o escaneá con la cámara</p>
      </div>
      <FloatingField
        label="Nombre o código de barras"
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        size="lg"
        clearable
        inputClassName="!bg-slate-800/95"
        autoFocus
      />
      <button
        type="button"
        onClick={() => setCameraOn((v) => !v)}
        className="btn-secondary w-full text-sm sm:w-auto"
      >
        {cameraOn ? '✕ Cerrar cámara' : '📷 Escanear con cámara'}
      </button>
      {cameraOn && (
        <video id="video-preview" className="max-h-64 w-full rounded-lg bg-black" />
      )}

      {singleVisible && (
        <div className="card-panel overflow-hidden">
          <p className="border-b border-slate-700/80 px-4 py-3 text-lg font-semibold leading-snug">
            {lista[0].nombre}
          </p>
          <ProductoDetalleInline producto={lista[0]} hero />
        </div>
      )}

      {loading && <SkeletonList rows={buscando ? 3 : 5} />}

      {listVisible && (
        <div className="consulta-lista">
          {!buscando && (
            <p className="mb-2 text-sm text-slate-500">{lista.length} productos en stock</p>
          )}
          {buscando && lista.length > 1 && (
            <p className="mb-2 text-sm text-slate-500">
              {lista.length} resultado{lista.length !== 1 ? 's' : ''}
            </p>
          )}
          <StockList
            productos={lista}
            onSelect={handleSelect}
            selectedId={selectedId}
          />
        </div>
      )}

      {buscando && !loading && !lista.length && (
        <p className="empty-state">No se encontraron productos.</p>
      )}
    </div>
  );
}
