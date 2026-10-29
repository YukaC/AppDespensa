/**
 * Deterministic seed for the static demo.
 *
 * Amounts, products, quantities and payments are fixed constants (no
 * Math.random). Only calendar dates are derived from the day the demo is
 * first opened, so the dashboard always looks "current" while every machine
 * shows the same catalogue, the same tickets and the same totals.
 */

export const SEED_VERSION = 1;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function at(base, daysAgo, hours, minutes) {
  const d = new Date(base);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function dateAt(base, offsetDays) {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

const MARCAS = [
  'La Tranquera',
  'Marolio',
  'Arcor',
  'Coca-Cola',
  'Molinos Ala',
  'Ledesma',
  'La Serenísima',
  'Bagley',
  'Nescafé',
  'Villavicencio',
  'Playadito',
  'Lucchetti',
  'Cocinero',
  'Cañuelas',
  'Rosamonte',
  'Ayudín',
  'Elite',
  'Celusal',
  'Bimbo',
  'La Campagnola',
];

const PROVEEDORES = [
  'Distribuidora Del Sur',
  'Molinos Andinos',
  'Bebidas del Litoral',
  'Lácteos Santa Fe',
];

// id | nombre | codigoBarras | precio | stock | stockMinimo | marcaId | proveedorId | vencimiento (días)
const PRODUCTOS = [
  [1, 'Yerba Mate La Tranquera 1 kg', '7791234000011', 4890, 26, 8, 1, 1, null],
  [2, 'Yerba Mate Playadito 500 g', '7791234000028', 2750, 7, 8, 11, 1, null],
  [3, 'Fideos Lucchetti Spaghetti 500 g', '7790070000035', 1890, 34, 10, 12, 2, null],
  [4, 'Fideos Marolio Tirabuzón 500 g', '7790070000042', 1250, 12, 12, 2, 2, null],
  [5, 'Aceite de Girasol Cocinero 1.5 L', '7791234000059', 3290, 18, 6, 13, 2, null],
  [6, 'Aceite de Oliva Molinos Ala 500 ml', '7791234000066', 6450, 5, 4, 5, 2, 60],
  [7, 'Gaseosa Coca-Cola 2.25 L', '7791234000073', 3450, 40, 12, 4, 3, null],
  [8, 'Gaseosa Sprite 2.25 L', '7791234000080', 3350, 22, 12, 4, 3, null],
  [9, 'Agua Mineral Villavicencio 1.5 L', '7791234000097', 1450, 30, 10, 10, 3, null],
  [10, 'Arroz Molinos Ala Largo Fino 1 kg', '7791234000103', 2190, 16, 6, 5, 2, null],
  [11, 'Azúcar Ledesma 1 kg', '7791234000110', 1850, 14, 8, 6, 1, null],
  [12, 'Harina 000 Cañuelas 1 kg', '7791234000127', 1390, 11, 6, 14, 2, null],
  [13, 'Leche Entera La Serenísima 1 L', '7791234000134', 1590, 28, 12, 7, 4, 14],
  [14, 'Yogur La Serenísima 190 g', '7791234000141', 990, 3, 8, 7, 4, 4],
  [15, 'Queso Crema La Serenísima 300 g', '7791234000158', 3250, 9, 4, 7, 4, 20],
  [16, 'Galletitas Bagley Criollitas 300 g', '7791234000165', 1750, 21, 8, 8, 1, null],
  [17, 'Galletitas Oreo 118 g', '7791234000172', 1290, 15, 6, 8, 1, null],
  [18, 'Café Nescafé Clásico 170 g', '7791234000189', 5890, 8, 4, 9, 1, null],
  [19, 'Yerba Mate Rosamonte 1 kg', '7791234000196', 5250, 2, 6, 15, 1, null],
  [20, 'Lavandina Ayudín 1.5 L', '7791234000202', 1650, 19, 6, 16, 1, null],
  [21, 'Detergente Ala 750 ml', '7791234000219', 2490, 13, 6, 5, 1, null],
  [22, 'Papel Higiénico Elite 4 rollos', '7791234000226', 2750, 6, 8, 17, 1, null],
  [23, 'Sal Fina Celusal 500 g', '7791234000233', 690, 25, 10, 18, 1, null],
  [24, 'Pan Lactal Bimbo 500 g', '7791234000240', 2290, 4, 6, 19, 4, 10],
  [25, 'Salsa de Tomate Arcor 520 g', '7791234000257', 1150, 17, 8, 3, 2, null],
  [26, 'Atún La Campagnola 170 g', '7791234000264', 2890, 10, 4, 20, 2, 25],
];

const CLIENTES = [
  [1, 'Marta Giménez', '11-5555-0101'],
  [2, 'Almacén Los Hermanos', '11-5555-0102'],
  [3, 'Jorge Peralta', '11-5555-0103'],
  [4, 'Silvana Ríos', '11-5555-0104'],
  [5, 'Pablo Duarte', '11-5555-0105'],
  [6, 'Estela Benítez', '11-5555-0106'],
];

// id | días atrás | apertura | cierre (null = abierto)
const CICLOS = [
  [1, 4, '08:15', '20:40'],
  [2, 2, '08:05', '21:10'],
  [3, 1, '08:20', '20:55'],
  [4, 0, '08:10', null],
];

// cicloId | días atrás | hora | método | clienteId | clienteNombre | items [productoId, cantidad]
const VENTAS = [
  [1, 4, '09:10', 'Efectivo', null, null, [[1, 2], [3, 1], [5, 1]]],
  [1, 4, '11:35', 'Transferencia', null, null, [[7, 2], [9, 3]]],
  [1, 4, '17:20', 'Cuenta', 1, null, [[10, 2], [11, 1], [13, 2]]],
  [1, 4, '17:55', 'Cuenta', 4, null, [[26, 2], [24, 1]]],
  [2, 2, '08:50', 'Efectivo', null, null, [[18, 1], [16, 2]]],
  [2, 2, '12:15', 'Tarjeta', null, null, [[15, 1], [14, 4], [24, 2]]],
  [2, 2, '18:40', 'Cuenta', 2, null, [[1, 4], [3, 3], [25, 3]]],
  [3, 1, '09:05', 'Efectivo', null, null, [[7, 3], [8, 1], [23, 2]]],
  [3, 1, '13:30', 'Cuenta', null, 'Kiosco Rubén', [[7, 4], [9, 4]]],
  [3, 1, '19:45', 'Transferencia', null, null, [[20, 2], [21, 1], [22, 1]]],
  [4, 0, '08:25', 'Efectivo', null, null, [[2, 1], [4, 2], [23, 1]]],
  [4, 0, '09:15', 'Tarjeta', null, null, [[8, 2], [17, 2]]],
];

// clienteId | monto | días atrás | hora | notas
const PAGOS = [
  [1, 4000, 3, '18:30', 'Pago parcial en efectivo'],
  [4, 8070, 3, '19:10', 'Cuenta saldada'],
  [2, 10000, 1, '19:20', 'Entrega a cuenta'],
];

export function buildSeedState(baseDate = new Date()) {
  const base = new Date(baseDate);

  const marcas = MARCAS.map((nombre, i) => ({ id: i + 1, nombre }));
  const proveedores = PROVEEDORES.map((nombre, i) => ({ id: i + 1, nombre }));

  const productos = PRODUCTOS.map(
    ([id, nombre, codigoBarras, precio, stock, stockMinimo, marcaId, proveedorId, venc]) => ({
      id,
      codigoBarras,
      nombre,
      precio,
      stock,
      stockMinimo,
      fechaVencimiento: venc == null ? null : dateAt(base, venc),
      activo: true,
      marcaId,
      proveedorId,
      updatedAt: at(base, 0, 8, 0),
    })
  );

  const clientes = CLIENTES.map(([id, nombre, telefono]) => ({
    id,
    nombre,
    telefono,
    activo: true,
    createdAt: at(base, 90, 10, 0),
  }));

  const productById = new Map(productos.map((p) => [p.id, p]));

  const cicloById = new Map();
  const ciclos = CICLOS.map(([id, daysAgo, horaApertura, horaCierre]) => {
    const [h, m] = horaApertura.split(':').map(Number);
    const ciclo = {
      id,
      fechaApertura: at(base, daysAgo, h, m),
      fechaCierre: null,
      totalDia: null,
      cantidadTickets: 0,
      estado: 'abierto',
    };
    if (horaCierre) {
      const [ch, cm] = horaCierre.split(':').map(Number);
      ciclo.fechaCierre = at(base, daysAgo, ch, cm);
      ciclo.estado = 'cerrado';
    }
    cicloById.set(id, ciclo);
    return ciclo;
  });

  let detalleId = 1;
  const ventas = VENTAS.map(
    ([cicloId, daysAgo, hora, metodoPago, clienteId, clienteNombre, items], index) => {
      const [h, m] = hora.split(':').map(Number);
      const fecha = at(base, daysAgo, h, m);
      const detalles = items.map(([productoId, cantidad]) => ({
        id: detalleId++,
        productoId,
        cantidad,
        precioUnit: productById.get(productoId).precio,
      }));
      const total = round2(
        detalles.reduce((sum, d) => sum + d.precioUnit * d.cantidad, 0)
      );
      return {
        id: index + 1,
        total,
        metodoPago,
        fecha,
        clienteId,
        clienteNombre,
        cicloId,
        notas: null,
        detalles,
      };
    }
  );

  ventas.forEach((v) => {
    v.detalles.forEach((d) => {
      d.ventaId = v.id;
    });
  });

  let movimientoId = 1;
  const movimientos = [];
  for (const venta of ventas) {
    if (venta.metodoPago !== 'Cuenta') continue;
    movimientos.push({
      id: movimientoId++,
      clienteId: venta.clienteId,
      clienteNombre: venta.clienteNombre,
      tipo: 'CARGO',
      monto: venta.total,
      ventaId: venta.id,
      notas: `Ticket #${venta.id}`,
      fecha: venta.fecha,
      visibleEnCuentas: true,
      archivadoAt: null,
    });
  }

  for (const [clienteId, monto, daysAgo, hora, notas] of PAGOS) {
    const [h, m] = hora.split(':').map(Number);
    movimientos.push({
      id: movimientoId++,
      clienteId,
      clienteNombre: null,
      tipo: 'PAGO',
      monto,
      ventaId: null,
      notas,
      fecha: at(base, daysAgo, h, m),
      visibleEnCuentas: true,
      archivadoAt: null,
    });
  }

  for (const ciclo of ciclos) {
    const ventasCiclo = ventas.filter((v) => v.cicloId === ciclo.id);
    if (ciclo.estado === 'cerrado') {
      ciclo.cantidadTickets = ventasCiclo.length;
      ciclo.totalDia = round2(ventasCiclo.reduce((s, v) => s + v.total, 0));
    }
  }

  let historialAumentoId = 1;
  let historialPrecioId = 1;

  return {
    seedVersion: SEED_VERSION,
    generadoEl: base.toISOString(),
    marcas,
    proveedores,
    productos,
    clientes,
    ventas,
    movimientos,
    ciclos,
    ingresos: [],
    historialAumentos: [
      {
        id: historialAumentoId++,
        tipo: 'proveedor',
        referenciaId: 2,
        porcentaje: 8,
        fecha: at(base, 12, 9, 30),
      },
      {
        id: historialAumentoId++,
        tipo: 'marca',
        referenciaId: 4,
        porcentaje: 5,
        fecha: at(base, 5, 10, 15),
      },
    ],
    historialPrecios: [
      {
        id: historialPrecioId++,
        productoId: 7,
        precioViejo: 3285,
        precioNuevo: 3450,
        fecha: at(base, 5, 10, 15),
      },
    ],
    syncQueue: [],
  };
}
