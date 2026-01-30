# Cambios recientes (2026-01-29): Concepto en transacciones de viajes

## Resumen
Se amplió el texto del **concepto** en las transacciones de tipo **Viaje** en los listados de Minas, Compradores y Volqueteros para incluir **ID, placa y peso**.

## Archivos tocados
- `client/src/pages/mina-detail.tsx`
- `client/src/pages/comprador-detail.tsx`
- `client/src/pages/volquetero-detail.tsx`

## Cómo verificar
1) Ir a **Transacciones** en Mina/Comprador/Volquetero.
2) Ubicar una transacción de tipo **Viaje**.
3) Verificar que el concepto muestre: `Viaje <ID> | <Placa> | <Peso>`.

