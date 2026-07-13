import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { getAccessMode, isReadOnlyByDefault } from './lib/access';
import Caja from './pages/Caja';
import Consulta from './pages/Consulta';
import Productos from './pages/Productos';
import Aumentos from './pages/Aumentos';
import FaltantesPage from './pages/FaltantesPage';
import Dashboard from './pages/Dashboard';
import IngresoMercaderia from './pages/IngresoMercaderia';
import Cuentas from './pages/Cuentas';
import Facturacion from './pages/Facturacion';
import ReportesContables from './pages/ReportesContables';
import CierreMensual from './pages/CierreMensual';

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Caja />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/consulta" element={<Consulta />} />
      <Route path="/productos" element={<Productos />} />
      <Route path="/aumentos" element={<Aumentos />} />
      <Route path="/cuentas" element={<Cuentas />} />
      <Route path="/facturacion" element={<Facturacion />} />
      <Route path="/reportes-contables" element={<ReportesContables />} />
      <Route path="/cierre-mensual" element={<CierreMensual />} />
      <Route path="/ingreso" element={<IngresoMercaderia />} />
      <Route path="/faltantes" element={<FaltantesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ReadOnlyRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/consulta" replace />} />
      <Route path="/consulta" element={<Consulta />} />
      <Route path="/ingreso" element={<IngresoMercaderia />} />
      <Route path="/faltantes" element={<FaltantesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const mode = getAccessMode();

  useEffect(() => {
    if (isReadOnlyByDefault()) {
      sessionStorage.removeItem('admin_pin_ok');
    }
  }, []);

  return (
    <Layout mode={mode}>
      {mode === 'admin' ? <AdminRoutes /> : <ReadOnlyRoutes />}
    </Layout>
  );
}
