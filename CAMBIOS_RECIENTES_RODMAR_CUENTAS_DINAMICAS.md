# Cambios Recientes - Cuentas RodMar Dinámicas y Corrección de Nombres

## Fecha: Enero 2025

### 1. Modal de Edición: Cuentas RodMar Dinámicas en lugar de Hardcodeadas

**Problema**: El modal de edición de transacciones usaba una lista hardcodeada de IDs de cuentas RodMar (`['bemovil', 'corresponsal', 'efectivo', 'cuentas-german', 'cuentas-jhon', 'otros']`), lo que impedía que funcionara correctamente con cuentas creadas dinámicamente.

**Solución**: 
- Se reemplazó la lista hardcodeada por una verificación dinámica usando `rodmarCuentas` de la API.
- Se agregó la función `mapRodmarIdToNumeric` para mapear IDs legacy (códigos antiguos como "bemovil", "corresponsal", etc.) al ID numérico actual.
- Se corrigió el bug donde el selector "Para quién" usaba `watchedDeQuienTipo` en lugar de `watchedParaQuienTipo`.
- La invalidación de queries ahora detecta cualquier cuenta RodMar dinámicamente, no solo las hardcodeadas.

**Archivos modificados**:
- `client/src/components/forms/edit-transaction-modal.tsx`: Líneas 399-424 (invalidación), 993-1004 (selector), 262-289 (mapeo de IDs)

**Comportamiento resultante**:
- El modal de edición funciona con todas las cuentas RodMar existentes.
- Las nuevas cuentas creadas dinámicamente se muestran correctamente al editar transacciones.
- La invalidación de queries funciona para cualquier cuenta RodMar, no solo las predefinidas.

---

### 2. Corrección de Bucle Infinito en Modal de Edición

**Problema**: El `useEffect` en `edit-transaction-modal.tsx` causaba un bucle infinito de actualizaciones ("Maximum update depth exceeded"), llenando la consola de errores.

**Causa raíz**:
- `form` estaba incluido en las dependencias del `useEffect`, pero `form` es un objeto que cambia en cada render.
- No había verificación para evitar procesar la misma transacción múltiples veces.
- Múltiples `setTimeout` y `form.reset()` se ejecutaban innecesariamente.

**Solución**:
- Se usó `useRef` para mantener una referencia estable de `form.reset`.
- Se agregó rastreo de la última transacción procesada (`lastProcessedId`, `lastProcessedData`) para evitar procesamiento duplicado.
- Se memoizó `mapRodmarIdToNumeric` con `useMemo` para evitar recrearla en cada render.
- Se simplificó la lógica de actualización del formulario (un solo `form.reset()` en lugar de múltiples `setTimeout`).
- Se eliminaron todos los `console.log` de depuración que llenaban la consola.

**Archivos modificados**:
- `client/src/components/forms/edit-transaction-modal.tsx`: Líneas 1 (imports), 237-322 (useEffect mejorado)

**Comportamiento resultante**:
- El bucle infinito está completamente resuelto.
- La consola ya no se llena de errores.
- El modal de edición se carga correctamente sin re-renders innecesarios.

---

### 3. Corrección de "Desconocido" en Nombres de Cuentas RodMar

**Problema**: En el módulo general de transacciones, las tarjetas mostraban "RodMar Desconocido" o "Banco Desconocido" cuando el origen era "banco" y el destino era una cuenta RodMar.

**Causa raíz**:
- El backend no estaba calculando `socioNombre` para transacciones donde `paraQuienTipo === 'rodmar'`.
- La función `getRodmarNombreFromMap` no tenía la misma lógica exhaustiva que `updateConceptoWithCurrentNamesSync`.
- Faltaban variaciones en el mapeo de `rodmarCuentasMap` (espacios, capitalización, etc.).

**Solución**:
- Se mejoró `getRodmarNombreFromMap` para usar la misma lógica exhaustiva que `updateConceptoWithCurrentNamesSync`.
- Se agregó búsqueda por múltiples variaciones: ID numérico, código en minúsculas/mayúsculas, transformaciones guiones ↔ guiones bajos, variaciones con espacios, y capitalización.
- Se mejoró el mapeo de `rodmarCuentasMap` para incluir más variaciones: espacios, capitalización, slug legacy en mayúsculas, etc.
- Se agregó manejo de LCDM, Postobón y Banco en todas las ubicaciones donde se calcula `socioNombre`.
- Se agregaron logs de debugging condicionales (solo si `DEBUG_RODMAR=true`).

**Archivos modificados**:
- `server/db-storage.ts`: 
  - Líneas 2389-2521: Función `getRodmarNombreFromMap` mejorada
  - Líneas 1045-1067: Manejo de RodMar, LCDM, Postobón y Banco en `getTransacciones`
  - Líneas 1266-1290: Manejo en `getTransaccionesPaginated`
  - Líneas 1608-1633: Manejo en `getTransaccionesPendientes`
  - Líneas 2356-2368: Manejo en `getTransaccionesForModule`
  - Líneas 1240-1265, 1577-1601, 2315-2352: Mapeo mejorado de `rodmarCuentasMap`

**Comportamiento resultante**:
- Las tarjetas de transacciones muestran el nombre correcto de la cuenta RodMar (ej: "Efectivo", "Corresponsal") en lugar de "Desconocido".
- Funciona con cuentas dinámicas creadas recientemente.
- Compatible con IDs legacy (códigos antiguos como "bemovil", "corresponsal", etc.).
- LCDM muestra "La Casa del Motero", Postobón muestra "Postobón", y Banco muestra "Banco".

---

### 4. Función Helper `getRodmarNombreFromMap` Mejorada

**Funcionalidad**: Función que busca el nombre de una cuenta RodMar desde el map usando múltiples estrategias de búsqueda.

**Búsquedas realizadas** (en orden de prioridad):
1. ID numérico exacto (original string)
2. Código en minúsculas
3. Código en mayúsculas
4. Transformación guiones bajos → guiones (slug legacy)
5. Transformación guiones → guiones bajos
6. Transformaciones en el ID original (sin lowercase)
7. Variaciones con espacios

**Logs de debugging**:
- Los logs solo se muestran si `DEBUG_RODMAR=true` está configurado en las variables de entorno del servidor.
- Incluye información sobre qué se está buscando y si se encontró.

---

### 5. Mapeo Mejorado de `rodmarCuentasMap`

**Mejoras en el mapeo**:
El map ahora incluye múltiples variaciones para cada cuenta:
- ID numérico como string
- Código en minúsculas
- Código en mayúsculas
- Código original
- Slug legacy (guiones bajos → guiones)
- Slug legacy en mayúsculas
- Slug legacy original
- Variación inversa (guiones → guiones bajos)
- Con espacios en lugar de guiones/guiones bajos
- Con espacios y capitalización
- Variaciones legacy hardcodeadas para compatibilidad

**Ubicaciones donde se aplica**:
- `getTransacciones` (línea ~1010)
- `getTransaccionesPaginated` (línea ~1240)
- `getTransaccionesPendientes` (línea ~1577)
- `getTransaccionesForModule` (línea ~2315)

---

## Resumen de Archivos Modificados

1. **`client/src/components/forms/edit-transaction-modal.tsx`**:
   - Corrección de bucle infinito usando `useRef` y memoización
   - Eliminación de logs de depuración
   - Función `mapRodmarIdToNumeric` para mapear IDs legacy
   - Corrección del selector "Para quién"
   - Invalidación dinámica de queries RodMar

2. **`server/db-storage.ts`**:
   - Función `getRodmarNombreFromMap` mejorada (8 estrategias de búsqueda)
   - Manejo de LCDM, Postobón y Banco en cálculo de `socioNombre` (4 ubicaciones)
   - Mapeo mejorado de `rodmarCuentasMap` con más variaciones (4 ubicaciones)

---

## Testing Recomendado

1. **Modal de edición**:
   - Abrir modal de edición con una transacción que involucre una cuenta RodMar.
   - Verificar que el dropdown muestra la cuenta correcta seleccionada.
   - Verificar que al guardar, la invalidación funciona correctamente.

2. **Módulo de transacciones**:
   - Verificar que las tarjetas muestran nombres correctos de cuentas RodMar (no "Desconocido").
   - Verificar transacciones con origen "Banco" y destino RodMar.
   - Verificar transacciones con origen LCDM y destino RodMar.
   - Verificar transacciones con origen Postobón y destino RodMar.

3. **Consola del navegador**:
   - Verificar que no hay errores "Maximum update depth exceeded".
   - Verificar que no hay logs excesivos (solo si `DEBUG_RODMAR=true` está activo).

---

## Notas Técnicas

- Los logs de debugging en `getRodmarNombreFromMap` están desactivados por defecto. Para activarlos, agregar `DEBUG_RODMAR=true` en el archivo `.env` del servidor.
- La función `mapRodmarIdToNumeric` en el frontend se ejecuta cada vez que se carga una transacción, pero está memoizada para evitar recreaciones innecesarias.
- El mapeo de `rodmarCuentasMap` se crea una vez por llamada a la función que lo necesita, optimizando el rendimiento.
