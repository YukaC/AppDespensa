import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PAGO_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#94a3b8'];

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #475569',
  borderRadius: '8px',
  color: '#e2e8f0',
};

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

function toDayKey(dia) {
  const d = dia instanceof Date ? dia : new Date(dia);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function fillDailyGaps(rows, dias = 30) {
  const map = new Map(rows.map((r) => [toDayKey(r.dia), r]));
  const result = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    result.push({
      dia: key,
      label: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
      ingresos: row?.ingresos ?? 0,
      ventas: row?.ventas ?? 0,
    });
  }
  return result;
}

export function fillMonthlyGaps(rows, meses = 6) {
  const map = new Map(rows.map((r) => [toDayKey(r.mes).slice(0, 7), r]));
  const result = [];
  const now = new Date();
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = map.get(key);
    result.push({
      mes: key,
      label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      ingresos: row?.ingresos ?? 0,
      ventas: row?.ventas ?? 0,
    });
  }
  return result;
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-sm">
      <p className="mb-1 font-medium text-slate-200">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'ventas' ? p.value : formatMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function VentasGraficos({ diarias, mensuales, porPago }) {
  const diarioData = fillDailyGaps(diarias || [], 30);
  const mensualData = fillMonthlyGaps(mensuales || [], 6);
  const pagoData = (porPago || []).map((p) => ({
    ...p,
    name: p.metodo,
  }));

  const sinDatos =
    !diarioData.some((d) => d.ingresos > 0) &&
    !mensualData.some((m) => m.ingresos > 0);

  if (sinDatos) {
    return (
      <p className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-slate-500">
        Aún no hay ventas registradas para mostrar gráficos.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card-panel p-5 lg:col-span-2">
        <h3 className="mb-4 font-semibold text-blue-300">Ingresos por día (últimos 30 días)</h3>
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diarioData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card-panel p-5">
        <h3 className="mb-4 font-semibold text-emerald-300">Tendencia mensual</h3>
        <div className="h-52 w-full sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mensualData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Line
                type="monotone"
                dataKey="ingresos"
                name="Ingresos"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card-panel p-5">
        <h3 className="mb-4 font-semibold text-amber-300">Por método de pago (30 días)</h3>
        {pagoData.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos de pago.</p>
        ) : (
          <div className="h-64 w-full sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pagoData}
                  dataKey="ingresos"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pagoData.map((_, i) => (
                    <Cell key={i} fill={PAGO_COLORS[i % PAGO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatMoney(value)}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: '#f1f5f9' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={10}
                  formatter={(value) => (
                    <span style={{ color: '#f8fafc', fontSize: 12 }}>{value}</span>
                  )}
                  wrapperStyle={{ paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
