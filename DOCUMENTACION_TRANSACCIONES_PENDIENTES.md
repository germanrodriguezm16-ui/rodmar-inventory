# Documentación: Sistema de Transacciones Pendientes

## Resumen General

Se ha implementado un sistema completo de gestión de transacciones pendientes que permite a los socios administrativos (como Pato) solicitar pagos que serán completados posteriormente por el usuario principal. Este sistema incluye:

- **Solicitud de transacciones**: Los socios pueden crear solicitudes de pago sin completar todos los datos
- **Gestión de pendientes**: Visualización y gestión de todas las transacciones pendientes
- **Completar transacciones**: El usuario puede completar las solicitudes pendientes agregando los datos faltantes

## Arquitectura

### Base de Datos

Se agregaron los siguientes campos a la tabla `transacciones`:

```sql
estado: text NOT NULL DEFAULT 'completada'  -- 'pendiente' o 'completada'
detalle_solicitud: text                      -- Información de WhatsApp (cuenta, banco, etc.)
codigo_solicitud: varchar(50)                -- Código único tipo TX-123, MP-348
tiene_voucher: boolean NOT NULL DEFAULT false -- Indica si tiene voucher adjunto
```

**Migración SQL**: Ver `migrations/add-pending-transaction-fields.sql`

### Estados de Transacción

- **`pendiente`**: Transacción solicitada pero no completada. No afecta balances.
- **`completada`**: Transacción finalizada con todos los datos. Afecta balances.

## Componentes Frontend

### 1. SolicitarTransaccionModal

**Ubicación**: `client/src/components/modals/solicitar-transaccion-modal.tsx`

**Propósito**: Modal para crear o editar solicitudes de transacción pendiente.

**Campos**:
- **Para quién**: Destino de la transacción (Mina, Comprador, Volquetero, etc.)
- **Valor**: Monto de la transacción (con separadores de miles)
- **Comentarios**: Notas adicionales
- **Datos de la cuenta**: Información de WhatsApp (cuenta, banco, etc.) - `detalle_solicitud`

**Características**:
- Diseño compacto con gradiente naranja/ámbar
- Bordes definidos, no ocupa toda la pantalla
- Fechas en formato colombiano
- Teclado numérico en móvil para el campo "Valor"
- Soporte para edición de transacciones existentes

**Flujo**:
1. Usuario llena los campos requeridos
2. Al confirmar, se crea una transacción con `estado: 'pendiente'`
3. Se genera un código único tipo `TX-123` o `MP-348`
4. Se genera concepto automático: `"Solicitud de pago a Tipo (Nombre)"`

### 2. PendingListModal

**Ubicación**: `client/src/components/pending-transactions/pending-list-modal.tsx`

**Propósito**: Modal que lista todas las transacciones pendientes.

**Características**:
- Diseño compacto con gradiente naranja/ámbar
- Tarjetas compactas mostrando: código, fecha, concepto, valor
- Refresco automático cada 30 segundos
- Al hacer clic en una tarjeta, abre `PendingDetailModal`

### 3. PendingDetailModal

**Ubicación**: `client/src/components/pending-transactions/pending-detail-modal.tsx`

**Propósito**: Modal que muestra los detalles completos de una transacción pendiente.

**Información mostrada**:
- Código de solicitud
- Concepto
- Valor
- Fecha
- Destino (Para quién)
- Comentarios
- Datos de la cuenta (con botón "Copiar")

**Acciones disponibles**:
- **Editar**: Abre `SolicitarTransaccionModal` con los datos pre-llenados
- **Eliminar**: Elimina la transacción pendiente (con confirmación)
- **Completar**: Abre `CompleteTransactionModal`

### 4. CompleteTransactionModal

**Ubicación**: `client/src/components/modals/complete-transaction-modal.tsx`

**Propósito**: Modal para completar una transacción pendiente agregando los datos faltantes.

**Campos**:
- **Origen (De quién)**: Origen de la transacción (Mina, Comprador, Volquetero, RodMar, Banco, LCDM, Postobón)
- **Fecha**: Fecha de la transacción (por defecto fecha actual colombiana)
- **Forma de Pago**: Efectivo, Transferencia, Consignación, Otros
- **Voucher**: Opcional - con opciones de cámara y subir archivo

**Características**:
- Diseño compacto con gradiente verde/esmeralda
- Bordes definidos, no ocupa toda la pantalla
- Botón de confirmación verde
- Solo muestra los campos faltantes (no repite datos de la solicitud)

**Flujo**:
1. Usuario completa los campos faltantes
2. Al confirmar, se actualiza la transacción:
   - `estado`: cambia de `'pendiente'` a `'completada'`
   - Se agregan: `deQuienTipo`, `deQuienId`, `formaPago`, `fecha`, `voucher`
   - Se genera nuevo concepto: `"${formaPago} de ${deQuienTipo} (${deQuienNombre}) a ${paraQuienTipo} (${paraQuienNombre})"`
3. Se actualizan los balances de los socios afectados
4. La transacción desaparece de la lista de pendientes

### 5. GestionarTransaccionesModal

**Ubicación**: `client/src/components/modals/gestionar-transacciones-modal.tsx`

**Propósito**: Modal central para gestionar transacciones.

**Botones**:
- **Crear** (azul): Abre `NewTransactionModal` para crear transacción completa
- **Solicitar** (naranja): Abre `SolicitarTransaccionModal` para crear solicitud pendiente
- **Completar** (verde): Abre `PendingListModal` para ver y completar pendientes

### 6. Floating Action Button (FAB)

**Ubicación**: `client/src/pages/dashboard.tsx`

**Comportamiento**:
- **Sin pendientes**: Muestra icono "+" (Plus) en color normal
- **Con pendientes**: Muestra letra "P" en color naranja con animación de parpadeo
- Al hacer clic, abre `GestionarTransaccionesModal`

## Endpoints Backend

### POST `/api/transacciones/solicitar`

Crea una nueva transacción pendiente.

**Body**:
```json
{
  "paraQuienTipo": "mina",
  "paraQuienId": "123",
  "valor": "1000000",
  "fecha": "2024-01-15",
  "comentario": "Pago de materiales",
  "detalle_solicitud": "Banco: Bancolombia\nCuenta: 123456789\nTitular: Juan Pérez"
}
```

**Respuesta**: Transacción creada con `estado: 'pendiente'`

### GET `/api/transacciones/pendientes`

Obtiene todas las transacciones pendientes del usuario.

**Respuesta**: Array de transacciones con `estado: 'pendiente'`

### GET `/api/transacciones/pendientes/count`

Cuenta las transacciones pendientes del usuario.

**Respuesta**: `{ count: number }`

### PUT `/api/transacciones/:id/completar`

Completa una transacción pendiente.

**Body**:
```json
{
  "deQuienTipo": "rodmar",
  "deQuienId": "bemovil",
  "formaPago": "Transferencia",
  "fecha": "2024-01-15",
  "voucher": "VOUCHER-123" // Opcional
}
```

**Respuesta**: Transacción actualizada con `estado: 'completada'`

### PATCH `/api/transacciones/:id`

Actualiza una transacción pendiente (para edición).

**Body**: Similar a crear solicitud, pero solo con los campos a actualizar.

## Funciones Backend

### `createTransaccionPendiente()`

**Ubicación**: `server/db-storage.ts`

Crea una transacción con `estado: 'pendiente'`. No actualiza balances.

**Características**:
- Genera código único tipo `TX-{id}` o `MP-{id}`
- Genera concepto automático: `"Solicitud de pago a Tipo (Nombre)"`
- No requiere `deQuienTipo` ni `deQuienId`

### `getTransaccionesPendientes()`

**Ubicación**: `server/db-storage.ts`

Obtiene todas las transacciones pendientes del usuario.

### `countTransaccionesPendientes()`

**Ubicación**: `server/db-storage.ts`

Cuenta las transacciones pendientes del usuario.

### `completarTransaccionPendiente()`

**Ubicación**: `server/db-storage.ts`

Completa una transacción pendiente.

**Proceso**:
1. Verifica que la transacción existe y está pendiente
2. Actualiza los campos faltantes (`deQuienTipo`, `deQuienId`, `formaPago`, `fecha`, `voucher`)
3. Genera nuevo concepto con formato: `"${formaPago} de ${deQuienTipo} (${deQuienNombre}) a ${paraQuienTipo} (${paraQuienNombre})"`
4. Cambia `estado` a `'completada'`
5. Actualiza `tiene_voucher` si se proporciona voucher
6. Actualiza balances de los socios afectados

### Cálculo de Balances

**Importante**: Las transacciones con `estado: 'pendiente'` **NO** afectan los balances.

Las funciones de cálculo de balances (`getMinasBalances`, `getCompradoresBalances`, `getVolqueterosBalances`) excluyen transacciones pendientes usando:

```typescript
.ne(transacciones.estado, 'pendiente')
```

## Flujo Completo

### 1. Solicitar Transacción (Pato)

1. Pato recibe solicitud de pago vía WhatsApp
2. Pato abre RodMar y toca el FAB (botón flotante)
3. Si hay pendientes, el FAB muestra "P" naranja parpadeante
4. Toca "Solicitar" en el modal de gestión
5. Llena el formulario:
   - Para quién: Selecciona el socio destino
   - Valor: Ingresa el monto
   - Comentarios: Notas adicionales
   - Datos de la cuenta: Pega la información de WhatsApp
6. Confirma la solicitud
7. Se crea la transacción pendiente
8. El FAB cambia a "P" naranja (si no había pendientes antes)

### 2. Ver Transacciones Pendientes

1. Usuario ve el FAB con "P" naranja
2. Toca el FAB
3. Toca "Completar" en el modal de gestión
4. Se abre la lista de transacciones pendientes
5. Usuario puede:
   - Ver detalles de cada pendiente
   - Editar una solicitud
   - Eliminar una solicitud
   - Completar una solicitud

### 3. Completar Transacción (Usuario)

1. Usuario ve una transacción pendiente
2. Toca "Completar" en el modal de detalles
3. Se abre el modal de completar con campos:
   - Origen: Selecciona de dónde viene el dinero
   - Fecha: Fecha de la transacción
   - Forma de Pago: Selecciona el método
   - Voucher: Opcional - puede tomar foto o subir archivo
4. Confirma la transacción
5. La transacción cambia a `completada`
6. Se actualizan los balances
7. La transacción desaparece de la lista de pendientes
8. El FAB vuelve a "+" si no quedan pendientes

## Indicadores Visuales

### Transacciones Pendientes

- **Color naranja**: Todas las tarjetas de transacciones pendientes aparecen con fondo naranja claro y borde naranja
- **Etiqueta "Pendiente"**: Se muestra en las tarjetas
- **No afectan balances**: Visualmente se distinguen de las transacciones completadas

### FAB (Floating Action Button)

- **Sin pendientes**: Icono "+" normal
- **Con pendientes**: Letra "P" naranja con animación de parpadeo

## Mejoras de UX

### Teclado Numérico en Móvil

Los campos de valor ahora abren el teclado numérico en dispositivos móviles usando `inputMode="numeric"`.

**Aplicado en**:
- `NewTransactionModal` (Valor)
- `EditTransactionModal` (Valor)
- `SolicitarTransaccionModal` (Valor)
- `RegisterCargueModal` (Precio de Compra)
- `RegisterDescargueModal` (Venta/Ton, Flete/Ton, Otros Gastos)

### Separadores de Miles

Los campos numéricos muestran separadores de miles (puntos) para mejor legibilidad.

**Funciones**:
- `formatNumber()`: Formatea un número con separadores
- `getNumericValue()`: Extrae el valor numérico sin formato

**Aplicado en**:
- Campos de valor en modales de transacciones
- Campos de precios en modales de viajes

## Integración en Módulos

El sistema de transacciones pendientes está integrado en todos los módulos:

### Minas (`mina-detail.tsx`)
- Muestra transacciones pendientes en naranja
- Permite editar/eliminar/completar desde el detalle de la mina
- Al hacer clic en una pendiente, abre `PendingDetailModal`

### Compradores (`comprador-detail.tsx`)
- Muestra transacciones pendientes en naranja
- Permite editar/eliminar/completar desde el detalle del comprador
- Al hacer clic en una pendiente, abre `PendingDetailModal`

### Volqueteros (`volquetero-detail.tsx`)
- Muestra transacciones pendientes en naranja
- Permite editar/eliminar/completar desde el detalle del volquetero
- Al hacer clic en una pendiente, abre `PendingDetailModal`

### Transacciones (`transacciones.tsx`)
- Muestra todas las transacciones pendientes en naranja
- Permite editar/eliminar/completar desde el módulo general
- Al hacer clic en una pendiente, abre `PendingDetailModal`

## Notas Técnicas

### Generación de Códigos

Los códigos de solicitud se generan automáticamente con el formato:
- `TX-{id}` para transacciones generales
- `MP-{id}` para transacciones de minas (si aplica)

### Conceptos Automáticos

**Al crear solicitud**:
```
"Solicitud de pago a Tipo (Nombre)"
```

**Al completar**:
```
"${formaPago} de ${deQuienTipo} (${deQuienNombre}) a ${paraQuienTipo} (${paraQuienNombre})"
```

### Manejo de Fechas

- Todas las fechas se manejan en formato colombiano (UTC-5)
- Las fechas se convierten correctamente de string `YYYY-MM-DD` a objeto `Date`
- El backend acepta fechas como string o Date

### Invalidación de Queries

Al completar una transacción, se invalidan las siguientes queries:
- `/api/transacciones/pendientes`
- `/api/transacciones/pendientes/count`
- `/api/transacciones`
- Queries específicas del socio destino afectado

## Próximas Mejoras

1. **Notificaciones Push**: Enviar notificaciones cuando se crea una nueva solicitud pendiente
2. **Integración Android Share**: Permitir compartir screenshots desde Android directamente a RodMar para adjuntar vouchers
3. **Historial de Completadas**: Mostrar historial de transacciones que fueron completadas desde pendientes

## Archivos Modificados

### Frontend
- `client/src/components/modals/solicitar-transaccion-modal.tsx` (NUEVO)
- `client/src/components/modals/complete-transaction-modal.tsx` (NUEVO)
- `client/src/components/modals/gestionar-transacciones-modal.tsx` (NUEVO)
- `client/src/components/pending-transactions/pending-list-modal.tsx` (NUEVO)
- `client/src/components/pending-transactions/pending-detail-modal.tsx` (NUEVO)
- `client/src/components/forms/new-transaction-modal.tsx` (MODIFICADO)
- `client/src/pages/dashboard.tsx` (MODIFICADO)
- `client/src/pages/mina-detail.tsx` (MODIFICADO)
- `client/src/pages/comprador-detail.tsx` (MODIFICADO)
- `client/src/pages/volquetero-detail.tsx` (MODIFICADO)
- `client/src/pages/transacciones.tsx` (MODIFICADO)

### Backend
- `server/db-storage.ts` (MODIFICADO)
- `server/routes.ts` (MODIFICADO)
- `server/storage.ts` (MODIFICADO)

### Base de Datos
- `migrations/add-pending-transaction-fields.sql` (NUEVO)

## Migración de Base de Datos

Para aplicar los cambios en producción, ejecutar el script SQL:

```sql
-- Ver migrations/add-pending-transaction-fields.sql
```

Este script agrega las columnas necesarias de forma segura (verifica si ya existen antes de agregarlas).

---

**Última actualización**: Enero 2024
**Versión**: 1.0.0

