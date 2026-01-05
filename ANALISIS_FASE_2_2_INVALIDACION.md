# Análisis Fase 2.2: Unificación de Lógica de Invalidación de Queries

## ⚠️ ADVERTENCIA: Fase de Riesgo Medio-Alto

Esta fase afecta cómo se actualizan los datos en tiempo real. Si algo falla, los balances y listados no se actualizarían correctamente cuando se crean/editan/eliminan transacciones.

---

## Problema Identificado

La lógica para invalidar queries cuando se crean/editan/eliminan transacciones está **muy duplicada** en 4 archivos diferentes. Cada uno tiene código muy similar pero con variaciones y casos especiales.

**Cantidad de código duplicado:** ~300-400 líneas estimadas

---

## 📍 Lugares donde está la lógica duplicada:

### 1. `new-transaction-modal.tsx` (líneas 287-436)

**Qué hace:**
- Cuando se crea una transacción, invalida las queries de las entidades afectadas
- Detecta qué tipos de entidades están involucradas (mina, comprador, volquetero, tercero, lcdm, postobon, rodmar)
- Invalida queries específicas de cada entidad afectada
- Maneja casos especiales (minaActual, compradorId desde props)

**Lógica principal:**
```typescript
// Siempre invalidar transacciones generales
queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });

// Por cada tipo de entidad afectada:
if (data.deQuienTipo === 'mina' || data.paraQuienTipo === 'mina') {
  queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
  queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] });
  
  // Invalidar queries específicas de la mina afectada
  const minaIdAffected = data.deQuienTipo === 'mina' ? data.deQuienId : data.paraQuienId;
  if (minaIdAffected) {
    queryClient.invalidateQueries({ queryKey: ["/api/transacciones/mina", parseInt(minaIdAffected)] });
    // ... más invalidaciones específicas
  }
  
  // Caso especial: minaActual desde props
  if (minaActual) {
    queryClient.invalidateQueries({ queryKey: ["/api/transacciones/mina", minaActual.id] });
  }
}

// Repetir para: comprador, volquetero, tercero, lcdm, postobon, rodmar...
```

**Tamaño:** ~150 líneas de código

---

### 2. `edit-transaction-modal.tsx` (líneas 356-711)

**Qué hace:**
- Cuando se edita una transacción, invalida las queries de las entidades afectadas (tanto originales como nuevas)
- Usa un `Set` de `affectedEntityTypes` para rastrear qué entidades están involucradas
- Maneja casos donde la transacción cambia de entidad (ej: de mina A a mina B)
- Invalida queries de ambas entidades (original y nueva)

**Lógica principal:**
```typescript
// Crear Set de tipos de entidades afectadas (originales y nuevas)
const affectedEntityTypes = new Set();
if (originalTransaction?.deQuienTipo) affectedEntityTypes.add(originalTransaction.deQuienTipo);
if (originalTransaction?.paraQuienTipo) affectedEntityTypes.add(originalTransaction.paraQuienTipo);
if (updatedTransaction.deQuienTipo) affectedEntityTypes.add(updatedTransaction.deQuienTipo);
if (updatedTransaction.paraQuienTipo) affectedEntityTypes.add(updatedTransaction.paraQuienTipo);

// Invalidar por cada tipo en el Set
if (affectedEntityTypes.has('mina')) {
  // Invalidar minas originales y nuevas
  // ...
}

// Repetir para cada tipo...
```

**Tamaño:** ~350 líneas de código

---

### 3. `delete-transaction-modal.tsx` (líneas 46-438)

**Qué hace:**
- Cuando se elimina una transacción, invalida las queries de las entidades afectadas
- Similar a new-transaction pero para eliminación
- Usa funciones helper (`invalidarQueriesSocio`) para evitar duplicación dentro del mismo archivo

**Tamaño:** ~200 líneas de código

---

### 4. `complete-transaction-modal.tsx`

**Qué hace:**
- Cuando se completa una transacción pendiente, invalida las queries
- Similar a new-transaction pero para completar transacciones pendientes

**Tamaño:** ~100 líneas de código

---

## 🔄 Lógica Común que se Repite:

1. **Invalidar transacciones generales** (`/api/transacciones`)
2. **Detectar tipos de entidades afectadas** (mina, comprador, volquetero, tercero, lcdm, postobon, rodmar)
3. **Para cada tipo de entidad:**
   - Invalidar lista de entidades (`/api/minas`, `/api/compradores`, etc.)
   - Invalidar balances (`/api/balances/minas`, etc.)
   - Refetch balances inmediatamente
   - Invalidar queries específicas de la entidad afectada (`/api/transacciones/mina/:id`, etc.)
4. **Casos especiales:**
   - minaActual, compradorId desde props
   - Cuentas RodMar específicas (bemovil, corresponsal, etc.)
   - LCDM y Postobón

---

## 💡 Solución Propuesta:

### Crear un hook/función centralizada: `useInvalidateTransactionQueries`

**Interfaz propuesta:**
```typescript
const invalidateTransactionQueries = useInvalidateTransactionQueries();

// Para crear transacción
invalidateTransactionQueries({
  deQuienTipo: data.deQuienTipo,
  deQuienId: data.deQuienId,
  paraQuienTipo: data.paraQuienTipo,
  paraQuienId: data.paraQuienId,
  additionalContext: { minaActual, compradorId }
});

// Para editar transacción
invalidateTransactionQueries({
  originalTransaction,
  updatedTransaction
});

// Para eliminar transacción
invalidateTransactionQueries({
  transaction: transactionToDelete
});
```

**O usar función estática (no hook):**
```typescript
import { invalidateTransactionQueries } from '@/hooks/useInvalidateTransactionQueries';

invalidateTransactionQueries(queryClient, {
  deQuienTipo: data.deQuienTipo,
  deQuienId: data.deQuienId,
  // ...
});
```

---

## 📊 Impacto:

- **Líneas de código eliminadas**: ~300-400 líneas duplicadas
- **Archivos modificados**: 4
- **Archivo nuevo**: 1 (hook/función)
- **Riesgo**: **Medio-Alto** (afecta actualización de datos en tiempo real)

---

## ⚠️ Consideraciones Críticas:

1. **Comportamiento diferente en edit:**
   - En `edit-transaction-modal.tsx` se invalidan AMBAS entidades (original y nueva)
   - Esto es importante si la transacción cambia de entidad

2. **Casos especiales:**
   - `minaActual`, `compradorId` desde props del modal
   - Cuentas RodMar específicas
   - LCDM y Postobón tienen lógica especial

3. **Refetch strategies:**
   - Algunos usan `refetchQueries({ queryKey: [...], type: 'all' })`
   - Otros usan `refetchType: 'active'`
   - Algunos solo invalidan sin refetch explícito

4. **Testing crítico:**
   - Probar que los balances se actualizan después de crear/editar/eliminar
   - Probar que las listas se actualizan
   - Probar que funciona en tiempo real (múltiples usuarios)
   - Probar cada tipo de entidad (mina, comprador, volquetero, tercero, lcdm, postobon, rodmar)

---

## ✅ Beneficios Esperados:

1. **Menos código duplicado**: ~300-400 líneas eliminadas
2. **Más fácil de mantener**: Un solo lugar para corregir bugs
3. **Comportamiento consistente**: Todos los lugares usan la misma lógica
4. **Más fácil de extender**: Agregar nuevo tipo de entidad solo requiere cambiar un lugar
5. **Más fácil de testear**: La función se puede testear independientemente

---

## 🎯 Estrategia Recomendada:

Dado que esta es una fase de **riesgo medio-alto**, se recomienda:

1. **Crear la función centralizada** con toda la lógica
2. **Reemplazar UN archivo a la vez** (empezar por `new-transaction-modal.tsx`)
3. **Probar exhaustivamente** después de cada reemplazo
4. **Solo continuar** si todo funciona correctamente

**Orden sugerido:**
1. `new-transaction-modal.tsx` (más simple, solo creación)
2. `delete-transaction-modal.tsx` (similar a creación, pero eliminación)
3. `complete-transaction-modal.tsx` (similar a creación)
4. `edit-transaction-modal.tsx` (más complejo, maneja original y nueva)

---

## 📝 Notas:

- Esta refactorización es **más arriesgada** que las anteriores
- Es **crítica** para que los datos se actualicen correctamente
- Requiere **testing exhaustivo** en cada paso
- Si algo falla, los balances y listados **no se actualizarían** correctamente

