# Cambios recientes (2026-01-28): Admin ve transacciones de volqueteros

## Contexto
Se detectó que el **detalle de volqueteros** no mostraba transacciones creadas por otros usuarios (p. ej., Operador Financiero),
aunque sí aparecían en **Finanzas**. Esto causaba diferencias de balance visibles solo en el detalle.

## Causa raíz
El endpoint `GET /api/volqueteros/:id/transacciones` filtraba **siempre** por `user_id`,
lo que limitaba la visibilidad a transacciones creadas por el usuario actual.

## Cambio aplicado
Ahora el endpoint replica el mismo criterio de módulos globales:
- Si el usuario tiene permisos de transacciones (`action.TRANSACCIONES.*`) **no** se filtra por `user_id`.
- Si no tiene esos permisos, mantiene el filtrado por `user_id`.

## Archivos tocados
- `server/routes.ts`

## Cómo verificar
1) Iniciar sesión como admin.
2) Abrir un volquetero con transacciones creadas por otros usuarios.
3) Verificar que en el detalle aparecen todas (igual que en Finanzas).

