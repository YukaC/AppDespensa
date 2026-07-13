# Plan de Implementación — Sistema de Registro de Ventas
### Para entregar al contador · Modo caveman · Sin integración ARCA directa

---

> **Para qué sirve esto:**
> Registrar ventas durante el día, cerrar el ciclo diario y exportar reportes limpios en PDF para que el contador haga toda la parte legal, fiscal y de facturación electrónica con ARCA.

---

## Índice

1. [El sistema en una oración](#1-el-sistema-en-una-oración)
2. [Flujo general del día a día](#2-flujo-general-del-día-a-día)
3. [Qué tecnología usar](#3-qué-tecnología-usar)
4. [Fase 1 — Base de datos](#4-fase-1--base-de-datos)
5. [Fase 2 — Ticket de venta](#5-fase-2--ticket-de-venta)
6. [Fase 3 — Ciclo diario de facturación](#6-fase-3--ciclo-diario-de-facturación)
7. [Fase 4 — PDF e impresión](#7-fase-4--pdf-e-impresión)
8. [Fase 5 — Reportes mensuales y anuales](#8-fase-5--reportes-mensuales-y-anuales)
9. [Qué le entregás al contador](#9-qué-le-entregás-al-contador)
10. [Checklist de desarrollo](#10-checklist-de-desarrollo)
11. [Estimación de tiempo](#11-estimación-de-tiempo)

---

## 1. El sistema en una oración

Un registro digital de ventas diarias que permite abrir y cerrar un ciclo de facturación, cargar tickets de venta con todos los datos relevantes y exportar reportes en PDF para el contador.

**Lo que el sistema NO hace** (lo hace el contador):
- Emitir facturas electrónicas oficiales con CAE
- Conectarse a los web services de ARCA
- Calcular ni declarar IVA o Ganancias
- Llevar el Libro IVA Digital

---

## 2. Flujo general del día a día

```
[ABRIR CICLO] → [Cargar ventas] → [CERRAR CICLO] → [Exportar PDF] → [Mandar al contador]
```

Paso a paso en palabras simples:

1. Llegás al trabajo y apretás **"Abrir ciclo"** — el sistema registra la hora de inicio.
2. Cada vez que hacés una venta, cargás un **ticket**: producto, cantidad, precio, método de pago. La hora se guarda sola.
3. Al final del día apretás **"Cerrar ciclo"** — el sistema calcula el total del día y bloquea la carga de nuevas ventas para esa jornada.
4. Exportás el **resumen del día en PDF** y se lo mandás al contador (o lo imprimís y lo guardás).
5. Al mes siguiente exportás el **resumen mensual en PDF** y lo mismo.

---

## 3. Qué tecnología usar

Hay tres caminos. Elegí uno solo y no mezcles.

### Opción A — App web local `(recomendada)`

Tecnologías: **React o Vue + SQLite** (o PostgreSQL si va a haber varios usuarios)

- Corre en el navegador, pero los datos se guardan en la misma computadora
- Fácil de expandir después si necesitás más funciones
- Se puede abrir desde cualquier dispositivo en la red local (tablet, celular)
- Requiere un desarrollador web para armarla

**Cuándo elegirla:** si querés algo sólido a largo plazo y estás dispuesto a invertir un poco más de tiempo de desarrollo.

---

### Opción B — Google Sheets o Excel con formularios

Tecnologías: **Google Sheets + Google Forms** (o Excel + formulario de datos)

- Sin código, sin instalación
- El contador probablemente ya lo conoce y puede trabajar directo ahí
- Google Forms llena la planilla automáticamente con cada venta
- Los reportes se generan con fórmulas simples de SUMA y SUMAR.SI
- Exportar a PDF es un clic

**Cuándo elegirla:** si querés algo funcionando mañana, con cero desarrollo, y no necesitás interfaz bonita.

---

### Opción C — App de escritorio

Tecnologías: **Electron + SQLite** (o Python + Tkinter como alternativa más simple)

- Corre directamente en la PC, sin navegador ni internet
- Todo offline, los datos quedan en el disco local
- Más trabajo de desarrollo que la opción web

**Cuándo elegirla:** si no tenés internet en el negocio o preferís que todo quede en una sola máquina sin depender de nada externo.

---

## 4. Fase 1 — Base de datos

Duración estimada: **1 a 2 días**

Estas son las tres tablas que necesitás. Si elegiste Google Sheets (Opción B), estas son las tres pestañas/hojas de la planilla.

### Tabla: `ciclos`

Guarda cada jornada de facturación.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | Número entero, auto | Identificador único del ciclo |
| `fecha_apertura` | Fecha y hora | Cuándo se abrió el ciclo |
| `fecha_cierre` | Fecha y hora | Cuándo se cerró (vacío si sigue abierto) |
| `total_dia` | Decimal | Suma total de las ventas del día |
| `cantidad_tickets` | Número entero | Cuántas ventas se registraron |
| `estado` | Texto | `"abierto"` o `"cerrado"` |

---

### Tabla: `ventas`

Una fila por cada venta registrada.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | Número entero, auto | Identificador único de la venta |
| `ciclo_id` | Número entero | A qué ciclo pertenece esta venta |
| `producto` | Texto | Nombre o descripción del producto/servicio |
| `cantidad` | Decimal | Cuántas unidades |
| `precio_unitario` | Decimal | Precio de una unidad |
| `precio_total` | Decimal | Calculado: cantidad × precio_unitario |
| `hora_venta` | Fecha y hora | Se registra automáticamente al guardar |
| `metodo_pago` | Texto | `"efectivo"`, `"tarjeta_debito"`, `"tarjeta_credito"`, `"transferencia"`, `"otro"` |
| `notas` | Texto | Campo libre opcional para observaciones |

---

### Tabla: `productos` *(opcional pero recomendada)*

Un catálogo básico para no tipear lo mismo siempre.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | Número entero, auto | Identificador único |
| `nombre` | Texto | Nombre del producto o servicio |
| `precio_default` | Decimal | Precio habitual (editable al cargar la venta) |

---

## 5. Fase 2 — Ticket de venta

Duración estimada: **2 a 3 días**

### Qué campos tiene el formulario de carga

| Campo | Obligatorio | Observaciones |
|---|---|---|
| Producto / descripción | Sí | Texto libre o seleccionado del catálogo |
| Cantidad | Sí | Número, acepta decimales |
| Precio unitario | Sí | Se puede pre-cargar del catálogo |
| Precio total | Auto | Se calcula solo: cantidad × precio unitario |
| Hora de la venta | Auto | El sistema la registra al guardar, no la escribe el usuario |
| Método de pago | Sí | Selector con las opciones fijas |
| Notas | No | Texto libre para cualquier aclaración |

### Reglas del formulario

- No se puede guardar un ticket si el ciclo del día está **cerrado**. El botón aparece deshabilitado.
- No se puede guardar un ticket si el ciclo **no fue abierto todavía**.
- El precio total se recalcula en tiempo real mientras se escribe cantidad y precio.
- Si se elige un producto del catálogo, precio unitario se completa solo (pero se puede editar).

### Vista de tickets del día

La pantalla principal muestra la lista de todas las ventas del ciclo abierto actual con:
- Número de venta (correlativo del día)
- Producto, cantidad, precio total
- Hora
- Método de pago
- Botón para ver el detalle o imprimir ese ticket individual

---

## 6. Fase 3 — Ciclo diario de facturación

Duración estimada: **1 a 2 días**

### Botón ABRIR CICLO

- Solo aparece disponible si no hay ningún ciclo abierto hoy
- Al hacer clic registra la fecha y hora exacta de apertura en la tabla `ciclos`
- Habilita el formulario de carga de ventas
- El estado del ciclo pasa a `"abierto"`

### Botón CERRAR CICLO

- Solo aparece disponible si hay un ciclo abierto
- Antes de cerrar muestra un **cuadro de confirmación**:
  > "¿Cerrás el ciclo del día? Ya no podrás agregar ventas a esta jornada. Total del día: $XX.XXX"
- Al confirmar:
  - Registra la fecha y hora de cierre
  - Calcula y guarda el total del día (suma de todos los `precio_total`)
  - Guarda la cantidad total de tickets
  - El estado pasa a `"cerrado"`
  - Muestra automáticamente el resumen del día y ofrece exportarlo a PDF

### Resumen automático al cerrar

Al cerrar el ciclo el sistema muestra un resumen con:

- Fecha de la jornada
- Hora de apertura y hora de cierre
- Total de ventas en pesos
- Cantidad de tickets registrados
- Subtotal por método de pago:
  - Efectivo: $X
  - Tarjeta débito: $X
  - Tarjeta crédito: $X
  - Transferencia: $X
- Botón "Exportar resumen a PDF"
- Botón "Imprimir resumen"

---

## 7. Fase 4 — PDF e impresión

Duración estimada: **2 a 3 días**

### Qué documentos se pueden exportar

**1. Ticket individual de venta**

Un comprobante por cada venta. Contiene:
- Nombre del negocio y datos básicos del emisor
- Número de venta del día (ej: Venta #007)
- Fecha y hora
- Detalle: producto, cantidad, precio unitario, precio total
- Método de pago
- Total
- Leyenda: *"Este documento no reemplaza la factura electrónica oficial"*

**2. Resumen del ciclo diario**

Un resumen por cada jornada cerrada. Contiene:
- Encabezado: nombre del negocio, fecha, hora apertura, hora cierre
- Lista de todas las ventas del día (producto, cantidad, precio, hora, método)
- Subtotales por método de pago
- Total del día en grande y visible
- Cantidad de operaciones
- Leyenda: *"Resumen interno para archivo contable · No válido como comprobante fiscal"*

**3. Resumen mensual**

Un PDF con el consolidado del mes. Contiene:
- Mes y año
- Total facturado en el mes
- Cantidad de jornadas trabajadas
- Cantidad total de ventas
- Subtotales por método de pago del mes completo
- Tabla con el desglose por día (fecha, total del día, cantidad de tickets)

**4. Resumen anual**

Un PDF con el consolidado del año. Contiene:
- Año
- Total anual
- Tabla con el total de cada mes
- Comparativo mes a mes en texto simple (qué mes fue mayor, cuál menor)

### Implementación técnica recomendada por opción

**Opción A (app web):** librería `jsPDF` para generar el PDF en el navegador, o `html2canvas` para capturar el HTML como imagen y convertirlo a PDF. `window.print()` con estilos `@media print` para la impresión directa.

**Opción B (Google Sheets):** Archivo > Descargar > PDF. O bien Archivo > Imprimir. Ya viene incluido, sin código.

**Opción C (app de escritorio):** librería `ReportLab` si usás Python, o la API nativa de impresión de Electron si usás JavaScript.

---

## 8. Fase 5 — Reportes mensuales y anuales

Duración estimada: **2 a 3 días**

### Pantalla de reportes

Una sección separada del sistema (menú "Reportes") con dos vistas:

#### Vista mensual

Filtro por mes y año. Muestra:
- Total vendido en el mes
- Cantidad de jornadas con ciclos cerrados
- Cantidad total de tickets
- Subtotales por método de pago
- Tabla de resumen por día (fecha, total, cantidad de ventas, métodos usados)
- Botón "Exportar a PDF" y botón "Imprimir"

#### Vista anual

Filtro por año. Muestra:
- Total vendido en el año
- Tabla con un fila por mes: mes, total, cantidad de ventas
- El mes con mayor y menor facturación resaltados
- Botón "Exportar a PDF" y botón "Imprimir"

### Filtros adicionales útiles

- Por método de pago (para separar efectivo de tarjeta si el contador lo necesita)
- Por rango de fechas libre (del día X al día Y)
- Buscar una venta por producto o por monto

---

## 9. Qué le entregás al contador

Con este sistema, lo que le mandás al contador es:

| Documento | Cuándo | Formato |
|---|---|---|
| Resumen del ciclo diario | Todos los días al cerrar | PDF impreso o digital |
| Resumen mensual | Cada inicio de mes | PDF |
| Resumen anual | Al cerrar el año fiscal | PDF |
| Ticket individual | Cuando te lo pide | PDF o impreso |

El contador toma esos números y hace con ellos:
- La factura electrónica oficial en ARCA (con CAE, QR, tipo A/B/C según corresponda)
- La declaración jurada de IVA mensual
- El Libro IVA Digital
- El cálculo de Ganancias
- Cualquier otro trámite fiscal

**Vos no tocás nada de eso.**

---

## 10. Checklist de desarrollo

Marcá cada ítem cuando esté listo:

### Base y estructura
- [ ] Elegir tecnología (Opción A / B / C)
- [ ] Crear las tablas `ciclos`, `ventas` y `productos`
- [ ] Configurar el proyecto base (repositorio, dependencias)

### Funcionalidad de ventas
- [ ] Formulario de carga de ticket con todos los campos
- [ ] Cálculo automático del precio total
- [ ] Registro automático de la hora al guardar
- [ ] Selector de método de pago con opciones fijas
- [ ] Catálogo básico de productos (opcional)
- [ ] Lista de ventas del día en la pantalla principal

### Ciclo diario
- [ ] Botón ABRIR CICLO con registro de timestamp
- [ ] Botón CERRAR CICLO con confirmación
- [ ] Cálculo automático del resumen al cerrar
- [ ] Bloqueo de carga cuando el ciclo está cerrado
- [ ] Vista del resumen del día post-cierre

### PDF e impresión
- [ ] PDF del ticket individual
- [ ] PDF del resumen del ciclo diario
- [ ] PDF del resumen mensual
- [ ] PDF del resumen anual
- [ ] Botón imprimir en todas las vistas relevantes

### Reportes
- [ ] Pantalla de reportes con filtro mensual
- [ ] Pantalla de reportes con filtro anual
- [ ] Filtro por rango de fechas

### Final
- [ ] Prueba de carga y cierre de ciclo durante 3 días seguidos
- [ ] Verificar que los totales cuadran con una calculadora
- [ ] Generar un PDF de prueba y abrirlo en el teléfono del contador para confirmar que se lee bien

---

## 11. Estimación de tiempo

| Fase | Tarea | Días estimados |
|---|---|---|
| 1 | Base de datos y estructura | 1 – 2 días |
| 2 | Formulario de ticket de venta | 2 – 3 días |
| 3 | Ciclo diario (abrir / cerrar) | 1 – 2 días |
| 4 | Generación de PDF e impresión | 2 – 3 días |
| 5 | Pantalla de reportes | 2 – 3 días |
| — | Pruebas y ajustes finales | 1 – 2 días |
| **Total** | | **9 – 15 días hábiles** |

> Si se elige la Opción B (Google Sheets), el tiempo total baja a **1 o 2 días** porque no hay código que escribir — solo configurar la planilla y el formulario.

---

*Documento generado como plan interno de desarrollo · Junio 2026*
*Consultar con el contador antes de imprimir o distribuir cualquier comprobante generado por este sistema*
