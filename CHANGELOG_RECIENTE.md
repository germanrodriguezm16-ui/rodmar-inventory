# Changelog - Cambios Recientes

## Fecha: Última sesión de desarrollo

### Resumen General
Esta sesión se enfocó en completar la migración del sistema de ocultamiento de transacciones de un enfoque basado en base de datos a un enfoque local y temporal usando `sessionStorage`, así como unificar la interfaz de usuario en todos los módulos.

---

## 1. Migración a Ocultamiento Local Temporal

### Objetivo
Completar la migración de todos los módulos para que las transacciones manuales usen ocultamiento local temporal (solo afecta al usuario actual, se limpia al cambiar de página/pestaña), mientras que los viajes mantienen su ocultamiento en la base de datos.

### Módulos Migrados
- ✅ **Postobón** (ya migrado anteriormente)
- ✅ **LCDM** (ya migrado anteriormente)
- ✅ **Volqueteros** (ya migrado anteriormente)
- ✅ **Minas** (migrado en esta sesión)
- ✅ **Compradores** (migrado en esta sesión)

### Cambios Técnicos

#### Minas (`mina-detail.tsx`)
- **Eliminado**: Query `todasTransaccionesIncOcultas` que obtenía todas las transacciones incluyendo ocultas
- **Eliminado**: Mutación `showAllHiddenMutation` que mostraba todas las transacciones ocultas desde el servidor
- **Agregado**: Uso del hook `useHiddenTransactions` con `isHidden` y `filterVisible`
- **Agregado**: Función local `handleShowAllHidden` para mostrar transacciones ocultas localmente
- **Agregado**: Mutación `showAllHiddenViajesMutation` para mostrar viajes ocultos (estos sí están en BD)
- **Modificado**: Filtrado de transacciones para usar `isTransactionHidden` en lugar de `t.oculta`
- **Modificado**: Balance del encabezado para usar `transacciones` en lugar de `todasTransaccionesIncOcultas`
- **Modificado**: Conteo de ocultas para usar `getHiddenTransactionsCount()`

#### Compradores (`comprador-detail.tsx`)
- **Eliminado**: Query `todasTransaccionesIncOcultas` que obtenía todas las transacciones incluyendo ocultas
- **Eliminado**: Mutación `showAllHiddenMutation` que mostraba todas las transacciones ocultas desde el servidor
- **Agregado**: Uso del hook `useHiddenTransactions` con `isHidden`
- **Agregado**: Función local `handleShowAllHidden` para mostrar transacciones ocultas localmente
- **Agregado**: Mutación `showAllHiddenViajesMutation` para mostrar viajes ocultos (estos sí están en BD)
- **Modificado**: Componente `CompradorTransaccionesTab` para recibir `isTransactionHidden` y `getHiddenTransactionsCount` como props
- **Modificado**: Filtrado de transacciones para usar `isTransactionHidden` en lugar de `hiddenTransactions.has()`
- **Modificado**: Balance del encabezado para usar `transacciones` en lugar de `todasTransaccionesIncOcultas`
- **Modificado**: Conteo de ocultas para usar `getHiddenTransactionsCount()`

### Nota Importante sobre Viajes
Los viajes (`viajes.oculta`) **mantienen su ocultamiento en la base de datos** porque es una funcionalidad diferente que requiere persistencia entre sesiones. Solo las transacciones manuales usan ocultamiento local temporal.

---

## 2. Corrección de Errores en Funciones de Ocultamiento

### Problema Identificado
Después de la migración, se encontraron errores donde se usaban funciones incorrectas para ocultar transacciones.

### Correcciones Realizadas

#### Volqueteros (`volquetero-detail.tsx`)
- **Error**: Se estaba usando `hideTransactionMutation.mutate(...)` que no existe
- **Solución**: Cambiado a `handleHideTransaction(...)` que es la función local correcta
- **Ubicación**: Línea 1576

#### Compradores (`comprador-detail.tsx`)
- **Error**: En `CompradorTransaccionesTab` se estaba usando `handleHideTransaction(...)` que no existe en ese componente
- **Solución**: Cambiado a `hideTransactionMutation(...)` que es la prop recibida del componente padre
- **Ubicaciones**: Líneas 2373 y 2683

### Resultado
Las transacciones manuales ahora se pueden ocultar correctamente en todos los módulos usando el sistema local temporal.

---

## 3. Corrección de Error de Sintaxis

### Problema
Al eliminar la query `todasTransaccionesIncOcultas` en `mina-detail.tsx`, quedó código residual que causaba un error de sintaxis durante el build.

### Solución
- **Archivo**: `mina-detail.tsx`
- **Cambio**: Eliminado código residual de la query eliminada (líneas 369-390)
- **Resultado**: Build exitoso en Vercel

---

## 4. Unificación del Estilo del Botón "Mostrar Ocultas"

### Objetivo
Unificar el estilo visual del botón "mostrar ocultas" en todos los módulos para que sea consistente con el diseño en Volqueteros.

### Estilo Unificado (Modelo: Volqueteros)
- **Icono**: `<Eye className="w-3 h-3 mr-1" />` (icono de ojo)
- **Color**: `bg-blue-600 hover:bg-blue-700` (azul)
- **Clases**: `h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs`
- **Conteo**: Muestra el número directamente sin el prefijo "+"
- **Sin variant**: No usa `variant="outline"`

### Cambios Realizados por Módulo

#### Compradores (`comprador-detail.tsx`)
- ✅ Cambiado `EyeOff` por `Eye`
- ✅ Cambiado color naranja a azul
- ✅ Removido `variant="outline"`
- ✅ Cambiado `h-7` a `h-8`
- ✅ Removido `<span className="hidden sm:inline">` para mostrar conteo siempre

#### Minas (`mina-detail.tsx`)
- ✅ Agregado icono `<Eye className="w-3 h-3 mr-1" />`
- ✅ Cambiado `+{totalOcultos}` a solo `{totalOcultos}`
- ✅ Cambiado `w-7 p-0` a `px-2`

#### Postobón (`rodmar.tsx`)
- ✅ Agregado icono `<Eye className="w-3 h-3 mr-1" />`
- ✅ Cambiado `+{hiddenPostobonCount}` a solo `{hiddenPostobonCount}`
- ✅ Cambiado `w-7 p-0` a `px-2`

#### LCDM (`rodmar.tsx`)
- ✅ Agregado icono `<Eye className="w-3 h-3 mr-1" />`
- ✅ Cambiado `+{hiddenLcdmCount}` a solo `{hiddenLcdmCount}`
- ✅ Cambiado `w-7 p-0` a `px-2`

#### RodMar Cuentas (`rodmar-cuenta-detail.tsx`)
- ✅ Agregado icono `<Eye className="w-3 h-3 mr-1" />`
- ✅ Cambiado `+{hiddenCuentaCount}` a solo `{hiddenCuentaCount}`
- ✅ Removido `text-white` (ya está implícito)
- ✅ Limpiado clases duplicadas

### Resultado
Todos los botones "mostrar ocultas" ahora tienen un estilo consistente y profesional en toda la aplicación.

---

## Commits Realizados

1. `083167b` - Migrar Minas y Compradores a ocultamiento local temporal de transacciones
2. `6670a20` - Fix: Añadir validación para isTransactionHidden en CompradorTransaccionesTab
3. `f1a83c9` - Fix: Eliminar código residual de query eliminada en mina-detail.tsx
4. `1735d6e` - Fix: Corregir uso de hideTransactionMutation en volquetero-detail.tsx - usar handleHideTransaction
5. `9342ca5` - Fix: Corregir uso de handleHideTransaction en CompradorTransaccionesTab - usar hideTransactionMutation prop
6. `492e055` - Unificar estilo del botón mostrar ocultas en todos los módulos - usar estilo de Volqueteros
7. `902a2c2` - Fix: Corregir botón mostrar ocultas en LCDM - agregar icono Eye

---

## Estado Actual del Sistema

### Ocultamiento de Transacciones
- **Transacciones Manuales**: Ocultamiento local temporal usando `sessionStorage` y el hook `useHiddenTransactions`
  - Solo afecta al usuario actual
  - Se limpia al cambiar de página/pestaña
  - No afecta a otros usuarios
  - No persiste en la base de datos
  - Implementado en: Postobón, LCDM, Volqueteros, Minas, Compradores, RodMar Cuentas

- **Viajes**: Ocultamiento en base de datos
  - Persiste entre sesiones
  - Afecta a todos los usuarios
  - Implementado mediante mutaciones al servidor

### Columnas de Base de Datos
Las columnas `oculta`, `ocultaEnComprador`, `ocultaEnMina`, `ocultaEnVolquetero`, `ocultaEnGeneral` en la tabla `transacciones` ya no son necesarias para los módulos migrados, pero **se mantienen en el esquema** por compatibilidad. Los viajes siguen usando `viajes.oculta` normalmente.

---

## Próximos Pasos Recomendados

1. **Limpieza de Base de Datos** (Opcional):
   - Considerar eliminar las columnas de ocultamiento de `transacciones` después de confirmar que no hay dependencias
   - Mantener `viajes.oculta` que sigue siendo necesario

2. **Testing**:
   - Verificar que el ocultamiento funciona correctamente en todos los módulos
   - Confirmar que los viajes mantienen su ocultamiento en BD
   - Verificar que el estilo unificado se ve correcto en todos los módulos

3. **Documentación**:
   - Actualizar documentación técnica si es necesario
   - Documentar el uso del hook `useHiddenTransactions` para futuros desarrollos

---

## Notas Técnicas

### Hook useHiddenTransactions
El hook `useHiddenTransactions` proporciona:
- `hideTransaction(id)`: Oculta una transacción localmente
- `showTransaction(id)`: Muestra una transacción oculta
- `showAllHidden()`: Muestra todas las transacciones ocultas
- `isHidden(id)`: Verifica si una transacción está oculta
- `getHiddenCount()`: Obtiene el conteo de transacciones ocultas
- `filterVisible(transactions)`: Filtra transacciones excluyendo las ocultas

### Almacenamiento
- Se usa `sessionStorage` con clave `hidden_transactions_${moduleKey}`
- Se limpia automáticamente al cerrar la pestaña
- Se sincroniza automáticamente cuando cambia el estado
