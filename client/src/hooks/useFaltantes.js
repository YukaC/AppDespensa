import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useFaltantes() {
  const [count, setCount] = useState(0);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([
        api.productos.faltantesCount(),
        api.productos.faltantes(),
      ]);
      if (c) setCount(c.count ?? 0);
      if (f) setList(f);
    } catch {
      // silencioso offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { count, list, loading, refresh };
}
