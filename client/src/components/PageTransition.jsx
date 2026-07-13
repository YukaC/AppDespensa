/**
 * Fade al cambiar de módulo. Consulta va sin animación (lista pesada + foco).
 */
export default function PageTransition({ routeKey, children }) {
  const isConsulta = routeKey.startsWith('/consulta');
  const className = isConsulta ? 'page-static' : 'route-view';

  return (
    <div key={routeKey} className={className}>
      {children}
    </div>
  );
}
