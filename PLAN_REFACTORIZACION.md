# Plan de Refactorización - RodMar Inventory

## Objetivo
Mejorar la calidad, mantenibilidad y consistencia del código sin poner en riesgo la integridad de la aplicación. Refactorización progresiva y segura.

---

## Estrategia General

### Principios de Seguridad
1. **Refactorización Incremental**: Cambios pequeños y testeables
2. **Sin Cambios de Comportamiento**: Solo estructura, no funcionalidad
3. **Pruebas Manuales**: Verificar cada cambio antes de continuar
4. **Commits Atómicos**: Un cambio por commit para fácil rollback
5. **Mantenimiento de Compatibilidad**: No romper código existente

### Fases de Ejecución
- **Fase 1**: Utilidades compartidas (bajo riesgo)
- **Fase 2**: Hooks personalizados (riesgo medio)
- **Fase 3**: Lógica de invalidación (riesgo medio-alto)
- **Fase 4**: Componentes compartidos (riesgo alto, hacer al final)

---

## FASE 1: Utilidades Compartidas (BAJO RIESGO)
**Prioridad: Alta | Riesgo: Bajo | Tiempo Estimado: 2-3 horas**

### 1.1. Utilidades de Filtrado de Fechas
**Problema**: Lógica de `getDateRange` duplicada en múltiples archivos:
- `tercero-detail.tsx` (líneas 425-547)
- `mina-detail.tsx` (líneas 425-547)
- `transacciones.tsx` (líneas 297-347)
- `rodmar.tsx` - `LcdmTransactionsTab` (líneas 1995-2042)
- `rodmar-cuenta-detail.tsx` (líneas 94-168)
- `comprador-detail.tsx` (probablemente también)
- `volquetero-detail.tsx` (probablemente también)

**Solución**:
```typescript
// lib/date-filter-utils.ts (NUEVO)
export type DateFilterType = "todos" | "exactamente" | "entre" | "despues-de" | 
  "antes-de" | "hoy" | "ayer" | "esta-semana" | "semana-pasada" | 
  "este-mes" | "mes-pasado" | "este-año" | "año-pasado";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export function getDateRangeFromFilter(
  filterType: DateFilterType,
  filterValue?: string,
  filterValueEnd?: string
): DateRange | null {
  // Implementación centralizada con manejo correcto de zona horaria
}

export function filterTransactionsByDateRange(
  transactions: any[],
  dateRange: DateRange | null
): any[] {
  // Filtrado centralizado usando comparación de strings (YYYY-MM-DD)
  // Evita problemas de zona horaria
}
```

**Archivos a Crear**:
- `client/src/lib/date-filter-utils.ts`

**Archivos a Modificar** (uno por uno):
1. `client/src/pages/tercero-detail.tsx`
2. `client/src/pages/transacciones.tsx`
3. `client/src/components/modules/rodmar.tsx` (LcdmTransactionsTab)
4. `client/src/pages/mina-detail.tsx`
5. `client/src/pages/rodmar-cuenta-detail.tsx`
6. `client/src/pages/comprador-detail.tsx`
7. `client/src/pages/volquetero-detail.tsx`

**Beneficios**:
- ✅ Un solo lugar para corregir bugs de fecha
- ✅ Consistencia en el manejo de zonas horarias
- ✅ Fácil de testear
- ✅ Reduce ~500 líneas de código duplicado

---

### 1.2. Unificación de Funciones de Formateo
**Problema**: Múltiples funciones `formatCurrency` en diferentes archivos:
- `lib/utils.tsx` (línea 9)
- `lib/format-utils.ts` (línea 3)
- `lib/calculations.ts` (línea 162)

**Solución**:
- Mantener una sola función en `lib/format-utils.ts` (más completa)
- Eliminar duplicados en `utils.tsx` y `calculations.ts`
- Actualizar imports en todos los archivos

**Archivos a Modificar**:
1. `lib/format-utils.ts` (mantener y mejorar)
2. `lib/utils.tsx` (eliminar `formatCurrency`, `formatNumber`, `parseNumericInput`)
3. `lib/calculations.ts` (eliminar funciones duplicadas)
4. Actualizar imports en archivos que usen estas funciones

**Beneficios**:
- ✅ Consistencia en formateo
- ✅ Menos código duplicado
- ✅ Un solo lugar para mejorar

---

### 1.3. Utilidades de Cálculo de Balance
**Problema**: Lógica de cálculo de balance similar pero con variaciones:
- `tercero-detail.tsx` (líneas 356-378)
- `rodmar-cuenta-detail.tsx` (líneas 526-576)
- `calculations.ts` (ya tiene algunas, pero incompletas)

**Solución**:
```typescript
// lib/balance-calculator.ts (NUEVO o extender calculations.ts)
export interface BalanceResult {
  positivos: number;
  negativos: number;
  balance: number;
}

export function calculateEntityBalance(
  transactions: any[],
  entityType: 'mina' | 'comprador' | 'volquetero' | 'tercero' | 'rodmar',
  entityId: string | number
): BalanceResult {
  // Lógica centralizada
}

// Variantes específicas si es necesario
export function calculateMinaBalanceWithViajes(viajes: any[], transacciones: any[], minaId: number): number {
  // Ya existe en calculations.ts, solo mover aquí
}
```

**Archivos a Crear/Modificar**:
- Consolidar en `lib/calculations.ts` o crear `lib/balance-calculator.ts`

**Beneficios**:
- ✅ Consistencia en cálculos
- ✅ Fácil de testear
- ✅ Reduce errores de lógica

---

## FASE 2: Hooks Personalizados (RIESGO MEDIO)
**Prioridad: Media-Alta | Riesgo: Medio | Tiempo Estimado: 3-4 horas**

### 2.1. Hook para Carga de Vouchers
**Problema**: Lógica de carga de vouchers repetida en:
- `edit-transaction-modal.tsx` (líneas 254-275)
- `transaction-detail-modal.tsx` (líneas 81-93)
- `voucher-viewer.tsx` (líneas 16-28)

**Solución**:
```typescript
// hooks/useTransactionVoucher.ts (NUEVO)
export function useTransactionVoucher(transactionId: number | undefined | string) {
  const { loadVoucher, getVoucherFromCache, isVoucherLoaded, isVoucherLoading } = useVouchers();
  const [voucher, setVoucher] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!transactionId || typeof transactionId !== 'number') {
      setVoucher(null);
      return;
    }

    if (isVoucherLoaded(transactionId)) {
      setVoucher(getVoucherFromCache(transactionId));
    } else {
      setIsLoading(true);
      loadVoucher(transactionId).then(() => {
        setVoucher(getVoucherFromCache(transactionId));
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [transactionId]);

  return { voucher, isLoading };
}
```

**Archivos a Crear**:
- `client/src/hooks/useTransactionVoucher.ts`

**Archivos a Modificar**:
1. `components/forms/edit-transaction-modal.tsx`
2. `components/modals/transaction-detail-modal.tsx`
3. `components/ui/voucher-viewer.tsx` (si aplica)

**Beneficios**:
- ✅ Lógica centralizada
- ✅ Más fácil de mantener
- ✅ Reutilizable

---

### 2.2. Hook para Invalidación de Queries de Transacciones
**Problema**: Lógica de invalidación repetida en múltiples modales:
- `new-transaction-modal.tsx` (líneas 243-441)
- `edit-transaction-modal.tsx` (líneas 328-617)
- `delete-transaction-modal.tsx` (líneas 46-357)

**Solución**:
```typescript
// hooks/useInvalidateTransactionQueries.ts (NUEVO)
export function useInvalidateTransactionQueries() {
  const queryClient = useQueryClient();

  return useCallback((
    originalTransaction?: any,
    updatedTransaction?: any,
    affectedEntityTypes?: Set<string>
  ) => {
    // Lógica centralizada de invalidación
    // Similar a invalidate-trip-queries.ts pero para transacciones
  }, [queryClient]);
}
```

**Archivos a Crear**:
- `client/src/hooks/useInvalidateTransactionQueries.ts`

**Archivos a Modificar**:
1. `components/forms/new-transaction-modal.tsx`
2. `components/forms/edit-transaction-modal.tsx`
3. `components/forms/delete-transaction-modal.tsx`
4. `components/modals/complete-transaction-modal.tsx`

**Beneficios**:
- ✅ Reduce ~300 líneas de código duplicado
- ✅ Consistencia en invalidación
- ✅ Fácil de actualizar cuando cambien las queries

---

## FASE 3: Lógica de Invalidación (RIESGO MEDIO-ALTO)
**Prioridad: Media | Riesgo: Medio-Alto | Tiempo Estimado: 4-5 horas**

### 3.1. Consolidar Invalidación de Queries de Transacciones
**Problema**: Lógica de invalidación muy repetitiva y propensa a errores.

**Solución**:
- Extender `lib/invalidate-trip-queries.ts` o crear `lib/invalidate-transaction-queries.ts`
- Similar al patrón ya existente para viajes

**Archivos a Crear/Modificar**:
- `lib/invalidate-transaction-queries.ts` (NUEVO)

**Nota**: Esta fase requiere mucho testing porque afecta la sincronización de datos en tiempo real.

---

## FASE 4: Componentes Compartidos (RIESGO ALTO - HACER AL FINAL)
**Prioridad: Baja | Riesgo: Alto | Tiempo Estimado: 6-8 horas**

### 4.1. Componente Compartido de Tarjeta de Transacción
**Problema**: Tarjetas de transacción similares en múltiples lugares:
- `transacciones.tsx` (líneas 1009-1203)
- `comprador-detail.tsx` - `CompradorTransaccionesTab` (líneas 2433-2713)
- `mina-detail.tsx` (probablemente)
- `rodmar-cuenta-detail.tsx` (líneas 804-1015)

**Solución**:
```typescript
// components/transactions/TransactionCard.tsx (NUEVO)
interface TransactionCardProps {
  transaction: TransaccionWithSocio;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  searchTerm?: string;
  // ... otras props personalizables
}
```

**Nota**: Esta refactorización es compleja porque las tarjetas tienen variaciones. Hacer solo si hay tiempo y es necesario.

---

## Plan de Ejecución Recomendado

### Semana 1: Fase 1 (Utilidades)
1. Día 1-2: Utilidades de Filtrado de Fechas (1.1)
2. Día 3: Unificación de Formateo (1.2)
3. Día 4-5: Utilidades de Balance (1.3)

### Semana 2: Fase 2 (Hooks)
1. Día 1-2: Hook de Vouchers (2.1)
2. Día 3-5: Hook de Invalidación (2.2)

### Semana 3: Fase 3 (Invalidación)
1. Día 1-5: Consolidar Invalidación (3.1) - Testing extensivo

### Semana 4: Fase 4 (Opcional)
1. Solo si es necesario y hay tiempo

---

## Checklist de Seguridad para Cada Cambio

Antes de hacer commit:
- [ ] El código compila sin errores
- [ ] No hay warnings nuevos
- [ ] Prueba manual básica (crear, editar, eliminar transacción)
- [ ] Verificar que los filtros de fecha funcionan
- [ ] Verificar que los balances se calculan correctamente
- [ ] Verificar que la invalidación funciona (actualización en tiempo real)
- [ ] Revisar que no se rompió nada en otros módulos
- [ ] Commit con mensaje descriptivo

---

## Métricas de Éxito

### Código Duplicado
- **Antes**: ~1500 líneas duplicadas estimadas
- **Después**: <200 líneas duplicadas
- **Reducción**: ~85%

### Mantenibilidad
- **Antes**: Cambios requieren tocar 5-7 archivos
- **Después**: Cambios requieren tocar 1-2 archivos
- **Mejora**: ~70% menos archivos a modificar

### Tiempo de Desarrollo
- **Antes**: ~2 horas para agregar nuevo filtro de fecha
- **Después**: ~15 minutos (solo actualizar utilidad)
- **Mejora**: ~87% más rápido

---

## Riesgos y Mitigaciones

### Riesgo 1: Romper Filtros de Fecha
**Mitigación**: 
- Testing exhaustivo en cada módulo
- Mantener código antiguo comentado temporalmente
- Rollback rápido con Git

### Riesgo 2: Invalidación Incorrecta
**Mitigación**:
- Testing en tiempo real con múltiples clientes
- Revisar logs de WebSocket
- Validar que balances se actualizan correctamente

### Riesgo 3: Problemas de Zona Horaria
**Mitigación**:
- Usar comparación de strings (YYYY-MM-DD) en lugar de Date objects
- Testing con diferentes zonas horarias
- Documentar el enfoque elegido

---

## Recomendación Final

**Empezar con Fase 1.1 (Utilidades de Filtrado de Fechas)** porque:
1. ✅ Alto impacto (7 archivos afectados)
2. ✅ Bajo riesgo (solo funciones utilitarias)
3. ✅ Fácil de testear
4. ✅ Beneficios inmediatos

**Evitar Fase 4 (Componentes Compartidos)** inicialmente porque:
- ❌ Alto riesgo de romper UI
- ❌ Muchas variaciones entre implementaciones
- ❌ Beneficio menos inmediato

---

## Notas Adicionales

- **No refactorizar código que funciona perfectamente** si no hay duplicación significativa
- **Priorizar calidad sobre cantidad**: Mejor hacer bien las Fases 1-2 que hacer mal todas
- **Documentar cambios**: Agregar JSDoc a funciones nuevas
- **Mantener retrocompatibilidad**: No cambiar signatures de funciones públicas sin razón
- **Testing progresivo**: Probar cada cambio antes de continuar





