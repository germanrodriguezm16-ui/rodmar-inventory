# Documentación: Fix de Transacciones Manuales No Visibles

## Problema Identificado

Las transacciones manuales no aparecían en las páginas de detalle de minas, compradores y volqueteros. Solo se mostraban transacciones de tipo "viaje". Además, se producía un error 500 al intentar acceder a estas páginas.

### Síntomas
- Error 500 en `/api/transacciones/socio/mina/:id`
- Error 500 en `/api/transacciones/socio/comprador/:id`
- Error 500 en `/api/transacciones/socio/volquetero/:id`
- Solo aparecían transacciones de viajes, no transacciones manuales
- Error 404 al refrescar la aplicación (consecuencia del error 500)

## Causa Raíz

El problema tenía múltiples causas interrelacionadas:

### 1. Filtrado Incorrecto de Campos `ocultaEn*`
Las transacciones antiguas tienen valores `null` en los campos `ocultaEnComprador`, `ocultaEnMina`, `ocultaEnVolquetero`, y `ocultaEnGeneral`. El filtrado original usaba `eq(field, false)`, lo que excluía las transacciones con `null`, tratándolas como ocultas cuando deberían ser visibles.

### 2. Error en el Select de Drizzle-ORM
El objeto `select` contenía referencias a campos que no existían o estaban mal referenciados:
- `hasVoucher` intentaba usar `${transacciones.voucher}` que estaba excluido del select
- `updatedAt` intentaba usar `transacciones.updatedAt` que no existe en el schema

### 3. Problemas con SQL Templates
Los intentos de usar `or(isNull(...), eq(..., false))` o SQL directo con template literals causaban errores en `orderSelectedFields` de drizzle-orm.

## Soluciones Implementadas

### 1. Cambio de Estrategia de Filtrado

**Antes:** Filtrar en la consulta SQL usando condiciones complejas con `or()` y `isNull()`.

**Después:** Filtrar después de obtener los resultados en JavaScript.

**Ubicación:** `server/db-storage.ts` - función `getTransaccionesForModule`

```typescript
// NO agregar filtro de ocultas en la consulta SQL
// Filtrar DESPUÉS de obtener los resultados
if (!includeHidden) {
  const campoOculta = modulo === 'comprador' ? 'ocultaEnComprador' :
                     modulo === 'mina' ? 'ocultaEnMina' :
                     modulo === 'volquetero' ? 'ocultaEnVolquetero' :
                     'ocultaEnGeneral';
  
  uniqueResults = uniqueResults.filter((transaction: any) => {
    const valorOculta = transaction[campoOculta];
    // Incluir si es null (transacciones antiguas) o false (no oculta)
    return valorOculta === null || valorOculta === false;
  });
}
```

**Ventajas:**
- Maneja correctamente valores `null`
- Evita problemas con sintaxis SQL compleja
- Más fácil de mantener y depurar

**Desventajas:**
- Ligeramente menos eficiente si hay muchas transacciones ocultas (pero aceptable)

### 2. Corrección de Campo `hasVoucher`

**Problema:** Intentaba usar `${transacciones.voucher}` que estaba excluido del select.

**Solución:** Usar directamente `transacciones.tiene_voucher` que sí está en el select.

```typescript
// Antes (causaba error):
hasVoucher: sql<boolean>`CASE WHEN ${transacciones.voucher} IS NOT NULL AND ${transacciones.voucher} != '' THEN true ELSE false END`

// Después (correcto):
hasVoucher: transacciones.tiene_voucher
```

**Ubicación:** `server/db-storage.ts` - función `getTransaccionesForModule` (líneas 1677 y 1715)

### 3. Corrección de Campo `updatedAt`

**Problema:** Intentaba usar `transacciones.updatedAt` que no existe en el schema.

**Solución:** Usar `transacciones.horaInterna` que sí existe y se usa para ordenamiento.

```typescript
// Antes (causaba error):
updatedAt: transacciones.updatedAt

// Después (correcto):
updatedAt: transacciones.horaInterna
```

**Ubicación:** `server/db-storage.ts` - función `getTransaccionesForModule` (líneas 1672 y 1710)

### 4. Ajuste de Invalidación de Caché

**Problema:** La invalidación de caché era demasiado agresiva, invalidando queries de pendientes en cada evento `transaction-updated`.

**Solución:** Solo invalidar queries de pendientes cuando el evento específicamente indica que es una transacción pendiente.

**Ubicación:** `client/src/hooks/useSocket.ts` (líneas 50-52)

```typescript
// Antes:
queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });

// Después:
if (affectedEntityTypes.includes("pending-transactions")) {
  queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
  queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
}
```

## Archivos Modificados

1. **`server/db-storage.ts`**
   - Función `getTransaccionesForModule`: Cambio de estrategia de filtrado y corrección de campos en select
   - Logging detallado agregado para diagnóstico

2. **`server/routes.ts`**
   - Logging mejorado en endpoint `/api/transacciones/socio/:tipoSocio/:socioId`
   - Manejo de errores mejorado con más detalles

3. **`client/src/hooks/useSocket.ts`**
   - Ajuste de invalidación de caché para ser más selectiva

## Consideraciones Importantes

### Manejo de Valores Null en Campos `ocultaEn*`

**Regla:** Las transacciones con `null` en los campos `ocultaEn*` deben tratarse como **no ocultas** (visibles).

**Razón:** Las transacciones antiguas creadas antes de la implementación de estos campos tienen `null`, y deben seguir siendo visibles para mantener compatibilidad hacia atrás.

### Ordenamiento de Transacciones Completadas

Las transacciones completadas se ordenan por `horaInterna` (que se usa como `updatedAt`), no por `fecha`. Esto asegura que las transacciones más recientemente completadas aparezcan primero.

### Performance

El filtrado en JavaScript después de la consulta SQL es ligeramente menos eficiente que filtrar en SQL, pero:
- Es más simple y mantenible
- Evita problemas con sintaxis SQL compleja
- El impacto en performance es mínimo ya que el filtrado se hace en memoria

## Testing

Para verificar que el fix funciona:

1. Acceder a `/minas/:id` - Debe mostrar transacciones manuales y de viajes
2. Acceder a `/compradores/:id` - Debe mostrar transacciones manuales y de viajes
3. Acceder a `/volqueteros/:id` - Debe mostrar transacciones manuales y de viajes
4. No debe haber errores 500 en la consola del servidor
5. Las transacciones deben aparecer correctamente ordenadas

## Logs de Diagnóstico

Se agregaron logs detallados para facilitar el diagnóstico futuro:

- `🔍 [getTransaccionesForModule] Iniciando` - Parámetros de entrada
- `🔍 [getTransaccionesForModule] Ejecutando queries` - Número de condiciones
- `🔍 [getTransaccionesForModule] Queries ejecutadas` - Resultados de queries
- `🔍 [getTransaccionesForModule] Resultados únicos antes/después de filtrar` - Conteos

## Notas para Futuros Cambios

1. **Nunca usar campos en el select que no existan en el schema**
2. **Nunca referenciar campos excluidos del select en SQL templates**
3. **Siempre tratar `null` en campos `ocultaEn*` como visible (no oculta)**
4. **Considerar filtrado en JavaScript si la lógica SQL se vuelve compleja**

## Fecha de Implementación

Diciembre 2025

## Autor

Sistema de corrección automática basado en análisis de logs y errores del servidor.

