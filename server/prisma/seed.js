import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de base de datos para Coronel Dorrego...');

  // 1. Crear o actualizar Proveedores
  const proveedoresData = [
    'Diarco Coronel Dorrego',
    'Distribuidora Coca-Cola',
    'Distribuidora Quilmes',
    'Distribuidora Arcor',
    'Distribuidora La Serenísima',
    'Amanecer Lácteo'
  ];

  const proveedores = new Map();
  for (const nombre of proveedoresData) {
    const prov = await prisma.proveedor.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    proveedores.set(nombre, prov.id);
  }

  // 2. Crear o actualizar Marcas
  const marcasData = [
    'Coca-Cola',
    'Quilmes',
    'Arcor',
    'La Serenísima',
    'Amanecer',
    'Marolio',
    'Ledesma'
  ];

  const marcas = new Map();
  for (const nombre of marcasData) {
    const marca = await prisma.marca.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    marcas.set(nombre, marca.id);
  }

  // 3. Crear Productos
  const productos = [
    // Bebidas - Coca Cola
    { codigoBarras: '7790895000997', nombre: 'Coca-Cola Sabor Original 2.25L', precio: 2500, stock: 40, stockMinimo: 10, marca: 'Coca-Cola', proveedor: 'Distribuidora Coca-Cola' },
    { codigoBarras: '7790895001000', nombre: 'Sprite 2.25L', precio: 2300, stock: 24, stockMinimo: 6, marca: 'Coca-Cola', proveedor: 'Distribuidora Coca-Cola' },
    
    // Bebidas - Quilmes
    { codigoBarras: '7792798000018', nombre: 'Cerveza Quilmes Clásica Retornable 1L', precio: 1800, stock: 60, stockMinimo: 20, marca: 'Quilmes', proveedor: 'Distribuidora Quilmes' },
    { codigoBarras: '7792798000452', nombre: 'Cerveza Stella Artois 1L', precio: 2800, stock: 30, stockMinimo: 10, marca: 'Quilmes', proveedor: 'Distribuidora Quilmes' },

    // Almacén / Golosinas - Arcor
    { codigoBarras: '7790580402801', nombre: 'Galletitas Surtido Diversión 400g', precio: 1500, stock: 15, stockMinimo: 5, marca: 'Arcor', proveedor: 'Distribuidora Arcor' },
    { codigoBarras: '7790580123454', nombre: 'Polenta Presto Pronta 500g', precio: 1200, stock: 10, stockMinimo: 3, marca: 'Arcor', proveedor: 'Distribuidora Arcor' },

    // Lácteos - La Serenísima
    { codigoBarras: '7790742302805', nombre: 'Leche Entera Sachet 1L', precio: 1300, stock: 30, stockMinimo: 10, marca: 'La Serenísima', proveedor: 'Distribuidora La Serenísima' },
    { codigoBarras: '7790742435404', nombre: 'Dulce de Leche Clásico 400g', precio: 2100, stock: 12, stockMinimo: 4, marca: 'La Serenísima', proveedor: 'Distribuidora La Serenísima' },

    // Lácteos Locales - Amanecer
    { codigoBarras: '7798020000011', nombre: 'Queso Cremoso Amanecer (por Kg)', precio: 6500, stock: 8, stockMinimo: 2, marca: 'Amanecer', proveedor: 'Amanecer Lácteo' },
    { codigoBarras: '7798020000028', nombre: 'Yogur Bebible Vainilla Amanecer 1L', precio: 1400, stock: 15, stockMinimo: 5, marca: 'Amanecer', proveedor: 'Amanecer Lácteo' },

    // Mayorista / Secos - Diarco
    { codigoBarras: '7797470001001', nombre: 'Fideos Tallarines Marolio 500g', precio: 900, stock: 25, stockMinimo: 10, marca: 'Marolio', proveedor: 'Diarco Coronel Dorrego' },
    { codigoBarras: '7797470001002', nombre: 'Puré de Tomate Marolio 520g', precio: 700, stock: 20, stockMinimo: 8, marca: 'Marolio', proveedor: 'Diarco Coronel Dorrego' },
    { codigoBarras: '7790070001003', nombre: 'Azúcar Clásica Ledesma 1kg', precio: 1100, stock: 40, stockMinimo: 10, marca: 'Ledesma', proveedor: 'Diarco Coronel Dorrego' },
  ];

  let creados = 0;
  for (const p of productos) {
    await prisma.producto.upsert({
      where: { codigoBarras: p.codigoBarras },
      update: {
        precio: p.precio,
        stock: p.stock,
        marcaId: marcas.get(p.marca),
        proveedorId: proveedores.get(p.proveedor)
      },
      create: {
        codigoBarras: p.codigoBarras,
        nombre: p.nombre,
        precio: p.precio,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        marcaId: marcas.get(p.marca),
        proveedorId: proveedores.get(p.proveedor),
      },
    });
    creados++;
  }

  console.log(`\n¡Seed completado con éxito!`);
  console.log(`👉 ${proveedores.size} proveedores registrados.`);
  console.log(`👉 ${marcas.size} marcas registradas.`);
  console.log(`👉 ${creados} productos en catálogo listos para vender.\n`);
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });