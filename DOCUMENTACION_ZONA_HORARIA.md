# Documentación: Manejo de Zona Horaria Colombiana

## ⚠️ IMPORTANTE: Zona Horaria de Colombia (UTC-5)

Al crear funciones que trabajen con fechas en esta aplicación, **SIEMPRE** se debe tener en cuenta la zona horaria colombiana (UTC-5) para evitar problemas de fechas desfasadas.

## Problema Común

Cuando se crea un objeto `Date` desde un string ISO (ej: `"2025-12-07T00:00:00.000Z"`), JavaScript interpreta la fecha en UTC. En Colombia (UTC-5), esto puede causar que:

- Una fecha guardada como `2025-12-07T00:00:00.000Z` (medianoche UTC)
- Se muestre como `2025-12-06T19:00:00` (7pm del día anterior en hora colombiana)
- Resultando en que la fecha aparezca **un día atrás** en la interfaz

## Soluciones Recomendadas

### 1. Extraer solo la parte de fecha y crear en mediodía local

```typescript
const formatDate = (dateString: string) => {
  // Extraer solo la parte de fecha para evitar problemas de zona horaria
  const dateOnly = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const [year, month, day] = dateOnly.split('-').map(Number);
  // Crear fecha en mediodía para evitar problemas de zona horaria UTC
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date;
};
```

### 2. Usar funciones existentes de `date-utils.ts`

El archivo `client/src/lib/date-utils.ts` contiene funciones que ya manejan correctamente la zona horaria:

- `formatDateWithDaySpanish()`: Formatea fecha con día de la semana en español
- `createLocalDate()`: Crea fecha local evitando problemas UTC
- `formatDateSimple()`: Formatea fecha simple sin problemas de zona horaria

### 3. Para fechas de finalización (updatedAt)

Cuando se ordenan transacciones completadas, usar directamente el campo `updatedAt` (timestamp de finalización) sin conversión, ya que este campo ya está en el formato correcto.

## Ejemplos de Implementación Correcta

### ✅ Correcto: Crear fecha en mediodía local

```typescript
const formatDate = (date: string | Date): string => {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    const dateString = date.includes('T') ? date.split('T')[0] : date;
    const [year, month, day] = dateString.split('-').map(Number);
    dateObj = new Date(year, month - 1, day, 12, 0, 0);
  } else {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    dateObj = new Date(year, month, day, 12, 0, 0);
  }
  
  // Formatear fecha...
};
```

### ❌ Incorrecto: Usar new Date() directamente con string ISO

```typescript
// ❌ Esto puede causar problemas de zona horaria
const date = new Date("2025-12-07T00:00:00.000Z");
// En Colombia, esto se mostrará como 6 de diciembre a las 7pm
```

## Archivos con Implementaciones Correctas

Los siguientes archivos ya implementan correctamente el manejo de zona horaria:

- `client/src/lib/date-utils.ts`: Funciones utilitarias de fechas
- `client/src/components/modals/transaction-receipt-modal.tsx`: Formateo de fecha en comprobante
- `client/src/components/pending-transactions/pending-detail-modal.tsx`: Formateo de fecha en detalle
- `client/src/components/pending-transactions/pending-list-modal.tsx`: Formateo de fecha en listado

## Ordenamiento de Transacciones Completadas

Las transacciones completadas se ordenan por **fecha de finalización** (`updatedAt`) en lugar de fecha de solicitud (`fecha`), para reflejar el orden real en que fueron completadas.

Esto se implementa en:
- `server/storage.ts`: Función `getTransaccionesBySocio()`
- `server/db-storage.ts`: Función `getTransaccionesForModule()`

## Checklist al Crear Funciones con Fechas

- [ ] ¿La función extrae solo la parte de fecha (YYYY-MM-DD) antes de crear el objeto Date?
- [ ] ¿Se crea la fecha en mediodía local (12:00:00) para evitar problemas UTC?
- [ ] ¿Se usa `updatedAt` para ordenar transacciones completadas?
- [ ] ¿Se prueba la función con fechas en diferentes zonas horarias?
- [ ] ¿Se documenta el manejo de zona horaria en comentarios?

## Referencias

- [MDN: Date](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Date)
- [Zona horaria de Colombia](https://es.wikipedia.org/wiki/Hora_de_Colombia)
- Archivo de utilidades: `client/src/lib/date-utils.ts`

