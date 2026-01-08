# Análisis de Lentitud - Módulo RodMar

## 🔴 Problema 1: Listado de Cuentas RodMar (Lento)

### Endpoint: `/api/rodmar-accounts` (Línea 5221)

**Problema:**
```typescript
const transacciones = await storage.getTransacciones(); // ❌ Carga TODAS las transacciones
// ... filtrado de permisos ...
// Luego itera sobre TODAS las transacciones para calcular balances:
transacciones.forEach((transaccion: any) => {
  // Cálculo de balance por cada cuenta...
});
```

**Comparación:**
- **Minas/Compradores/Volqueteros**: Usan endpoints optimizados `/api/balances/minas` que usan SQL agregado
- **RodMar**: Carga todas las transacciones + cálculo en memoria

**Impacto:**
- Si hay 1000 transacciones: carga 1000 registros desde BD
- Itera sobre 1000 transacciones para calcular balances de cada cuenta
- Tiempo estimado: **500-2000ms** (depende del tamaño de BD)

**Causa raíz:**
- No hay endpoint optimizado `/api/balances/rodmar` como en otros módulos
- El cálculo de balances se hace en memoria iterando sobre todas las transacciones

---

## 🔴 Problema 2: Transacciones LCDM/Postobon (Lento)

### Endpoints: `/api/transacciones/lcdm` y `/api/transacciones/postobon`

**Problema en LCDM (Línea 3604):**
```typescript
const allTransacciones = await storage.getTransacciones(effectiveUserId); // ❌ Carga TODAS
let lcdmTransactions = allTransacciones.filter((t: any) => 
  t.deQuienTipo === 'lcdm' || t.paraQuienTipo === 'lcdm' // ❌ Filtro en memoria
);
```

**Problema en Postobon (Línea 3726):**
```typescript
const allTransacciones = await storage.getTransacciones(effectiveUserId); // ❌ Carga TODAS
let postobonTransactions = allTransacciones.filter((t: any) => 
  t.deQuienTipo === 'postobon' || t.paraQuienTipo === 'postobon' // ❌ Filtro en memoria
);
```

**Comparación:**
- **Minas/Compradores/Volqueteros**: 
  - Usan `/api/transacciones/socio/mina/${minaId}` → `getTransaccionesBySocio()` 
  - Este método hace query SQL directa: `WHERE tipoSocio = 'mina' AND socioId = X`
  - Solo carga las transacciones relevantes desde BD
  - Tiempo estimado: **50-200ms**

- **LCDM/Postobon**: 
  - Carga TODAS las transacciones desde BD
  - Filtra en memoria con `.filter()`
  - Tiempo estimado: **500-1500ms**

**Impacto:**
- Si hay 1000 transacciones totales pero solo 50 de LCDM:
  - **Minas**: Carga solo 50 desde BD (rápido)
  - **LCDM**: Carga 1000 desde BD y filtra a 50 (lento)

---

## 📊 Comparación de Rendimiento

### Listado de Cuentas/Balances

| Módulo | Endpoint | Método | Tiempo Estimado |
|--------|----------|--------|-----------------|
| Minas | `/api/balances/minas` | SQL agregado | ~100-300ms |
| Compradores | `/api/balances/compradores` | SQL agregado | ~100-300ms |
| Volqueteros | `/api/balances/volqueteros` | SQL agregado | ~100-300ms |
| **RodMar** | `/api/rodmar-accounts` | Carga todas + memoria | **~500-2000ms** ❌ |

### Transacciones por Entidad

| Módulo | Endpoint | Método | Tiempo Estimado |
|--------|----------|--------|-----------------|
| Minas | `/api/transacciones/socio/mina/${id}` | Query SQL específica | ~50-200ms |
| Compradores | `/api/transacciones/socio/comprador/${id}` | Query SQL específica | ~50-200ms |
| Volqueteros | `/api/transacciones/socio/volquetero/${id}` | Query SQL específica | ~50-200ms |
| **LCDM** | `/api/transacciones/lcdm` | Carga todas + filter | **~500-1500ms** ❌ |
| **Postobon** | `/api/transacciones/postobon` | Carga todas + filter | **~500-1500ms** ❌ |

---

## 🎯 Causas Raíz

### 1. Listado de Cuentas
- ❌ **No existe endpoint optimizado** `/api/balances/rodmar` como en otros módulos
- ❌ **Cálculo en memoria** en lugar de SQL agregado
- ❌ **Carga todas las transacciones** innecesariamente

### 2. Transacciones LCDM/Postobon
- ❌ **Carga todas las transacciones** con `storage.getTransacciones()`
- ❌ **Filtro en memoria** con `.filter()` en lugar de WHERE SQL
- ❌ **No usa query específica** como `getTransaccionesBySocio()` o similar

---

## ✅ Soluciones Sugeridas

### Prioridad Alta (Mejora significativa inmediata):

1. **Optimizar endpoints LCDM/Postobon**:
   - Usar query SQL con `WHERE` en lugar de cargar todas y filtrar
   - Similar a cómo funciona `getTransaccionesBySocio()`
   - **Impacto**: Reducir tiempo de 500-1500ms a 50-200ms

2. **Crear endpoint optimizado `/api/balances/rodmar`**:
   - Calcular balances con SQL agregado (SUM, GROUP BY)
   - Similar a `/api/balances/minas`, `/api/balances/compradores`
   - **Impacto**: Reducir tiempo de 500-2000ms a 100-300ms

### Prioridad Media:

3. **Agregar índices en BD** (si no existen):
   - Índice en `transacciones.deQuienTipo` y `transacciones.paraQuienTipo`
   - Índice en `transacciones.deQuienId` y `transacciones.paraQuienId`

---

## 📝 Nota sobre Invalidación

**✅ La invalidación funciona correctamente** - No necesita cambios:
- Los WebSockets invalidan correctamente cuando hay cambios
- Las mutaciones invalidan correctamente
- El problema NO es la invalidación, es el rendimiento de los queries iniciales

---

## 🔍 Verificación Adicional Necesaria

Revisar `getTransaccionesBySocio()` en `db-storage.ts` para confirmar que:
- Hace query SQL con `WHERE` específico
- No carga todas las transacciones
- Usa índices de BD eficientemente

Esto ayudará a replicar el mismo patrón para LCDM/Postobon.



