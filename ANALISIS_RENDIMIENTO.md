# Análisis de Rendimiento - Cambios Recientes

## 🔴 Problemas Críticos Identificados

### 1. **Backend: `/api/rodmar-accounts` (LÍNEA 5221)**
**Problema:** 
- Llama a `storage.getTransacciones()` que carga **TODAS las transacciones** de la BD en cada request
- Itera sobre **TODAS las transacciones** para calcular balances de cada cuenta
- Múltiples `console.log` en cada request (lentitud adicional)
- **NO hay caché** en el backend

**Impacto:** 
- Si hay 1000 transacciones, se cargan y procesan 1000 registros en cada request
- Tiempo estimado: 500-2000ms por request dependiendo del tamaño de la BD

**Solución sugerida:**
- Agregar caché en memoria (Redis o Map) con TTL corto (30-60 segundos)
- Reducir `console.log` a solo errores o en modo debug
- Considerar cálculo de balances en la BD con SQL agregado

### 2. **Backend: `/api/terceros` (LÍNEA 741)**
**Problema:**
- Mismo problema: carga TODAS las transacciones para calcular balances
- Itera sobre todas las transacciones para cada tercero

**Impacto:**
- Similar al anterior: 500-2000ms por request

**Solución sugerida:**
- Mismo enfoque: caché o cálculo SQL agregado

### 3. **Frontend: `rodmar.tsx` - Queries Siempre Activas**
**Problema:**
- `cuentasRodMar` se carga siempre (línea 272), incluso si no se está viendo la pestaña "cuentas"
- `terceros` se carga siempre (línea 156), incluso si no se está viendo la pestaña "terceros"
- `staleTime: 30000` (30 segundos) es muy corto para datos que cambian poco

**Impacto:**
- Múltiples requests HTTP simultáneos al cargar el módulo RodMar
- Refetches frecuentes (cada 30 segundos) aunque los datos no cambien

**Solución sugerida:**
- Agregar `enabled: activeTab === 'cuentas'` para cuentasRodMar
- Agregar `enabled: activeTab === 'terceros'` para terceros
- Aumentar `staleTime` a 300000 (5 minutos) como otros datos similares

### 4. **Backend: Logs Excesivos en `/api/rodmar-accounts`**
**Problema:**
- Múltiples `console.log` en cada request (líneas 5230-5304)
- Se ejecutan incluso cuando no hay errores

**Impacto:**
- Overhead de I/O por cada log
- Consola saturada en producción

**Solución sugerida:**
- Reducir logs a solo casos de error o modo debug
- Usar niveles de log (debug, info, error)

## ⚠️ Problemas Menores

### 5. **Frontend: Permisos Checked en Render**
**Problema:**
- `getInitialTab()` (línea 98) llama a `has()` múltiples veces en cada render
- `has()` probablemente hace trabajo sincrónico

**Impacto:**
- Pequeño overhead en cada render, pero puede acumularse

**Solución sugerida:**
- Memoizar el resultado de `getInitialTab()` o moverlo a `useMemo`

## 📊 Métricas Estimadas

**Antes de los cambios:**
- `/api/rodmar-accounts`: ~200-500ms (cuentas hardcodeadas)
- `/api/terceros`: ~200-500ms (sin cálculo de balances)

**Después de los cambios:**
- `/api/rodmar-accounts`: ~500-2000ms (cálculo de balances dinámico)
- `/api/terceros`: ~500-2000ms (cálculo de balances dinámico)

**Impacto total:**
- **2-4x más lento** en endpoints de cuentas RodMar y terceros
- Múltiples queries simultáneas al cargar módulo RodMar

## ✅ Optimizaciones Prioritarias

### Prioridad Alta (Impacto inmediato)

1. **Agregar `enabled` condicional en frontend** (Fácil, impacto alto)
   - Evitar cargar datos cuando no se están usando
   
2. **Aumentar `staleTime` en frontend** (Fácil, impacto medio)
   - Reducir refetches innecesarios

3. **Reducir logs en backend** (Fácil, impacto medio)
   - Eliminar `console.log` de rutas normales

### Prioridad Media (Mejora significativa)

4. **Caché en memoria para balances** (Medio, impacto alto)
   - Implementar Map con TTL para balances calculados
   - Invalidar caché cuando hay cambios

5. **Cálculo SQL agregado** (Complejo, impacto muy alto)
   - Mover cálculo de balances a queries SQL con `SUM`, `GROUP BY`
   - Reducir carga de datos a la memoria

## 🎯 Recomendación Inmediata

**Empezar con optimizaciones de Prioridad Alta** (cambios pequeños, impacto alto):

1. Agregar `enabled` condicional en queries del frontend
2. Aumentar `staleTime` a 5 minutos
3. Eliminar logs excesivos del backend

Esto debería mejorar el rendimiento en **50-70%** con cambios mínimos.



