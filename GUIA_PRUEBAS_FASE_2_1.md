# Guía de Pruebas - Fase 2.1: Hook de Vouchers

## ¿Qué cambió?

Se creó un hook centralizado (`useTransactionVoucher`) que maneja automáticamente la carga de vouchers (comprobantes) de transacciones. Antes, cada componente tenía su propia lógica duplicada para cargar vouchers.

## ¿Cómo te afecta?

**En teoría, NO debería afectarte visualmente** - todo debería funcionar exactamente igual que antes. Los cambios son internos (refactorización de código).

**Sin embargo, es importante probar** porque este cambio afecta cómo se cargan y muestran los vouchers en varios lugares de la aplicación.

---

## ✅ Qué debes probar:

### 1. Modal de Editar Transacción

**Dónde:** Cualquier página donde puedas editar una transacción (ej: `/transacciones`, `/rodmar`, `/minas`, etc.)

**Pasos:**
1. Abre una transacción que **SÍ tenga voucher** (comprobante)
2. Haz clic en el botón de editar (lápiz)
3. **Verifica que:**
   - El modal se abre correctamente
   - El voucher aparece en el campo de "Comprobante" (si la transacción tiene uno)
   - Puedes ver la imagen del voucher si está cargado
   - Puedes subir un nuevo voucher si quieres

**Prueba con:**
- ✅ Transacción con voucher
- ✅ Transacción sin voucher
- ✅ Transacciones de diferentes tipos (mina, comprador, volquetero, tercero, etc.)

---

### 2. Modal de Detalle de Transacción

**Dónde:** Cualquier página donde puedas ver detalles de una transacción

**Pasos:**
1. Haz clic en una transacción que **SÍ tenga voucher**
2. Se abre el modal de detalle
3. **Verifica que:**
   - El voucher se muestra correctamente (si la transacción tiene uno)
   - Puedes hacer clic en el botón de "Ver comprobante" y se muestra
   - La imagen del voucher se carga correctamente
   - No hay errores en la consola del navegador (F12)

**Prueba con:**
- ✅ Transacción con voucher
- ✅ Transacción sin voucher
- ✅ Transacciones de viaje (no deberían tener voucher)

---

### 3. Componente Voucher Viewer (Botón de Ojo)

**Dónde:** Lugares donde aparece el botón de "ojo" para ver vouchers

**Pasos:**
1. Encuentra una transacción que tenga voucher
2. Busca el botón de "ojo" (👁️) cerca de la transacción
3. Haz clic en el botón
4. **Verifica que:**
   - El voucher se muestra correctamente
   - La imagen se carga sin errores
   - Puedes ocultar el voucher haciendo clic de nuevo
   - El botón muestra un spinner mientras carga (si es necesario)

---

## 🔍 Qué buscar (Posibles Problemas):

### ❌ Problema 1: Voucher no aparece
**Síntoma:** Abres una transacción que debería tener voucher, pero no se muestra

**Qué hacer:**
- Abre la consola del navegador (F12)
- Busca errores en rojo
- Verifica que la transacción realmente tiene voucher en la base de datos

### ❌ Problema 2: Voucher tarda mucho en cargar
**Síntoma:** El voucher tarda mucho tiempo en aparecer o nunca aparece

**Qué hacer:**
- Verifica tu conexión a internet
- Revisa la consola del navegador para errores de red
- Intenta recargar la página

### ❌ Problema 3: Error al editar transacción con voucher
**Síntoma:** Cuando intentas editar una transacción, el voucher no se carga en el formulario

**Qué hacer:**
- Verifica que el voucher aparece en el modal de detalle (para confirmar que existe)
- Intenta editar de nuevo
- Revisa la consola del navegador

### ❌ Problema 4: Voucher aparece duplicado o múltiples veces
**Síntoma:** El voucher se muestra varias veces o hay comportamientos extraños

**Qué hacer:**
- Recarga la página
- Limpia el cache del navegador
- Revisa la consola del navegador

---

## 📋 Checklist Rápido (5 minutos):

- [ ] Editar una transacción con voucher → El voucher aparece en el formulario
- [ ] Editar una transacción sin voucher → No hay errores
- [ ] Ver detalle de transacción con voucher → El voucher se muestra correctamente
- [ ] Ver detalle de transacción sin voucher → No hay errores
- [ ] Usar botón de "ojo" para ver voucher → El voucher se muestra correctamente
- [ ] No hay errores en la consola del navegador (F12)

---

## 🎯 Lugares Específicos para Probar:

### Módulo General de Transacciones (`/transacciones`)
- Editar transacción con voucher
- Ver detalle de transacción con voucher

### Módulo de Terceros (`/rodmar` → Tab "Terceros" → Abrir tercero)
- Editar transacción con voucher
- Ver detalle de transacción con voucher

### Módulo de Minas (`/minas` → Abrir mina)
- Editar transacción con voucher
- Ver detalle de transacción con voucher

### Módulo de Compradores (`/compradores` → Abrir comprador)
- Editar transacción con voucher
- Ver detalle de transacción con voucher

### Módulo de Volqueteros (`/volqueteros` → Abrir volquetero)
- Editar transacción con voucher
- Ver detalle de transacción con voucher

### Módulo RodMar - Cuentas (`/rodmar` → Tab "Cuentas" → Abrir cuenta)
- Editar transacción con voucher
- Ver detalle de transacción con voucher

---

## ⚠️ Si Encuentras Problemas:

1. **Abre la consola del navegador** (F12 → Console)
2. **Busca errores en rojo**
3. **Toma una captura de pantalla** del error
4. **Anota qué estabas haciendo** cuando ocurrió el error
5. **Dime qué encontraste** y lo corrijo

---

## 📝 Notas Importantes:

- **Los vouchers deberían funcionar exactamente igual que antes**
- **No debería haber cambios visuales** - solo cambios internos de código
- **Si algo funciona diferente, es un bug** y debe reportarse
- **El hook carga los vouchers automáticamente** - no necesitas hacer nada especial

---

## 🎯 Tiempo Estimado:

- **Prueba básica**: 5-10 minutos
- **Prueba completa**: 15-20 minutos

---

## ✅ Si Todo Funciona Bien:

Si después de probar todo funciona correctamente, significa que la refactorización fue exitosa y el código está mejor organizado sin romper funcionalidad.

