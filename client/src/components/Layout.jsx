import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition';
import { isLocalAdminHost } from '../lib/access';

function buildNav(isAdmin) {
  if (isAdmin) {
    return [
      { to: '/', label: 'Caja', short: 'Caja', icon: '🛒' },
      ...(isLocalAdminHost()
        ? [
            { to: '/dashboard', label: 'Dashboard', short: 'Panel', icon: '📊' },
            { to: '/cierre-mensual', label: 'Cierre mes', short: 'Cierre', icon: '🗄️' },
          ]
        : []),
      { to: '/consulta', label: 'Consulta', short: 'Buscar', icon: '🔍' },
      { to: '/productos', label: 'Productos', short: 'Stock', icon: '📦' },
      { to: '/aumentos', label: 'Aumentos', short: 'Precios', icon: '📈' },
      { to: '/cuentas', label: 'Cuentas', short: 'Cuentas', icon: '👤' },
      { to: '/facturacion', label: 'Facturación', short: 'Factura', icon: '🧾' },
      {
        to: '/ingreso',
        label: 'Ingreso Mercadería',
        short: 'Ingreso',
        icon: '📥',
        highlight: true,
      },
    ];
  }
  return [
    { to: '/consulta', label: 'Precios', short: 'Precios', icon: '🔍' },
    { to: '/faltantes', label: 'Faltantes', short: 'Faltan', icon: '⚠️', danger: true },
    {
      to: '/ingreso',
      label: 'Ingreso Mercadería',
      short: 'Ingreso',
      icon: '📥',
      highlight: true,
    },
  ];
}

function navItemClass(item, active, variant) {
  const base =
    variant === 'mobile'
      ? 'relative flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[0.65rem] font-medium transition-colors'
      : 'rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors';

  if (active) {
    if (item.danger) return `${base} bg-red-600 text-white shadow-md shadow-red-900/40`;
    if (item.highlight) return `${base} bg-emerald-600 text-white shadow-md shadow-emerald-900/30`;
    return `${base} bg-blue-600 text-white shadow-md shadow-blue-900/30`;
  }
  if (item.danger) {
    return `${base} bg-red-950/50 text-red-300 hover:bg-red-900/60`;
  }
  if (item.highlight) {
    return `${base} bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50`;
  }
  return `${base} bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white`;
}

function NavItems({ items, pathname, variant }) {
  return items.map((item) => {
    const active = pathname === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={navItemClass(item, active, variant)}
        aria-current={active ? 'page' : undefined}
      >
        {variant === 'mobile' && (
          <span className="text-lg leading-none" aria-hidden>
            {item.icon}
          </span>
        )}
        <span className={variant === 'mobile' ? 'max-w-[4.5rem] truncate' : ''}>
          {variant === 'mobile' ? item.short : item.label}
        </span>
        {variant === 'mobile' && active && (
          <span className="nav-mobile-active-dot" aria-hidden />
        )}
      </Link>
    );
  });
}

export default function Layout({ children, mode }) {
  const loc = useLocation();
  const isAdmin = mode === 'admin';
  const nav = buildNav(isAdmin);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-700/80 bg-slate-900/95 pt-[env(safe-area-inset-top,0px)] shadow-lg shadow-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              <span className="text-slate-300">Autoservicio </span>
              <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                FALL
              </span>
            </h1>
            <p className="truncate text-xs text-slate-500">
              {isAdmin ? 'Admin · PC local' : 'Empleado · red'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {offline && (
              <span className="rounded-full bg-amber-950/80 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-700/50">
                Offline
              </span>
            )}
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400 ring-1 ring-slate-700">
              {isAdmin ? 'Admin' : 'Empleado'}
            </span>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-6xl flex-wrap gap-2 px-4 pb-3 md:flex">
          <NavItems items={nav} pathname={loc.pathname} variant="desktop" />
        </nav>
      </header>

      <main className="app-main mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <PageTransition routeKey={`${loc.pathname}-${mode}`}>{children}</PageTransition>
      </main>

      <nav
        className="app-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-slate-700/90 bg-slate-900/95 backdrop-blur-md md:hidden"
        aria-label="Navegación principal"
      >
        <div
          className={`flex gap-1 px-2 py-2 ${
            nav.length <= 4
              ? 'justify-around'
              : 'overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          }`}
        >
          <NavItems items={nav} pathname={loc.pathname} variant="mobile" />
        </div>
      </nav>
    </div>
  );
}
