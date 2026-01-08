# Análisis Fase 2.1: Unificación de Lógica de Carga de Vouchers

## Problema Identificado

La lógica para cargar y manejar vouchers de transacciones está **duplicada** en 3 lugares diferentes. Cada uno tiene código similar pero ligeramente diferente.

---

## 📍 Lugares donde está la lógica duplicada:

### 1. `edit-transaction-modal.tsx` (líneas 252-275)

**Qué hace:**
- Cuando se abre el modal para editar una transacción, carga el voucher si no está en cache
- Verifica si el ID es numérico (solo transacciones manuales, no viajes)
- Si no está cargado, llama a `loadVoucher()` y luego obtiene el valor del cache
- Si ya está en cache, lo obtiene directamente

**Código actual:**
```typescript
// Cargar voucher - siempre intentar cargarlo si no está en cache
let voucherValue = "";
if (currentTransaction.id && typeof currentTransaction.id === 'number') {
  if (!isVoucherLoaded(currentTransaction.id)) {
    try {
      await loadVoucher(currentTransaction.id);
      const loadedVoucher = getVoucherFromCache(currentTransaction.id);
      if (loadedVoucher) {
        voucherValue = loadedVoucher;
      }
    } catch (error) {
      console.error("Error loading voucher:", error);
    }
  } else {
    const cachedVoucher = getVoucherFromCache(currentTransaction.id);
    if (cachedVoucher) {
      voucherValue = cachedVoucher;
    }
  }
}
```

---

### 2. `transaction-detail-modal.tsx` (líneas 69-93)

**Qué hace:**
- Cuando se abre el modal de detalle de transacción, intenta cargar el voucher si no viene en los datos
- Usa un `useEffect` que se ejecuta cuando cambia la transacción o se abre el modal
- Obtiene el voucher del cache o de los datos iniciales de la transacción
- Maneja el estado de carga (`isLoadingVoucher`)

**Código actual:**
```typescript
useEffect(() => {
  if (transaction && open) {
    // Si no tiene voucher en los datos iniciales, intentar cargarlo
    // Solo para transacciones manuales (IDs numéricos), no para transacciones de viaje
    if (!transaction.voucher && transaction.id && typeof transaction.id === 'number') {
      loadVoucher(transaction.id);
    }
  }
}, [transaction, open, loadVoucher]);

// Obtener voucher del cache o de los datos iniciales
const currentVoucher = transaction?.voucher || 
  (typeof transaction?.id === 'number' ? getVoucherFromCache(transaction.id) : null);
const isLoadingVoucher = typeof transaction?.id === 'number' ? isVoucherLoading(transaction.id) : false;
```

---

### 3. `voucher-viewer.tsx` (líneas 16-28)

**Qué hace:**
- Componente que muestra el voucher cuando el usuario hace clic en el botón de "ojo"
- Carga el voucher cuando el usuario quiere verlo (no automáticamente)
- Maneja la visibilidad del voucher (mostrar/ocultar)

**Código actual:**
```typescript
const handleToggleVoucher = async () => {
  if (!hasVoucher) return;

  if (!isVisible) {
    // Cargar voucher si no está cargado
    if (!isVoucherLoaded(transactionId)) {
      await loadVoucher(transactionId);
    }
    setIsVisible(true);
  } else {
    setIsVisible(false);
  }
};

const rawVoucher = getVoucherFromCache(transactionId);
const isLoading = isVoucherLoading(transactionId);
```

---

## 🔄 Lógica Común que se Repite:

1. **Verificar si el ID es válido** (debe ser numérico, no string de viaje)
2. **Verificar si el voucher ya está cargado** (`isVoucherLoaded()`)
3. **Cargar el voucher si no está cargado** (`loadVoucher()`)
4. **Obtener el voucher del cache** (`getVoucherFromCache()`)
5. **Manejar el estado de carga** (`isVoucherLoading()`)

---

## 💡 Solución Propuesta:

### Crear un hook reutilizable: `useTransactionVoucher`

**Qué hará el hook:**
- Recibe el `transactionId` como parámetro
- Automáticamente verifica si es un ID válido (numérico)
- Automáticamente carga el voucher si no está en cache
- Devuelve el voucher y el estado de carga

**Interfaz del hook:**
```typescript
const { voucher, isLoading } = useTransactionVoucher(transactionId);
```

**Ventajas:**
- ✅ Un solo lugar para la lógica
- ✅ Cada componente solo llama al hook
- ✅ Fácil de mantener y testear
- ✅ Comportamiento consistente en todos los lugares

---

## 📝 Cambios que se harán:

### Archivo NUEVO: `hooks/useTransactionVoucher.ts`
- Contendrá la lógica centralizada de carga de vouchers

### Archivo 1: `edit-transaction-modal.tsx`
**ANTES:**
```typescript
const { loadVoucher, getVoucherFromCache, isVoucherLoaded } = useVouchers();
// ... 20+ líneas de lógica duplicada ...
let voucherValue = "";
if (currentTransaction.id && typeof currentTransaction.id === 'number') {
  if (!isVoucherLoaded(currentTransaction.id)) {
    // ... lógica ...
  }
}
```

**DESPUÉS:**
```typescript
const { voucher } = useTransactionVoucher(currentTransaction?.id);
const voucherValue = voucher || "";
```

### Archivo 2: `transaction-detail-modal.tsx`
**ANTES:**
```typescript
const { loadVoucher, getVoucherFromCache, isVoucherLoading } = useVouchers();
useEffect(() => {
  if (transaction && open) {
    if (!transaction.voucher && transaction.id && typeof transaction.id === 'number') {
      loadVoucher(transaction.id);
    }
  }
}, [transaction, open, loadVoucher]);
const currentVoucher = transaction?.voucher || (typeof transaction?.id === 'number' ? getVoucherFromCache(transaction.id) : null);
const isLoadingVoucher = typeof transaction?.id === 'number' ? isVoucherLoading(transaction.id) : false;
```

**DESPUÉS:**
```typescript
const { voucher: loadedVoucher, isLoading: isLoadingVoucher } = useTransactionVoucher(
  transaction?.id && typeof transaction.id === 'number' ? transaction.id : undefined
);
const currentVoucher = transaction?.voucher || loadedVoucher;
```

### Archivo 3: `voucher-viewer.tsx`
**ANTES:**
```typescript
const { loadVoucher, getVoucherFromCache, isVoucherLoading, isVoucherLoaded } = useVouchers();
const handleToggleVoucher = async () => {
  if (!hasVoucher) return;
  if (!isVisible) {
    if (!isVoucherLoaded(transactionId)) {
      await loadVoucher(transactionId);
    }
    setIsVisible(true);
  }
};
const rawVoucher = getVoucherFromCache(transactionId);
const isLoading = isVoucherLoading(transactionId);
```

**DESPUÉS:**
```typescript
const { voucher: rawVoucher, isLoading } = useTransactionVoucher(transactionId);
const handleToggleVoucher = () => {
  if (!hasVoucher) return;
  setIsVisible(!isVisible);
};
// El voucher ya está cargado automáticamente por el hook
```

---

## 📊 Impacto:

- **Líneas de código eliminadas**: ~40-50 líneas duplicadas
- **Archivos modificados**: 3
- **Archivo nuevo**: 1 (hook)
- **Riesgo**: Medio (afecta cómo se cargan los vouchers)

---

## ⚠️ Consideraciones:

1. **Comportamiento diferente en voucher-viewer:**
   - Actualmente carga el voucher solo cuando el usuario hace clic
   - El hook lo cargaría automáticamente
   - **Solución**: El hook puede tener un parámetro opcional para carga "lazy" (solo cuando se necesita)

2. **Compatibilidad:**
   - El hook debe manejar IDs undefined/null
   - Debe manejar IDs que no son numéricos (como 'viaje-123')
   - Debe mantener la misma lógica de cache

3. **Testing:**
   - Probar que los vouchers se cargan correctamente en cada modal
   - Verificar que el cache funciona
   - Verificar que no hay cargas duplicadas

---

## ✅ Beneficios Esperados:

1. **Menos código duplicado**: ~40-50 líneas eliminadas
2. **Más fácil de mantener**: Un solo lugar para corregir bugs
3. **Comportamiento consistente**: Todos los lugares usan la misma lógica
4. **Más fácil de testear**: El hook se puede testear independientemente
5. **Más fácil de extender**: Si necesitas agregar lógica, solo la agregas en un lugar





