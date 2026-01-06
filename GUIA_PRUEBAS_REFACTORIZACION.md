# Guía de Pruebas - Refactorización Fase 1

Esta guía te ayudará a verificar que todos los cambios de refactorización funcionan correctamente.

## ✅ Fase 1.1: Filtros de Fecha

### Módulo General de Transacciones (`/transacciones`)

1. **Filtro "Exactamente":**
   - Selecciona "Exactamente" en el filtro de fecha
   - Elige una fecha específica (ej: 15 de noviembre)
   - Verifica que solo aparecen transacciones de esa fecha exacta
   - Prueba con diferentes fechas

2. **Filtro "Entre":**
   - Selecciona "Entre" en el filtro de fecha
   - Elige una fecha de inicio (ej: 1 de noviembre)
   - Elige una fecha de fin (ej: 30 de noviembre)
   - Verifica que aparecen todas las transacciones entre esas fechas (incluyendo las fechas límite)
   - Prueba con diferentes rangos

3. **Otros filtros:**
   - Prueba "Hoy", "Ayer", "Esta semana", "Semana pasada"
   - Verifica que cada uno muestra las transacciones correctas

### Módulo de Terceros (`/rodmar` → Tab "Terceros" → Click en un tercero)

1. **Filtro "Exactamente":**
   - Selecciona "Exactamente"
   - Elige una fecha
   - Verifica que solo aparecen transacciones de esa fecha

2. **Filtro "Entre":**
   - Selecciona "Entre"
   - Elige fecha inicio y fin
   - Verifica que aparecen todas las transacciones en ese rango

3. **Otros filtros:**
   - Prueba "Hoy", "Esta semana", etc.
   - Verifica que funcionan correctamente

### Módulo de Minas (`/minas` → Click en una mina)

1. **Filtros de transacciones:**
   - Prueba los filtros de fecha en la pestaña de transacciones
   - Verifica "Exactamente", "Entre", "Hoy", etc.

2. **Filtros de viajes:**
   - Prueba los filtros de fecha en la pestaña de viajes
   - Verifica que funcionan correctamente

### Módulo RodMar - Tab LCDM (`/rodmar` → Tab "LCDM")

1. **Filtro "Entre":**
   - Selecciona "Entre"
   - Elige fecha inicio y fin
   - Verifica que aparecen todas las transacciones en ese rango

2. **Otros filtros:**
   - Prueba "Exactamente", "Hoy", etc.

### Módulo Cuentas RodMar (`/rodmar` → Tab "Cuentas" → Click en una cuenta)

1. **Filtros de fecha:**
   - Prueba todos los filtros de fecha
   - Verifica "Exactamente", "Entre", "Hoy", etc.
   - Asegúrate de que las transacciones filtradas son correctas

---

## ✅ Fase 1.2: Formateo de Moneda y Números

Esta fase es más visual. Simplemente verifica que:

1. **Los montos se muestran correctamente:**
   - En todos los módulos, los montos deben aparecer formateados como moneda colombiana
   - Ejemplo: `$1.234.567` (con puntos como separadores de miles)
   - Sin símbolo de decimales (solo números enteros)

2. **Lugares para verificar:**
   - Tarjetas de balance en terceros, minas, compradores, volqueteros
   - Listas de transacciones
   - Modales de detalle de transacciones
   - Tablas de resumen financiero

3. **Números grandes:**
   - Si ves números grandes (millones), verifica que tengan puntos como separadores
   - Ejemplo: `$10.500.000` (no `$10500000`)

---

## ✅ Fase 1.3: Cálculos de Balance

### Módulo de Terceros (`/rodmar` → Tab "Terceros" → Click en un tercero)

1. **Tarjeta de Balance:**
   - Verifica que el balance se calcula correctamente
   - Debe mostrar:
     - Cantidad de transacciones
     - Total de positivos (verde)
     - Total de negativos (rojo)
     - Balance neto (verde si positivo, rojo si negativo)

2. **Lógica del balance:**
   - **Positivos**: Transacciones DONDE el tercero es el ORIGEN (deQuienTipo='tercero')
   - **Negativos**: Transacciones DONDE el tercero es el DESTINO (paraQuienTipo='tercero')
   - **Balance**: Positivos - Negativos

3. **Con filtros:**
   - Aplica un filtro de fecha
   - Verifica que el balance se recalcula solo para las transacciones filtradas

### Módulo Cuentas RodMar (`/rodmar` → Tab "Cuentas" → Click en una cuenta)

1. **Tarjeta de Balance:**
   - Verifica que el balance se calcula correctamente
   - Debe mostrar positivos, negativos y balance neto

2. **Lógica del balance:**
   - **Positivos**: Transacciones que ENTRAN a la cuenta (paraQuienTipo='rodmar' y paraQuienId=cuentaId) + Inversiones positivas
   - **Negativos**: Transacciones que SALEN de la cuenta (deQuienTipo='rodmar' y deQuienId=cuentaId) + Inversiones negativas
   - **Balance**: Positivos - Negativos

3. **Con filtros:**
   - Aplica un filtro de fecha
   - Verifica que el balance se recalcula correctamente

---

## 🔍 Checklist Rápido

### Filtros de Fecha (Fase 1.1)
- [ ] Módulo Transacciones: Filtro "Exactamente" funciona
- [ ] Módulo Transacciones: Filtro "Entre" funciona
- [ ] Módulo Terceros: Filtro "Exactamente" funciona
- [ ] Módulo Terceros: Filtro "Entre" funciona
- [ ] Módulo Minas: Filtros de fecha funcionan
- [ ] Módulo RodMar LCDM: Filtro "Entre" funciona
- [ ] Módulo Cuentas RodMar: Filtros de fecha funcionan

### Formateo (Fase 1.2)
- [ ] Los montos se muestran con formato de moneda ($1.234.567)
- [ ] Los números grandes tienen separadores de miles correctos
- [ ] No hay errores visuales en la presentación de montos

### Balances (Fase 1.3)
- [ ] Balance de Terceros se calcula correctamente
- [ ] Balance de Cuentas RodMar se calcula correctamente
- [ ] Los balances se actualizan al aplicar filtros
- [ ] Los colores (verde/rojo) se muestran correctamente

---

## ⚠️ Si Encuentras Problemas

1. **Filtros de fecha no funcionan:**
   - Verifica que la fecha está en formato correcto (YYYY-MM-DD)
   - Revisa la consola del navegador (F12) para errores
   - Verifica que las transacciones tienen fechas válidas

2. **Balance incorrecto:**
   - Verifica que las transacciones están asociadas correctamente a la entidad
   - Revisa que los tipos de transacción (deQuienTipo, paraQuienTipo) son correctos
   - Compara con el balance anterior (si tienes datos de referencia)

3. **Formateo incorrecto:**
   - Verifica que los números se muestran con formato colombiano
   - Revisa la consola del navegador para errores JavaScript

---

## 📝 Notas

- **No debería haber cambios visibles** en la funcionalidad - todo debería funcionar igual que antes
- Los cambios son internos (refactorización de código), no cambios de funcionalidad
- Si algo funciona diferente, es un bug y debe reportarse

---

## 🎯 Tiempo Estimado

- **Filtros de Fecha**: 15-20 minutos
- **Formateo**: 5 minutos (revisión visual rápida)
- **Balances**: 10-15 minutos
- **Total**: ~30-40 minutos



