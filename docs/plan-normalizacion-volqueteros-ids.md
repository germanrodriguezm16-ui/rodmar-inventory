# Plan futuro: Normalización por IDs (Volqueteros) para mejorar performance

## Contexto / Problema
El listado de **Volqueteros** y sus balances tardan más que **Minas** y **Compradores** porque actualmente existen dependencias por **texto** (nombre de conductor / string) que obligan a:

- joins por `LOWER(nombre) = LOWER(conductor)` en viajes,
- y consultas de transacciones con **OR masivos** (buscar por ID o por nombre), que escalan mal con el número de volqueteros.

La solución definitiva es **normalizar a IDs** para que las consultas usen `IN (ids)` + índices.

---

## Objetivo
1) Asegurar que cuando `deQuienTipo/paraQuienTipo = 'volquetero'`, el `deQuienId/paraQuienId` sea **siempre** el **ID numérico** (como string), nunca el nombre.
2) (Recomendado) Guardar `viajes.volqueteroId` (FK) para evitar agregaciones por `viajes.conductor` string.

---

## Plan de trabajo seguro y eficaz (Opción A)

### 1) Preparación (sin impacto)
- **Inventario**:
  - Contar transacciones `volquetero` donde `deQuienId/paraQuienId` no sea numérico.
  - Detectar **nombres duplicados** en `volqueteros.nombre` (si hay, hay ambigüedad).
- **Regla de matching**:
  - `trim(lower(nombre))`.
  - Si hay duplicados, definir regla (bloquear y resolver manualmente, o elegir un criterio determinístico).

**Checkpoint**: No migrar nada si el matching no es determinístico.

---

### 2) Migración de Transacciones (data fix, reversible)
- **Backup / rollback**:
  - Exportar o guardar en tabla auxiliar las filas afectadas (antes/después).
- **Backfill**:
  - Para `transacciones.deQuienTipo='volquetero'`:
    - si `deQuienId` no es numérico, resolver nombre → `volqueteros.id` y guardar el id.
  - Para `transacciones.paraQuienTipo='volquetero'`:
    - mismo proceso.
- **Validación**:
  - Recontar: idealmente quedar en 0 no-numéricos; si quedan, listarlos como **no-resolubles**.

**Checkpoint**: Resolver manualmente los no-resolubles antes de seguir.

---

### 3) Enforcement en Backend (evitar re-contaminación)
En creación/edición de transacciones:
- Si llega `tipo='volquetero'` y el id no es numérico:
  - resolver por nombre y persistir ID numérico,
  - si no se puede resolver: devolver **400** con mensaje claro (o aplicar regla de negocio definida).

**Checkpoint**: A partir de aquí no se vuelven a guardar nombres en `*Id` para volqueteros.

---

### 4) Optimizar `getVolqueterosBalances` (performance)
Reemplazar la lógica actual que arma `OR(id o nombre)` por:
- queries por IDs con `IN (...)`:
  - `inArray(transacciones.deQuienId, volqueteroIds)`
  - `inArray(transacciones.paraQuienId, volqueteroIds)`

Mantener reglas actuales:
- excluir transacciones `pendiente`,
- incluir ocultas (si esa es la regla de balance real).

**Checkpoint**: medir tiempos de `/api/balances/volqueteros` antes/después (ya hay logs `[PERF]`).

---

### 5) (Recomendado) Añadir `viajes.volqueteroId` (FK) para eliminar joins por nombre
Esto elimina el segundo gran cuello de botella: agregaciones por `viajes.conductor`.

- Agregar columna nullable `viajes.volqueteroId`.
- Backfill: resolver `viajes.conductor` → `volqueteros.id`.
- Enforcement: en crear/editar viaje, guardar `volqueteroId`.
- Cambiar agregaciones/joins a usar `viajes.volqueteroId`.

**Checkpoint**: los viajes no resolubles quedan con `volqueteroId = NULL` (no rompe).

---

## Riesgos y mitigación
- **Duplicados de nombre**: bloquear migración automática y resolver manualmente / regla determinística.
- **Typos/variantes de nombre**: quedan como no-resolubles; listar y corregir.
- **Rollback**: requiere backup/tabla auxiliar de transacciones afectadas.

---

## Resultado esperado
- Listado y balances de Volqueteros con queries basadas en IDs (más rápidas, estables, escalables).
- Menos CPU en backend y menos latencia percibida en frontend.

