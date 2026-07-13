import { useEffect, useRef } from 'react';

/**
 * Detecta ráfagas de tipeo + Enter del lector USB (emula teclado).
 */
export function useBarcodeScanner(onScan) {
  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e) => {
      const now = Date.now();
      if (now - lastKeyRef.current > 100) {
        bufferRef.current = '';
      }
      lastKeyRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= 4) {
          e.preventDefault();
          onScan(code);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (document.activeElement?.tagName === 'INPUT' && document.activeElement?.dataset?.allowScanner !== 'true') {
          return;
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onScan]);
}
