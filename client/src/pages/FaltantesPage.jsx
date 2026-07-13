import FaltantesList from '../components/FaltantesList';
import { SkeletonList } from '../components/Skeleton';
import { useFaltantes } from '../hooks/useFaltantes';

export default function FaltantesPage() {
  const { list, loading, refresh } = useFaltantes();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title text-red-400">Productos faltantes</h2>
          <p className="page-subtitle">Stock en o por debajo del mínimo</p>
        </div>
        <button type="button" onClick={refresh} className="btn-secondary text-sm">
          Actualizar
        </button>
      </div>
      {loading ? (
        <SkeletonList rows={5} />
      ) : list.length === 0 ? (
        <p className="empty-state">No hay productos faltantes.</p>
      ) : (
        <FaltantesList productos={list} />
      )}
    </div>
  );
}
