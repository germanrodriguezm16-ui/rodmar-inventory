# 📚 Documentación Completa - RodMar Inventory

## 🎯 Visión General

**RodMar Inventory** es un sistema integral de gestión para operaciones mineras y logística de transporte. Diseñado principalmente para uso móvil, permite gestionar viajes de carga/descarga, transacciones financieras, relaciones con minas, compradores y volqueteros, con cálculos automáticos de balances y ganancias.

---

## 🏗️ Arquitectura de la Aplicación

### Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: PostgreSQL + Drizzle ORM
- **Estado**: TanStack Query (React Query) para caché y sincronización
- **Tiempo Real**: Socket.io para actualizaciones en vivo
- **UI**: Radix UI + shadcn/ui
- **Routing**: Wouter (ligero, similar a React Router)

### Estructura del Proyecto

```
RodMarInventory/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/       # Componentes organizados por módulo
│   │   │   ├── modules/      # Módulos principales (principal, minas, rodmar, etc.)
│   │   │   ├── forms/        # Formularios (modales, inputs)
│   │   │   ├── layout/       # Layout y navegación
│   │   │   └── ui/           # Componentes UI reutilizables
│   │   ├── pages/            # Páginas principales (detail pages)
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilidades y configuraciones
│   │   └── App.tsx           # Punto de entrada
│   └── public/
├── server/                    # Backend Express
│   ├── middleware/            # Auth, session, etc.
│   ├── routes.ts              # Todas las rutas API
│   ├── storage.ts             # Interface de almacenamiento
│   ├── db-storage.ts          # Implementación PostgreSQL
│   ├── socket.ts              # WebSocket para tiempo real
│   └── index.ts               # Punto de entrada
├── shared/                    # Código compartido
│   └── schema.ts              # Esquemas DB y validación Zod
└── package.json
```

---

## 📱 Módulos Principales

La aplicación tiene **6 módulos principales** accesibles desde la barra de navegación inferior:

### 1. 🏠 Principal (Historial de Viajes)

**Propósito**: Vista central de todos los viajes (cargues y descargues)

**Funcionalidades**:
- **Lista de Viajes**: Muestra todos los viajes con información resumida
- **Filtros Avanzados**:
  - Por mina, comprador, conductor, placa
  - Por ID de viaje
  - Por fecha de cargue o descargue
  - Filtros rápidos (hoy, ayer, esta semana, etc.)
- **Vista Extendida**: Botón "Ver más" muestra columnas adicionales (VUT, CUT, FUT, ganancias, etc.)
- **Acciones**:
  - Registrar Cargue (botón superior)
  - Registrar Descargue (botón superior)
  - Editar viaje (tocar en un viaje)
  - Eliminar viaje
  - Exportar a Excel
  - Importar desde Excel
  - Selección múltiple para eliminación masiva

**Datos Mostrados**:
- ID del viaje (generado automáticamente: G1, G2, etc.)
- Fecha de cargue y descargue
- Conductor y placa
- Mina y comprador
- Peso en toneladas
- Recibo (imagen)
- Valores calculados (Total Venta, Total Compra, Ganancia, etc.)

---

### 2. ⛰️ Minas

**Propósito**: Gestión de ubicaciones de extracción (proveedores de material)

**Funcionalidades**:
- **Lista de Minas**: Muestra nombre y saldo actual
- **Crear Mina**: Solo requiere nombre
- **Ver Detalle**: Al tocar una mina, abre página de detalle con 3 pestañas:
  - **Viajes**: Historial de viajes de esa mina (con filtros)
  - **Transacciones**: Transacciones manuales relacionadas (editable)
  - **Balance**: Desglose financiero

**Lógica de Balance de Minas**:
```
Balance = Ingresos por Viajes + Transacciones Netas

Ingresos por Viajes = Suma de totalCompra de viajes completados
  (Lo que RodMar paga a la mina por el material)

Transacciones Netas:
  + Transacciones DESDE la mina (mina vende/recibe dinero)
  - Transacciones HACIA la mina (RodMar paga a la mina)
  + Transacciones hacia RodMar/Banco (ingresos)
```

**Conceptos de Transacciones para Minas**:
- **"Pago"** o **"Adelanto"**: Disminuye el balance (RodMar paga a la mina)
- **"Saldo a favor"** o **"Viaje"**: Aumenta el balance (mina debe a RodMar)

**Características Especiales**:
- Ordenamiento inteligente (por balance, alfabético, o cantidad de viajes)
- Fusión de minas (unificar dos minas en una)
- Historial de fusiones con capacidad de reversión

---

### 3. 🤝 Compradores

**Propósito**: Gestión de clientes que compran el material

**Funcionalidades**:
- **Lista de Compradores**: Muestra nombre y saldo actual
- **Crear Comprador**: Solo requiere nombre
- **Ver Detalle**: Al tocar un comprador, abre página de detalle con 3 pestañas:
  - **Viajes**: Historial de viajes vendidos a ese comprador
  - **Transacciones**: Transacciones manuales relacionadas (editable)
  - **Balance**: Desglose financiero

**Lógica de Balance de Compradores**:
```
Balance = Total Ventas - Abonos + Préstamos

Total Ventas = Suma de valorConsignar de viajes completados
  (Lo que el comprador debe a RodMar)

Transacciones:
  + "Abono": Aumenta el balance (comprador paga a RodMar)
  - "Préstamo": Disminuye el balance (RodMar presta al comprador)
```

**Transacciones Dinámicas de Viajes**:
- Cuando un viaje se completa, se crea automáticamente una transacción virtual
- Valor: `-valorConsignar` (negativo porque el comprador debe)
- Se muestra en la pestaña de transacciones pero no se guarda en BD
- Solo se calcula dinámicamente desde los viajes completados

**Características Especiales**:
- Transacciones temporales (se pueden crear antes de guardar)
- Ocultar transacciones/viajes específicos del módulo
- Gráficas de análisis financiero

---

### 4. 🚛 Volqueteros

**Propósito**: Gestión de transportistas y vehículos

**Funcionalidades**:
- **Lista de Volqueteros**: Muestra nombre, placa y saldo
- **Creación Automática**: Se crean automáticamente al registrar un viaje con un conductor nuevo
- **Agrupación**: Un volquetero puede tener múltiples placas
- **Ver Detalle**: Al tocar un volquetero, abre página de detalle con:
  - **Transacciones**: Pagos, préstamos y saldos a favor
  - **Balance**: Desglose financiero

**Lógica de Balance de Volqueteros**:
```
Balance = (Pagos + Préstamos) * (-1) + Saldos a Favor

Transacciones:
  - "Pago" o "Préstamo": Disminuye el balance (RodMar paga al volquetero)
  + "Saldo a favor": Aumenta el balance (volquetero debe a RodMar)
```

**Características Especiales**:
- Múltiples placas por conductor
- Transacciones manuales para pagos de flete
- Ocultar transacciones específicas del módulo

---

### 5. 💰 Transacciones

**Propósito**: Vista global de todas las transacciones financieras

**Funcionalidades**:
- **Lista Completa**: Todas las transacciones del sistema
- **Filtros Avanzados**:
  - Por tipo de socio (mina, comprador, volquetero, RodMar)
  - Por concepto
  - Por forma de pago
  - Por rango de fechas
  - Por rango de valores
  - Búsqueda de texto libre
  - Por voucher (con/sin)
- **Ordenamiento**: Por valor o fecha (ascendente/descendente)
- **Acciones**:
  - Crear nueva transacción (botón flotante)
  - Editar transacción
  - Eliminar transacción
  - Eliminación masiva (selección múltiple)
  - Exportar a Excel (solo transacciones filtradas)
- **Paginación**: Con opción "Todo" para cargar todas y buscar client-side

**Sistema de Transacciones Bidireccional**:
- **De Quién** (`deQuienTipo`, `deQuienId`): Origen del dinero
- **Para Quién** (`paraQuienTipo`, `paraQuienId`): Destino del dinero
- Soporta: `rodmar`, `mina`, `comprador`, `volquetero`, `banco`, `lcdm`, `postobon`

**Tipos de Transacciones**:
- **Manual**: Creadas manualmente por el usuario
- **Inversión**: Movimientos entre cuentas RodMar (Postobón, LCDM, etc.)

---

### 6. 👤 RodMar (Perfil y Cuentas)

**Propósito**: Panel de administración y cuentas internas

**Funcionalidades**:

#### **Mis Cuentas**:
- **Cuentas RodMar**:
  - **Bemovil**: Cuenta principal de movimientos
  - **Corresponsal**: Cuenta de corresponsalía
  - **Efectivo**: Manejo de efectivo
  - **Cuentas German**: Cuentas personales
  - **Cuentas Jhon**: Cuentas personales
  - **Otros**: Otras cuentas misceláneas
- **Cuentas Postobón**:
  - **Santa Rosa**: Cuenta específica
  - **Cimitarra**: Cuenta específica
  - **Todas**: Vista consolidada
- **Cuentas LCDM**: Vista consolidada

**Resumen Global**:
- Total de ventas, compras, fletes, ganancias
- Saldos por tipo de socio (minas, compradores, volqueteros)
- Gráficas de análisis (barras, tortas, líneas)

#### **Mi Perfil**:
- Información del usuario
- Estadísticas: total viajes, transacciones, minas, compradores, volqueteros

#### **Ajustes**:
- Cambiar nombre de empresa
- Exportar toda la app (backup)
- Reiniciar sistema
- Cambiar formato numérico
- Activar clave de acceso

---

## 🔄 Flujo de Operaciones del Negocio

### 1. Ciclo de un Viaje Completo

#### **Paso 1: Registrar Cargue**
```
Usuario ingresa:
- Fecha de cargue
- Conductor (crea volquetero automáticamente si no existe)
- Tipo de carro
- Placa
- Mina (de dónde se carga)
- Precio de compra por tonelada

Sistema:
- Genera ID automático (G1, G2, G3, etc.)
- Crea viaje con estado "pendiente"
- Calcula CUT (Compra Unitario por Tonelada) = precioCompraTon
```

#### **Paso 2: Registrar Descargue**
```
Usuario selecciona viaje pendiente e ingresa:
- Fecha de descargue
- Comprador (a quién se vende)
- Peso en toneladas
- Venta por tonelada
- Flete por tonelada
- Recibo (imagen opcional)

Sistema calcula automáticamente:
- VUT = ventaTon * peso
- CUT = precioCompraTon * peso
- FUT = fleteTon * peso
- Total Venta = VUT
- Total Compra = CUT
- Total Flete = FUT (si quienPagaFlete = "comprador")
- Valor a Consignar = Total Venta - Total Flete (si comprador paga flete)
- Ganancia = Total Venta - Total Compra - Total Flete

Actualiza viaje:
- Estado cambia a "completado"
- Guarda todos los valores calculados
```

#### **Paso 3: Impacto en Balances** (Automático)

**Balance de Mina**:
- Se incrementa en `totalCompra` (lo que RodMar debe a la mina)

**Balance de Comprador**:
- Se crea transacción dinámica con valor `-valorConsignar` (comprador debe a RodMar)
- Se muestra en la pestaña de transacciones pero no se guarda en BD

**Balance de Volquetero**:
- Si hay pago de flete, se puede registrar manualmente como transacción

---

### 2. Sistema de Transacciones

#### **Transacciones Manuales**

El usuario puede crear transacciones manuales en cualquier momento:

**Formato**:
```
De: [Tipo] [ID/Nombre]
Para: [Tipo] [ID/Nombre]
Valor: [Cantidad]
Concepto: [Auto-generado o manual]
Fecha: [Fecha]
Forma de Pago: [Efectivo, Transferencia, etc.]
Voucher: [Imagen opcional]
Comentario: [Texto opcional]
```

**Ejemplos**:
- **Pago a Mina**: De RodMar → Para Mina X (disminuye balance de mina)
- **Abono de Comprador**: De Comprador Y → Para RodMar (aumenta balance de comprador)
- **Pago a Volquetero**: De RodMar → Para Volquetero Z (disminuye balance de volquetero)

#### **Transacciones Automáticas de Viajes**

Cuando un viaje se completa:
- Se crea una transacción **virtual/dinámica** para el comprador
- No se guarda en la base de datos
- Se calcula en tiempo real desde los viajes completados
- Valor: `-valorConsignar` (negativo porque el comprador debe)

---

### 3. Cálculo de Balances

#### **Balance de Minas**

```typescript
Balance = Ingresos por Viajes + Transacciones Netas

Ingresos por Viajes = 
  Suma de totalCompra de todos los viajes completados
  donde minaId = X y estado = "completado"

Transacciones Netas =
  + Transacciones donde deQuienTipo = "mina" y deQuienId = X
    (Mina vende/recibe dinero)
  - Transacciones donde paraQuienTipo = "mina" y paraQuienId = X
    (RodMar paga a la mina)
  + Transacciones donde paraQuienTipo = "rodmar" o "banco"
    (Ingresos a RodMar desde la mina)
```

**Interpretación**:
- **Balance Positivo**: RodMar debe dinero a la mina
- **Balance Negativo**: La mina debe dinero a RodMar

#### **Balance de Compradores**

```typescript
Balance = Total Ventas - Abonos + Préstamos

Total Ventas = 
  Suma de valorConsignar de todos los viajes completados
  donde compradorId = X

Transacciones:
  + "Abono": Comprador paga a RodMar (aumenta balance)
  - "Préstamo": RodMar presta al comprador (disminuye balance)
```

**Interpretación**:
- **Balance Positivo**: Comprador debe dinero a RodMar
- **Balance Negativo**: RodMar debe dinero al comprador

#### **Balance de Volqueteros**

```typescript
Balance = (Pagos + Préstamos) * (-1) + Saldos a Favor

Transacciones:
  - "Pago" o "Préstamo": RodMar paga al volquetero
  + "Saldo a favor": Volquetero debe a RodMar
```

**Interpretación**:
- **Balance Positivo**: Volquetero debe dinero a RodMar
- **Balance Negativo**: RodMar debe dinero al volquetero

---

## 🗄️ Modelo de Datos

### Entidades Principales

#### **1. Viajes (viajes)**
```typescript
{
  id: string,                    // "G1", "G2", etc. (generado automáticamente)
  fechaCargue: Date,
  fechaDescargue: Date | null,
  conductor: string,             // Crea volquetero automáticamente
  tipoCarro: string,
  placa: string,
  minaId: number,                // Relación con mina
  compradorId: number | null,    // Relación con comprador (solo cuando completado)
  peso: decimal,
  precioCompraTon: decimal,      // Precio que RodMar paga a la mina
  ventaTon: decimal,             // Precio que comprador paga a RodMar
  fleteTon: decimal,             // Precio del flete por tonelada
  otrosGastosFlete: decimal,
  quienPagaFlete: "comprador" | "rodmar",
  // Valores calculados:
  vut: decimal,                  // Venta Unitario Total
  cut: decimal,                  // Compra Unitario Total
  fut: decimal,                  // Flete Unitario Total
  totalVenta: decimal,
  totalCompra: decimal,
  totalFlete: decimal,
  valorConsignar: decimal,       // Lo que el comprador debe consignar
  ganancia: decimal,
  recibo: string | null,         // Imagen en base64
  observaciones: string | null,
  estado: "pendiente" | "completado",
  oculta: boolean,               // Para ocultar en módulos específicos
}
```

#### **2. Transacciones (transacciones)**
```typescript
{
  id: number,
  // Sistema nuevo (bidireccional):
  deQuienTipo: "rodmar" | "mina" | "comprador" | "volquetero" | "banco" | "lcdm" | "postobon",
  deQuienId: string,             // ID o nombre específico
  paraQuienTipo: "rodmar" | "mina" | "comprador" | "volquetero" | "banco" | "lcdm" | "postobon",
  paraQuienId: string,           // ID o nombre específico
  postobonCuenta: string | null, // "santa-rosa", "cimitarra", "otras"
  // Campos principales:
  concepto: string,              // Auto-generado o manual
  valor: decimal,
  fecha: Date,
  horaInterna: Date,             // Para ordenamiento interno
  formaPago: string,
  voucher: string | null,        // Imagen en base64
  comentario: string | null,
  tipoTransaccion: "manual" | "inversion",
  // Campos de ocultación por módulo:
  oculta: boolean,                // Compatibilidad legacy
  ocultaEnComprador: boolean,
  ocultaEnMina: boolean,
  ocultaEnVolquetero: boolean,
  ocultaEnGeneral: boolean,
  // Campos legacy (compatibilidad):
  tipoSocio: string | null,
  socioId: number | null,
}
```

#### **3. Minas (minas)**
```typescript
{
  id: number,
  nombre: string,
  saldo: decimal,                // Balance calculado (puede estar desactualizado)
  balanceCalculado: decimal,     // Balance recalculado
  balanceDesactualizado: boolean,// Flag para indicar si necesita recálculo
  ultimoRecalculo: Date,
}
```

#### **4. Compradores (compradores)**
```typescript
{
  id: number,
  nombre: string,
  saldo: decimal,                // Balance calculado
  balanceCalculado: decimal,
}
```

#### **5. Volqueteros (volqueteros)**
```typescript
{
  id: number,
  nombre: string,                // Nombre del conductor
  placa: string,                 // Placa del vehículo
  saldo: decimal,                // Balance calculado
}
```

#### **6. Inversiones (inversiones)**
```typescript
{
  id: number,
  concepto: string,
  valor: decimal,
  fecha: Date,
  origen: string,                // "rodmar-cuenta", "banco", "postobon-cuenta", etc.
  origenDetalle: string | null,  // Subcuenta específica
  destino: string,
  destinoDetalle: string | null,
  observaciones: string | null,
  voucher: string | null,
}
```

---

## 🔧 Funcionalidades Avanzadas

### 1. Sistema de Ocultación

Las transacciones y viajes se pueden ocultar de manera selectiva:

- **`ocultaEnComprador`**: Oculta en módulo de compradores
- **`ocultaEnMina`**: Oculta en módulo de minas
- **`ocultaEnVolquetero`**: Oculta en módulo de volqueteros
- **`ocultaEnGeneral`**: Oculta en módulo general de transacciones

**Uso**: Permite limpiar vistas sin eliminar datos históricos.

### 2. Fusión de Entidades

Permite unificar dos entidades (minas, compradores o volqueteros) en una:

- **Proceso**:
  1. Seleccionar entidad origen y destino
  2. Sistema hace backup completo
  3. Actualiza todas las transacciones y viajes relacionados
  4. Elimina la entidad origen

- **Reversión**: Se puede revertir una fusión desde el historial

### 3. Importación/Exportación Excel

- **Importar**: Carga masiva de viajes desde Excel
- **Exportar**: Exporta viajes o transacciones filtradas a Excel
- **Validación**: Verifica duplicados y conflictos antes de importar

### 4. Actualizaciones en Tiempo Real (WebSockets)

- Cuando un usuario crea/edita/elimina una transacción o viaje
- Todos los usuarios conectados reciben actualización automática
- Los balances se recalculan en tiempo real
- No requiere refrescar la página

### 5. Caché Inteligente

- **React Query** con `staleTime` de 5 minutos
- Los datos se mantienen en caché para acceso rápido
- WebSockets invalidan el caché cuando hay cambios
- Paginación persistente en `localStorage`

---

## 📊 Cálculos Automáticos

### Al Completar un Viaje

```typescript
// Valores calculados automáticamente:
vut = ventaTon * peso
cut = precioCompraTon * peso
fut = fleteTon * peso

totalVenta = vut
totalCompra = cut

if (quienPagaFlete === "comprador") {
  totalFlete = fut + otrosGastosFlete
  valorConsignar = totalVenta - totalFlete
} else {
  totalFlete = fut + otrosGastosFlete
  valorConsignar = totalVenta
}

ganancia = totalVenta - totalCompra - totalFlete
```

### Al Crear/Editar/Eliminar Transacción

El sistema recalcula automáticamente los balances afectados:

1. Identifica qué entidades están involucradas (`deQuienTipo`, `paraQuienTipo`)
2. Recalcula el balance de cada entidad afectada
3. Actualiza la base de datos
4. Emite evento WebSocket para actualizar otros clientes

---

## 🔐 Autenticación y Sesiones

- **Autenticación**: Actualmente deshabilitada (modo desarrollo)
- **Usuario Principal**: Se crea automáticamente (`main_user`)
- **Sesiones**: Se almacenan en PostgreSQL o memoria según configuración
- **Cookies**: `rodmar.sid` con duración de 24 horas

---

## 🌐 API Endpoints Principales

### Viajes
- `GET /api/viajes` - Lista de viajes (con paginación)
- `GET /api/viajes/:id` - Detalle de un viaje
- `POST /api/viajes` - Crear viaje
- `PATCH /api/viajes/:id` - Actualizar viaje
- `DELETE /api/viajes/:id` - Eliminar viaje
- `POST /api/viajes/bulk-import` - Importar múltiples viajes

### Transacciones
- `GET /api/transacciones` - Lista de transacciones (con paginación)
- `GET /api/transacciones/:id` - Detalle de una transacción
- `POST /api/transacciones` - Crear transacción
- `PATCH /api/transacciones/:id` - Actualizar transacción
- `DELETE /api/transacciones/:id` - Eliminar transacción
- `PATCH /api/transacciones/:id/hide` - Ocultar transacción
- `PATCH /api/transacciones/:id/hide-comprador` - Ocultar en módulo compradores
- `PATCH /api/transacciones/:id/hide-mina` - Ocultar en módulo minas
- `PATCH /api/transacciones/:id/hide-volquetero` - Ocultar en módulo volqueteros

### Minas
- `GET /api/minas` - Lista de minas
- `GET /api/minas/:id` - Detalle de una mina
- `POST /api/minas` - Crear mina
- `PATCH /api/minas/:id` - Actualizar mina
- `DELETE /api/minas/:id` - Eliminar mina
- `GET /api/minas/:id/balance` - Balance calculado de una mina
- `GET /api/transacciones/socio/mina/:id` - Transacciones de una mina

### Compradores
- `GET /api/compradores` - Lista de compradores
- `GET /api/compradores/:id` - Detalle de un comprador
- `POST /api/compradores` - Crear comprador
- `PATCH /api/compradores/:id` - Actualizar comprador
- `DELETE /api/compradores/:id` - Eliminar comprador
- `GET /api/transacciones/comprador/:id` - Transacciones de un comprador
- `GET /api/viajes/comprador/:id` - Viajes de un comprador

### Volqueteros
- `GET /api/volqueteros` - Lista de volqueteros
- `GET /api/volqueteros/:id` - Detalle de un volquetero
- `POST /api/volqueteros` - Crear volquetero
- `PATCH /api/volqueteros/:id` - Actualizar volquetero
- `DELETE /api/volqueteros/:id` - Eliminar volquetero
- `GET /api/volqueteros/:id/transacciones` - Transacciones de un volquetero

### RodMar (Cuentas)
- `GET /api/rodmar-accounts` - Lista de cuentas RodMar
- `GET /api/transacciones/cuenta/:cuentaNombre` - Transacciones de una cuenta
- `GET /api/transacciones/lcdm` - Transacciones LCDM
- `GET /api/transacciones/postobon` - Transacciones Postobón

### WebSocket
- Evento `transaction-updated`: Se emite cuando hay cambios en transacciones
- Invalida automáticamente las queries afectadas en todos los clientes

---

## 🎨 Interfaz de Usuario

### Diseño Responsivo
- **Mobile-First**: Diseñado principalmente para celulares
- **Barra Inferior Fija**: Navegación entre módulos siempre visible
- **Modales**: Formularios en ventanas flotantes
- **Cards**: Información organizada en tarjetas

### Componentes Reutilizables
- `PaginationControls`: Control de paginación con opción "Todo"
- `DateFilterDropdown`: Filtros de fecha con opciones rápidas
- `SearchableSelect`: Select con búsqueda
- `ReceiptImageUpload`: Carga de imágenes de recibos/vouchers
- `TransactionDetailModal`: Modal de detalle de transacción
- `EditTransactionModal`: Modal de edición de transacción

---

## 🔄 Flujo de Datos

### 1. Carga Inicial
```
Usuario abre app
  → React Query carga datos desde API
  → Datos se guardan en caché (5 minutos)
  → WebSocket se conecta para actualizaciones
```

### 2. Crear/Editar/Eliminar
```
Usuario realiza acción
  → Frontend envía petición a Railway (apiUrl)
  → Backend procesa y actualiza BD
  → Backend emite evento WebSocket
  → Todos los clientes reciben actualización
  → React Query invalida caché automáticamente
  → UI se actualiza sin refrescar
```

### 3. Filtrado y Búsqueda
```
Usuario aplica filtros
  → Filtrado client-side sobre datos en caché
  → No requiere petición al servidor
  → Respuesta instantánea
  → Paginación client-side sobre datos filtrados
```

---

## 🚀 Optimizaciones Implementadas

### 1. Caché Agresivo
- `staleTime`: 5 minutos
- `gcTime`: 10 minutos
- `refetchOnMount`: false
- `refetchOnWindowFocus`: false

### 2. Paginación Inteligente
- Paginación server-side para carga inicial
- Opción "Todo" para cargar todas y buscar client-side
- Preferencias guardadas en `localStorage`

### 3. WebSockets para Tiempo Real
- Actualizaciones instantáneas sin polling
- Invalidación selectiva de caché
- Solo actualiza lo que cambió

### 4. Filtrado Client-Side
- Filtros se aplican sobre datos en caché
- No requiere peticiones al servidor
- Respuesta instantánea

---

## 📝 Notas de Desarrollo

### Variables de Entorno

**Frontend (Vercel)**:
- `VITE_API_URL`: URL del backend Railway (producción)

**Backend (Railway)**:
- `DATABASE_URL`: URL de conexión a PostgreSQL (Supabase)
- `SESSION_SECRET`: Clave secreta para sesiones
- `CORS_ORIGIN`: URL del frontend Vercel
- `PORT`: Puerto del servidor (opcional)

### Convenciones de Código

- **Nombres de archivos**: kebab-case (`mina-detail.tsx`)
- **Componentes**: PascalCase (`MinaDetail`)
- **Hooks**: camelCase con prefijo `use` (`useMinasBalance`)
- **Utilidades**: camelCase (`formatCurrency`)

### Estructura de Componentes

```
Componente Principal
  ├── Hooks (useQuery, useMutation)
  ├── Estado Local (useState)
  ├── Cálculos (useMemo)
  ├── Efectos (useEffect)
  └── Render (JSX)
```

---

## 🐛 Troubleshooting Común

### Problemas de Balance
- Verificar que las transacciones tengan `deQuienTipo` y `paraQuienTipo` correctos
- Recalcular balances desde el módulo correspondiente
- Verificar que los viajes estén en estado "completado"

### Problemas de Rendimiento
- Limpiar caché del navegador
- Verificar que WebSockets estén conectados
- Revisar logs del servidor para errores

### Problemas de Sincronización
- Verificar conexión WebSocket
- Forzar recarga de datos (limpiar caché)
- Verificar que `VITE_API_URL` esté configurada correctamente

---

## 📚 Referencias

- **Especificación Funcional**: `attached_assets/Pasted-Especificaci-n-Funcional-App-RodMar-...txt`
- **README Principal**: `README.md`
- **Guías de Despliegue**: `DEPLOYMENT_*.md`
- **Schema de Base de Datos**: `shared/schema.ts`

---

**Última actualización**: Después de correcciones de producción (Diciembre 2024)

