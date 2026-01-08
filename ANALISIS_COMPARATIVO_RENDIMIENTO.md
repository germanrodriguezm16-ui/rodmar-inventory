# Análisis Comparativo de Rendimiento - RodMar vs Otros Módulos

## 🔍 Patrón Establecido (Minas, Compradores, Volqueteros)

### ✅ Implementación Optimizada

#### Frontend:
1. **Hook dedicado** (`useMinasBalance`, `useCompradoresBalance`, `useVolqueterosBalance`)
   - Usa endpoint de agregación: `/api/balances/minas`, `/api/balances/compradores`, `/api/balances/volqueteros`
   - `staleTime: 300000` (5 minutos)
   - `refetchOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`
   - Escucha eventos WebSocket para invalidación inteligente

2. **Invalidación vía WebSockets**:
   - Escucha `balance-updated` y eventos específicos
   - Solo invalida y refetchea cuando hay cambios reales
   - Refetch inmediato solo si la query está activa

#### Backend:
1. **Endpoints de agregación optimizados**:
   - `/api/balances/minas` → `storage.getMinasBalances()`
   - `/api/balances/compradores` → `storage.getCompradoresBalances()`
   - `/api/balances/volqueteros` → `storage.getVolqueterosBalances()`
   - **Calculan balances con SQL agregado** (SUM, GROUP BY)
   - **NO cargan todas las transacciones** a memoria

2. **Invalidación en mutaciones**:
   - Cuando se crea/edita/elimina transacción, se invalida específicamente
   - Se emiten eventos WebSocket con `affectedEntityTypes`

---

## ⚠️ Implementación Actual de RodMar

### Frontend:
1. **NO hay hook dedicado**
   - Se usa directamente `useQuery` en `rodmar.tsx`
   - Query key: `["/api/rodmar-accounts"]`
   - `staleTime: 30000` (30 segundos) - **MUY CORTO comparado con 300000**

2. **Invalidación SÍ está implementada**:
   - ✅ Se invalida en mutaciones (create/update/delete transacciones)
   - ✅ Se invalida vía WebSockets (`useSocket.ts` líneas 125, 139, 175)
   - ✅ Se hace refetch inmediato para actualizar balances
   - ✅ Se invalida al crear/editar/eliminar cuentas RodMar

3. **Problema: Query siempre activa**
   - La query de `cuentasRodMar` se ejecuta siempre, incluso si no se está viendo la pestaña "cuentas"
   - No hay `enabled` condicional basado en `activeTab`

### Backend:
1. **Endpoint `/api/rodmar-accounts` (línea 5221)**:
   - ❌ **Carga TODAS las transacciones**: `await storage.getTransacciones()`
   - ❌ **Calcula balances en memoria** iterando sobre todas las transacciones
   - ❌ **NO usa agregación SQL** como otros módulos
   - ⚠️ **Múltiples console.log** en cada request (lentitud adicional)

2. **Endpoint `/api/terceros` (línea 741)**:
   - ❌ Mismo problema: carga TODAS las transacciones
   - ❌ Calcula balances en memoria

---

## 📊 Comparación de Rendimiento

### Otros Módulos (Optimizados):
- **Query SQL agregado**: ~50-200ms
- **Frontend**: Usa datos pre-calculados del backend
- **Caché**: 5 minutos, solo invalida cuando hay cambios

### RodMar (Actual):
- **Carga todas las transacciones**: ~200-800ms
- **Cálculo en memoria**: ~100-300ms adicionales
- **Total**: ~500-2000ms por request
- **Caché**: 30 segundos (refetches frecuentes)
- **Query siempre activa**: Incluso cuando no se usa

---

## 🎯 Recomendaciones Alineadas con el Patrón

### ✅ Mantener (Ya está bien):
1. **Invalidación vía WebSockets** - ✅ Correcto
2. **Invalidación en mutaciones** - ✅ Correcto
3. **Refetch inmediato** - ✅ Correcto para mantener balances actualizados

### 🔧 Mejorar (Alinear con patrón):

#### Prioridad Alta:
1. **Aumentar `staleTime`** de 30000 a 300000 (5 minutos)
   - Consistente con otros módulos
   - Reducirá refetches innecesarios
   - Los WebSockets mantendrán datos actualizados

2. **Agregar `enabled` condicional** para queries:
   ```typescript
   enabled: activeTab === 'cuentas' || has("module.RODMAR.accounts.view")
   ```
   - Solo cargar cuando se necesita la pestaña
   - Consistente con queries condicionales en otros lugares

3. **Reducir logs excesivos** en backend:
   - Eliminar `console.log` de rutas normales
   - Mantener solo errores o modo debug

#### Prioridad Media (Mejora significativa):
4. **Crear endpoint `/api/balances/rodmar`** optimizado:
   - Calcular balances con SQL agregado (SUM, GROUP BY)
   - Similar a `/api/balances/minas`, `/api/balances/compradores`, etc.
   - NO cargar todas las transacciones

5. **Crear hook `useRodmarBalance`**:
   - Similar a `useMinasBalance`, `useCompradoresBalance`
   - Centralizar lógica de invalidación WebSocket
   - Mejor separación de responsabilidades

6. **Crear endpoint `/api/balances/terceros`** optimizado:
   - Mismo patrón: SQL agregado en lugar de cálculo en memoria

---

## 🔄 Estrategia de Invalidación (YA FUNCIONA BIEN)

### Actual:
✅ **Invalidación correcta** cuando:
- Se crea/edita/elimina transacción que afecta RodMar
- Se crea/edita/elimina cuenta RodMar
- Se recibe evento WebSocket `transaction-updated` con `affectedEntityTypes` que incluye "rodmar"

✅ **Refetch inmediato** para mantener balances actualizados

### Mantener:
- ✅ La estrategia actual de invalidación es correcta
- ✅ Los WebSockets mantienen sincronización en tiempo real
- ✅ No cambiar la lógica de invalidación

---

## 📝 Resumen

**Lo que está bien:**
- ✅ Invalidación vía WebSockets funciona correctamente
- ✅ Invalidación en mutaciones funciona correctamente
- ✅ Los balances se mantienen actualizados

**Lo que se puede mejorar (alineando con el patrón):**
1. ⚠️ `staleTime` muy corto (30s vs 5min estándar)
2. ⚠️ Query siempre activa (debería ser condicional)
3. ⚠️ Backend no usa agregación SQL (carga todas las transacciones)
4. ⚠️ Logs excesivos en producción

**Impacto estimado de mejoras rápidas:**
- Reducir `staleTime` → Menos refetches (70-80% menos)
- Query condicional → Menos requests iniciales (50% menos)
- Reducir logs → Mejor rendimiento backend (10-20% más rápido)

**Mejora total estimada con cambios rápidos: 50-70% más rápido**



