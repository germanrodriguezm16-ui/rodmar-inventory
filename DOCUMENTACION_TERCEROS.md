# Documentación del Módulo de Terceros

## Descripción General

El módulo de Terceros permite gestionar relaciones financieras con entidades externas a RodMar (empresas, proveedores, clientes, etc.). Los terceros pueden realizar todas las transacciones con todas las demás entidades del sistema, siguiendo la misma lógica de balance que minas y compradores.

## Funcionalidades Implementadas

### 1. Gestión de Terceros (CRUD)
- ✅ Crear nuevos terceros
- ✅ Listar todos los terceros con balance calculado dinámicamente
- ✅ Ver detalles de un tercero específico
- ✅ Editar nombre de tercero
- ✅ Eliminar terceros
- ✅ Visualización de transacciones por tercero

### 2. Transacciones con Terceros
- ✅ Los terceros pueden realizar transacciones con todas las entidades:
  - RodMar (cuentas)
  - Minas
  - Compradores
  - Volqueteros
  - Bancos
  - LCDM
  - Postobón
  - Otros terceros
- ✅ Creación de transacciones desde cualquier modal de transacciones
- ✅ Edición de transacciones que involucran terceros
- ✅ Eliminación de transacciones que involucran terceros
- ✅ Solicitud de transacciones hacia terceros
- ✅ Completar transacciones pendientes con terceros

### 3. Cálculo de Balances
- ✅ Balance calculado dinámicamente basado en transacciones
- ✅ **Lógica de balance:**
  - **Positivos (Verde):** RodMar le debe dinero al tercero
    - Transacciones donde `deQuienTipo === 'tercero'` y `deQuienId === terceroId`
    - El tercero es el origen (RodMar recibe dinero del tercero)
  - **Negativos (Rojo):** El tercero le debe dinero a RodMar
    - Transacciones donde `paraQuienTipo === 'tercero'` y `paraQuienId === terceroId`
    - El tercero es el destino (RodMar le paga al tercero)
- ✅ Invalidación y actualización en tiempo real mediante WebSockets
- ✅ Refetch automático cuando se crean, editan o eliminan transacciones

### 4. Vista de Detalles
- ✅ Página de detalle de tercero (`/terceros/:id`)
- ✅ Resumen de transacciones (total, positivos, negativos, balance)
- ✅ Filtros de fecha y búsqueda
- ✅ Paginación de transacciones
- ✅ Transacciones temporales
- ✅ Ocultamiento local de transacciones
- ✅ Acciones rápidas (editar, eliminar, ocultar)

### 5. Imagen Descargable
- ✅ Botón "Imagen" en la página de detalle de tercero
- ✅ Modal de vista previa de imagen descargable (`TerceroTransaccionesImageModal`)
- ✅ Generación de imagen PNG usando html2canvas
- ✅ Formato optimizado para impresión y compartir
- ✅ Incluye resumen de balances y lista completa de transacciones

### 6. Integración en Módulo RodMar
- ✅ Tab "Terceros" en el módulo RodMar
- ✅ Listado de terceros con balance
- ✅ Navegación desde listado a página de detalle
- ✅ Modal para agregar nuevos terceros
- ✅ Navegación mejorada: botón "atrás" desde detalle vuelve a la lista de terceros (usando query parameter `?tab=terceros`)

### 7. Compartir Comprobante
- ✅ Nombre del tercero (no ID) en modal de compartir comprobante
- ✅ Integración completa con `TransactionReceiptModal`

## Estructura de Base de Datos

### Tabla: `terceros`

```sql
CREATE TABLE IF NOT EXISTS terceros (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  saldo DECIMAL(15, 2) DEFAULT '0',
  balance_calculado DECIMAL(15, 2) DEFAULT '0',
  balance_desactualizado BOOLEAN DEFAULT false NOT NULL,
  ultimo_recalculo TIMESTAMP DEFAULT NOW(),
  user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terceros_user_id ON terceros(user_id);
```

### Campos

- `id`: Identificador único (serial)
- `nombre`: Nombre del tercero (texto, requerido)
- `saldo`: Saldo almacenado (decimal, no se usa actualmente - se calcula dinámicamente)
- `balance_calculado`: Balance calculado (decimal, no se usa actualmente)
- `balance_desactualizado`: Flag para indicar si el balance está desactualizado (boolean)
- `ultimo_recalculo`: Timestamp del último recálculo (timestamp)
- `user_id`: ID del usuario que creó el tercero (varchar, referencia a users)
- `created_at`: Fecha de creación (timestamp)

**Nota:** Los campos `saldo`, `balance_calculado`, `balance_desactualizado` y `ultimo_recalculo` están presentes por consistencia con otras entidades, pero actualmente el balance se calcula dinámicamente en tiempo real.

## Esquema de Validación (Zod)

### `insertTerceroSchema`
```typescript
{
  nombre: string (min 1, trim)
}
```

### `updateTerceroNombreSchema`
```typescript
{
  nombre: string (min 1, trim)
}
```

### `insertTransaccionSchema`
```typescript
{
  deQuienTipo: "rodmar" | "comprador" | "volquetero" | "mina" | "banco" | "lcdm" | "postobon" | "tercero",
  deQuienId: string,
  paraQuienTipo: "rodmar" | "comprador" | "volquetero" | "mina" | "banco" | "lcdm" | "postobon" | "tercero",
  paraQuienId: string,
  // ... otros campos
}
```

## API Endpoints

### GET `/api/terceros`
Obtiene todos los terceros del usuario autenticado con balance calculado dinámicamente.

**Respuesta:**
```typescript
Array<{
  id: number,
  nombre: string,
  balance: number, // Calculado dinámicamente
  // ... otros campos
}>
```

**Lógica de cálculo de balance:**
- Itera sobre todas las transacciones
- Positivos: `transaccion.deQuienTipo === 'tercero' && transaccion.deQuienId === terceroId`
- Negativos: `transaccion.paraQuienTipo === 'tercero' && transaccion.paraQuienId === terceroId`
- Balance = Positivos - Negativos

### GET `/api/terceros/:id`
Obtiene un tercero específico por ID.

### POST `/api/terceros`
Crea un nuevo tercero.

**Body:**
```typescript
{
  nombre: string
}
```

### PATCH `/api/terceros/:id/nombre`
Actualiza el nombre de un tercero.

**Body:**
```typescript
{
  nombre: string
}
```

### DELETE `/api/terceros/:id`
Elimina un tercero.

### GET `/api/terceros/:id/transacciones`
Obtiene todas las transacciones relacionadas con un tercero específico.

**Respuesta:**
```typescript
Array<TransaccionWithSocio>
```

## Componentes Frontend

### Páginas

#### `client/src/pages/tercero-detail.tsx`
Página de detalle de un tercero específico.

**Funcionalidades:**
- Header con nombre del tercero y botón de navegación
- Resumen de transacciones (total, positivos, negativos, balance)
- Filtros de fecha y búsqueda
- Lista paginada de transacciones
- Acciones rápidas (editar, eliminar, ocultar)
- Transacciones temporales
- Botón "Imagen" para generar vista previa descargable

**Navegación:**
- Botón "atrás" navega a `/rodmar?tab=terceros`

### Componentes Modales

#### `client/src/components/modals/add-tercero-modal.tsx`
Modal para agregar un nuevo tercero.

**Funcionalidades:**
- Formulario con campo "nombre"
- Validación con Zod
- Integración con React Query para mutación
- Invalidación y refetch de queries

#### `client/src/components/modals/tercero-transacciones-image-modal.tsx`
Modal para generar imagen descargable de transacciones de un tercero.

**Funcionalidades:**
- Vista previa de imagen
- Resumen de balances (positivos, negativos, balance total)
- Tabla de transacciones formateada
- Generación de PNG usando html2canvas
- Tamaño optimizado para impresión
- Tabla clonada fuera de pantalla para mejor calidad de exportación

### Integraciones en Otros Componentes

#### Modales de Transacciones

**`client/src/components/forms/new-transaction-modal.tsx`**
- Soporte para `deQuienTipo: 'tercero'` y `paraQuienTipo: 'tercero'`
- Carga lista de terceros
- Selector de terceros en formulario
- Invalidación de queries de terceros después de crear transacción

**`client/src/components/forms/edit-transaction-modal.tsx`**
- Soporte para editar transacciones que involucran terceros
- Invalidación selectiva de queries de terceros afectados
- Refetch forzado incluso si la query no está activa

**`client/src/components/forms/delete-transaction-modal.tsx`**
- Soporte para eliminar transacciones que involucran terceros
- Invalidación de queries de terceros afectados
- Refetch forzado

**`client/src/components/modals/complete-transaction-modal.tsx`**
- Soporte para completar transacciones pendientes hacia terceros
- Selector de terceros en formulario

**`client/src/components/modals/solicitar-transaccion-modal.tsx`**
- Soporte para solicitar transacciones hacia terceros
- Selector de terceros en formulario

**`client/src/components/modals/transaction-receipt-modal.tsx`**
- Muestra nombre del tercero (no ID) en el comprobante
- Integración con `getSocioNombre` para obtener nombre del tercero

### Utilidades

#### `client/src/lib/getSocioNombre.ts`
Función helper para obtener el nombre de un socio basado en su tipo e ID.

**Soporte para terceros:**
```typescript
case 'tercero':
  if (terceros) {
    const tercero = terceros.find(t => t.id.toString() === idStr);
    return tercero?.nombre || null;
  }
  return null;
```

## Lógica de Balance

### Cálculo Dinámico

El balance se calcula dinámicamente en dos lugares:

1. **En el backend (`GET /api/terceros`):**
   - Itera sobre todas las transacciones
   - Calcula positivos y negativos según las reglas
   - Retorna balance para cada tercero

2. **En el frontend (`tercero-detail.tsx`):**
   - Calcula balance basado en transacciones filtradas
   - Muestra resumen en tiempo real

### Reglas de Balance

**Positivos (Verde):** RodMar le debe dinero al tercero
```typescript
if (transaccion.deQuienTipo === 'tercero' && 
    transaccion.deQuienId === terceroId.toString()) {
  positivos += valor;
}
```

**Negativos (Rojo):** El tercero le debe dinero a RodMar
```typescript
if (transaccion.paraQuienTipo === 'tercero' && 
    transaccion.paraQuienId === terceroId.toString()) {
  negativos += valor;
}
```

**Balance Final:**
```typescript
balance = positivos - negativos
```

## Invalidación y Actualización en Tiempo Real

### WebSockets

El hook `useSocket.ts` maneja invalidación en tiempo real:

```typescript
if (affectedEntityTypes.includes("tercero")) {
  queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
  queryClient.refetchQueries({ queryKey: ["/api/terceros"] });
  // Invalidación de queries específicas de terceros
  queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return Array.isArray(queryKey) &&
        queryKey.length > 0 &&
        typeof queryKey[0] === "string" &&
        queryKey[0].startsWith("/api/terceros/");
    },
  });
}
```

### Invalidación en Modales de Transacciones

**Después de crear/editar/eliminar transacción:**
- Invalidación de `["/api/terceros"]` (lista general)
- Invalidación de `[`/api/terceros/${id}/transacciones`]` (transacciones específicas)
- Refetch forzado con `type: 'all'` para asegurar actualización incluso si la query no está activa

## Navegación

### Query Parameters

El módulo RodMar soporta query parameters para especificar el tab activo:

- `/rodmar` → Tab "Cuentas" (default)
- `/rodmar?tab=terceros` → Tab "Terceros"
- `/rodmar?tab=balances` → Tab "Balances"
- etc.

**Implementación en `rodmar.tsx`:**
```typescript
const getInitialTab = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab');
  // Validación y retorno del tab apropiado
};

const [activeTab, setActiveTab] = useState<string>(getInitialTab());

<Tabs value={activeTab} onValueChange={setActiveTab}>
```

### Navegación desde Detalle de Tercero

Desde `tercero-detail.tsx`, el botón "atrás" navega a:
```typescript
setLocation("/rodmar?tab=terceros")
```

Esto asegura que el usuario vea directamente el listado de terceros al volver.

## Rutas

### Frontend Routes (App.tsx)

```typescript
<Route path="/terceros/:id" component={TerceroDetail} />
```

### Módulo RodMar

El listado de terceros está integrado en:
- Ruta: `/rodmar`
- Tab: "Terceros"
- Acceso: `module.RODMAR.accounts.view`

## Permisos

### Permisos Requeridos

- **Ver listado de terceros:** `module.RODMAR.accounts.view`
- **Crear terceros:** `module.RODMAR.accounts.view` (mismo permiso)
- **Gestionar transacciones:** `action.TRANSACCIONES.create`, `action.TRANSACCIONES.edit`, etc.

## Migraciones

### SQL Migration

Archivo: `migrations/create-terceros-table.sql`

```sql
CREATE TABLE IF NOT EXISTS terceros (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  saldo DECIMAL(15, 2) DEFAULT '0',
  balance_calculado DECIMAL(15, 2) DEFAULT '0',
  balance_desactualizado BOOLEAN DEFAULT false NOT NULL,
  ultimo_recalculo TIMESTAMP DEFAULT NOW(),
  user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terceros_user_id ON terceros(user_id);
```

**Nota:** Esta migración debe ejecutarse manualmente en la base de datos de producción.

## Consideraciones de Diseño

### Balance Dinámico vs. Pre-calculado

El balance se calcula dinámicamente en lugar de usar los campos `saldo` y `balance_calculado` de la base de datos. Esto asegura:
- ✅ Siempre datos actualizados
- ✅ Menos complejidad de sincronización
- ✅ Mejor rendimiento en lectura (no necesita recálculo)

### Invalidación Agresiva

Las queries de terceros se invalidan y refetchean agresivamente después de cualquier operación de transacciones para asegurar:
- ✅ Datos actualizados en tiempo real
- ✅ Sincronización entre múltiples clientes (vía WebSockets)
- ✅ Actualización incluso si el usuario está en otra página

### Navegación con Query Parameters

El uso de query parameters para controlar el tab activo permite:
- ✅ URLs compartibles
- ✅ Navegación intuitiva desde páginas de detalle
- ✅ Mantener contexto al navegar

## Próximas Mejoras Potenciales

- [ ] Implementar recálculo asíncrono de balances para mejorar rendimiento
- [ ] Agregar campos adicionales a terceros (contacto, dirección, etc.)
- [ ] Implementar categorización de terceros
- [ ] Agregar reportes específicos para terceros
- [ ] Implementar exportación a Excel de transacciones de terceros

