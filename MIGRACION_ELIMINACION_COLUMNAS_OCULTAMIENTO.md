# Migración: Eliminación de Columnas de Ocultamiento de Transacciones

## Fecha: Diciembre 2025

## Resumen

Se eliminaron las columnas obsoletas de ocultamiento de transacciones de la base de datos y del código del servidor, completando la migración al sistema de ocultamiento local y temporal implementado en el frontend mediante `sessionStorage`.

## Contexto

Anteriormente, el sistema utilizaba columnas en la base de datos (`oculta`, `ocultaEnComprador`, `ocultaEnMina`, `ocultaEnVolquetero`, `ocultaEnGeneral`) para marcar transacciones como ocultas de forma persistente. Sin embargo, esto no cumplía con el requisito de ocultamiento temporal y local que solo afecta al usuario actual.

El sistema de ocultamiento se migró completamente al frontend usando el hook `useHiddenTransactions`, que utiliza `sessionStorage` para:
- Persistir el estado solo durante la sesión del navegador
- Limpiarse automáticamente al cambiar de pestaña, página o módulo
- Afectar solo al usuario actual sin impactar a otros usuarios

## Columnas Eliminadas

Se eliminaron las siguientes columnas de la tabla `transacciones`:

1. `oculta` - Campo general de ocultamiento
2. `oculta_en_comprador` - Ocultamiento específico para módulo Compradores
3. `oculta_en_mina` - Ocultamiento específico para módulo Minas
4. `oculta_en_volquetero` - Ocultamiento específico para módulo Volqueteros
5. `oculta_en_general` - Ocultamiento general

**Nota importante:** La columna `oculta` de la tabla `viajes` **NO se eliminó**, ya que los viajes sí utilizan ocultamiento persistente en la base de datos.

## Script SQL Ejecutado

```sql
ALTER TABLE transacciones 
  DROP COLUMN IF EXISTS oculta,
  DROP COLUMN IF EXISTS oculta_en_comprador,
  DROP COLUMN IF EXISTS oculta_en_mina,
  DROP COLUMN IF EXISTS oculta_en_volquetero,
  DROP COLUMN IF EXISTS oculta_en_general;
```

Este script se ejecutó directamente en la base de datos de Railway usando Drizzle Studio.

## Cambios en el Código

### 1. Schema (`shared/schema.ts`)

- Eliminadas las definiciones de las 5 columnas obsoletas de la tabla `transacciones`
- El schema ahora refleja correctamente la estructura de la base de datos

### 2. Backend (`server/db-storage.ts`)

- **Eliminadas referencias en SELECT statements:**
  - Removidas todas las referencias a `transacciones.oculta*` en las consultas
  - Eliminadas las columnas de los objetos de selección en:
    - `getTransacciones()`
    - `getTransaccionesPaginated()`
    - `getTransaccionesPendientes()`
    - `getTransaccionesIncludingHidden()`
    - `getTransaccionesForModule()`

- **Eliminadas condiciones WHERE:**
  - Removidos los filtros `eq(transacciones.oculta, false)` de las consultas
  - Eliminadas las condiciones que filtraban por `ocultaEn*` en `getTransaccionesForModule()`

- **Métodos deprecados (ahora no-operativos):**
  - `hideTransaccion()` - Devuelve `false`
  - `hideTransaccionEnComprador()` - Devuelve `false`
  - `hideTransaccionEnMina()` - Devuelve `false`
  - `hideTransaccionEnVolquetero()` - Devuelve `false`
  - `hideTransaccionEnGeneral()` - Devuelve `false`
  - `showTransaccion()` - Devuelve `false`
  - `showAllHiddenTransacciones()` - Devuelve `0`
  - `showAllHiddenTransaccionesForComprador()` - Devuelve `0`
  - `showAllHiddenTransaccionesForMina()` - Devuelve `0`
  - `showAllHiddenTransaccionesForVolquetero()` - Devuelve `0`

  Estos métodos se mantienen temporalmente para evitar errores si alguna ruta los llama, pero ya no realizan operaciones en la base de datos.

### 3. Rutas API (`server/routes.ts`)

- **Eliminadas referencias a `t.oculta` en filtros:**
  - Removidos los filtros que contaban transacciones ocultas en:
    - Endpoint LCDM (`/api/transacciones/lcdm`)
    - Endpoint Postobón (`/api/transacciones/postobon`)
  
- **Eliminada asignación en actualizaciones:**
  - Removida la asignación `oculta: req.body.oculta` en `PATCH /api/transacciones/:id`

- **Actualizados comentarios:**
  - Agregados comentarios indicando que el ocultamiento ahora es local en el frontend

- **Rutas deprecadas (aún existen pero ya no tienen efecto):**
  - `PATCH /api/transacciones/show-all-hidden`
  - `POST /api/transacciones/socio/comprador/:id/show-all`
  - `POST /api/transacciones/socio/mina/:minaId/show-all`
  - `PATCH /api/transacciones/:id/hide`
  - `POST /api/transacciones/socio/comprador/:id/hide`
  - `POST /api/transacciones/socio/mina/:id/hide`
  - `POST /api/transacciones/socio/volquetero/:id/hide`
  - `POST /api/transacciones/socio/general/:id/hide`

  Estas rutas siguen existiendo pero ahora llaman a métodos deprecados que devuelven valores por defecto sin realizar operaciones en la BD.

## Sistema de Ocultamiento Actual

### Frontend (Módulos Actualizados)

El ocultamiento de transacciones ahora se maneja completamente en el frontend usando el hook `useHiddenTransactions`:

- **Compradores** - ✅ Migrado
- **Minas** - ✅ Migrado
- **Volqueteros** - ✅ Migrado
- **Postobón** (RodMar) - ✅ Migrado
- **LCDM** (RodMar) - ✅ Migrado
- **RodMar Cuentas** - ✅ Migrado (ya estaba usando el sistema local)

### Características del Sistema Local

- **Temporal:** El estado se limpia al cambiar de pestaña, página o módulo
- **Local:** Solo afecta al usuario actual
- **Persistente durante sesión:** Se mantiene mientras la pestaña del navegador esté abierta
- **No afecta la BD:** No hay cambios en la base de datos
- **No afecta otros usuarios:** Cada usuario tiene su propio estado de ocultamiento

## Impacto

### Ventajas

1. **Mejor rendimiento:** Ya no es necesario consultar/filtrar columnas de ocultamiento en la BD
2. **Lógica correcta:** El ocultamiento es realmente temporal y local como se requería
3. **Código más simple:** Menos complejidad en el backend
4. **Escalabilidad:** No se almacena estado innecesario en la BD

### Consideraciones

- Los métodos y rutas obsoletos aún existen pero son no-operativos
- Si el frontend todavía intenta llamar a estas rutas, no causarán errores pero tampoco tendrán efecto
- La columna `viajes.oculta` se mantiene porque los viajes sí usan ocultamiento persistente

## Próximos Pasos (Opcional)

Si se desea una limpieza completa, se podrían:

1. Eliminar completamente los métodos deprecados de `db-storage.ts`
2. Eliminar las rutas API obsoletas de `routes.ts`
3. Actualizar el frontend para eliminar cualquier llamada a estas rutas (si aún existen)

## Verificación

Para verificar que las columnas fueron eliminadas correctamente:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transacciones' 
  AND column_name LIKE '%oculta%';
```

Esta consulta debe devolver 0 filas (las columnas ya no existen).

Para verificar que `viajes.oculta` sigue existiendo:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'viajes' 
  AND column_name = 'oculta';
```

Esta consulta debe devolver 1 fila con `column_name = 'oculta'` y `data_type = 'boolean'`.




