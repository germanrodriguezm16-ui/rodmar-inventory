# Cambios recientes: Imagen de Viajes (Compradores) y fletes

## Resumen
Se mejoró la imagen descargable (PNG) de **Compradores → Viajes** para que la tabla sea consistente con quién paga el flete:
- Si el flete **no lo paga el comprador**, no se muestran valores de flete.
- Si en el set exportado **nadie** paga flete como comprador, las columnas de flete se ocultan por completo.

## Regla de negocio aplicada
Se considera que el comprador paga el flete cuando:
- `quienPagaFlete === "comprador"` o
- `quienPagaFlete === "El comprador"`

## Cambios en la tabla exportada
- Columnas de flete: **FUT / OGF / T. FLETE**
  - Se ocultan completamente si ningún viaje del set cumple la regla anterior.
  - Si están visibles, los viajes donde no aplica muestran `"-"`.

## Cambios en la fila TOTAL
La fila TOTAL ahora incluye:
- **PESO**: suma sobre viajes completados
- **VUT**: promedio simple sobre viajes completados (solo valores numéricos), `"-"` si no hay datos
- **FUT**: promedio simple sobre viajes completados donde paga el comprador (solo valores numéricos), `"-"` si no hay datos
- **OGF**: suma solo cuando paga el comprador
- Se mantienen: **T. VENTA**, **T. FLETE**, **A CONSIGNAR**

## Archivo modificado
- `client/src/components/modals/comprador-viajes-image-modal.tsx`


