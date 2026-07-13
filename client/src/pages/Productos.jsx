import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import StockList from '../components/StockList';
import FloatingField from '../components/FloatingField';
import { toast } from '../lib/toast';

export default function Productos() {
  const [params] = useSearchParams();
  const [productos, setProductos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState({
    codigoBarras: params.get('codigo') || '',
    nombre: '',
    precio: '',
    stock: 0,
    stockMinimo: 5,
    marcaId: '',
    proveedorId: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState('');

  async function load() {
    const [pRes, mRes, prRes] = await Promise.allSettled([
      api.productos.list(q || undefined),
      api.marcas.list(),
      api.proveedores.list(),
    ]);
    if (pRes.status === 'fulfilled' && pRes.value) setProductos(pRes.value);
    if (mRes.status === 'fulfilled' && mRes.value) setMarcas(mRes.value);
    if (prRes.status === 'fulfilled' && prRes.value) setProveedores(prRes.value);
  }

  useEffect(() => {
    load().catch(() => {});
  }, [q]);

  async function save(e) {
    e.preventDefault();
    const data = {
      codigoBarras: form.codigoBarras || null,
      nombre: form.nombre,
      precio: Number(form.precio),
      stock: Number(form.stock),
      stockMinimo: Number(form.stockMinimo),
      marcaId: form.marcaId ? Number(form.marcaId) : null,
      proveedorId: form.proveedorId ? Number(form.proveedorId) : null,
    };
    const wasEditing = editingId;
    try {
      if (editingId) {
        await api.productos.update(editingId, data);
      } else {
        await api.productos.create(data);
      }
      setForm({
        codigoBarras: '',
        nombre: '',
        precio: '',
        stock: 0,
        stockMinimo: 5,
        marcaId: '',
        proveedorId: '',
      });
      setEditingId(null);
      load();
      toast(wasEditing ? 'Producto actualizado' : 'Producto creado', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function edit(p) {
    setEditingId(p.id);
    setForm({
      codigoBarras: p.codigoBarras || '',
      nombre: p.nombre,
      precio: String(p.precio),
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      marcaId: p.marcaId || '',
      proveedorId: p.proveedorId || '',
    });
  }

  async function softDelete(id) {
    if (!confirm('¿Desactivar producto?')) return;
    await api.productos.delete(id);
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Productos</h2>
        <p className="page-subtitle">Alta, edición y búsqueda de stock</p>
      </div>

      {editingId && (
        <p className="rounded-lg border border-blue-800/50 bg-blue-950/30 px-4 py-2.5 text-sm text-blue-200">
          Editando producto — guardá o cancelá abajo
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="card-panel space-y-5 p-5 lg:order-1">
        <h3 className="font-semibold">{editingId ? 'Editar' : 'Nuevo'} producto</h3>
        <FloatingField
          label="Código barras"
          value={form.codigoBarras}
          onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
        />
        <FloatingField
          label="Nombre"
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <FloatingField
          label="Precio"
          required
          type="number"
          step="0.01"
          value={form.precio}
          onChange={(e) => setForm({ ...form, precio: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <FloatingField
            label="Stock"
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
          <FloatingField
            label="Stock mínimo"
            type="number"
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
          />
        </div>
        <FloatingField
          as="select"
          label="Marca"
          value={form.marcaId}
          onChange={(e) => setForm({ ...form, marcaId: e.target.value })}
        >
          <option value="">Sin marca</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </FloatingField>
        <FloatingField
          as="select"
          label="Proveedor"
          value={form.proveedorId}
          onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
        >
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </FloatingField>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="btn-primary flex-1">
            Guardar
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  codigoBarras: '',
                  nombre: '',
                  precio: '',
                  stock: 0,
                  stockMinimo: 5,
                  marcaId: '',
                  proveedorId: '',
                });
              }}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="lg:order-2">
        <FloatingField
          label="Filtrar productos"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          clearable
          className="mb-3"
        />
        <div className="max-h-[60vh] overflow-auto lg:max-h-[70vh]">
          <p className="mb-2 text-xs text-slate-500">Tocá un producto para editarlo</p>
          {productos.length === 0 ? (
            <p className="empty-state">No hay productos{q ? ' con ese filtro' : ''}.</p>
          ) : (
            <StockList productos={productos} onSelect={edit} />
          )}
          {editingId && (
            <button
              type="button"
              onClick={() => softDelete(editingId)}
              className="btn-secondary mt-3 w-full text-sm text-red-300"
            >
              Desactivar producto en edición
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
