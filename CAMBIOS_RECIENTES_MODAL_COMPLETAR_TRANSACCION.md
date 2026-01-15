# Cambios recientes: Modal "Completar Transacción" (RodMar)

## Resumen
Se corrigió el modal de **Completar Transacción** para que el selector de **Cuenta RodMar** ya no muestre opciones hardcodeadas/obsoletas y, en su lugar, cargue las cuentas reales desde la base de datos.

## Problema
- El modal incluía un arreglo `rodmarOptions` con cuentas RodMar hardcodeadas.
- Al renombrar o administrar cuentas RodMar desde admin, el modal seguía mostrando opciones antiguas, causando confusión y posibles selecciones incorrectas.

## Solución
- Se eliminó el arreglo hardcodeado.
- Se agregó una consulta con React Query al endpoint `GET /api/rodmar-cuentas`.
- Las opciones del selector se construyen dinámicamente como:
  - `label`: `cuenta.nombre`
  - `value`: `cuenta.codigo` (para persistencia correcta en transacciones)

## Archivo modificado
- `client/src/components/modals/complete-transaction-modal.tsx`


