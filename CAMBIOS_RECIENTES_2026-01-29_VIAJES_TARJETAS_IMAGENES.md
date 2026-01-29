# Cambios recientes (2026-01-29): Viajes, tarjetas e imágenes

## Resumen
Se mejoraron las vistas de viajes en Minas, Compradores y Volqueteros, y se añadieron/ajustaron las imágenes descargables con totales y filtros. También se unificó el comportamiento del botón Editar para abrir el modal existente de edición de viajes.

## Cambios principales
- **Volqueteros**: se agregó imagen descargable en la pestaña de viajes con filtro/búsqueda y fila de totales.
- **Minas**: la imagen descargable de viajes ahora incluye fila de totales.
- **Compradores/Minas/Volqueteros**: las tarjetas de viajes usan `TripCard` (formato unificado) y el botón **Editar** abre el modal existente de edición de viajes.
- **Volqueteros**: botón “Ver recibo” disponible dentro de la tarjeta (en la fila de ¿QPF?).

## Archivos tocados
- `client/src/components/modals/volquetero-viajes-image-modal.tsx` (nuevo)
- `client/src/components/modals/viajes-image-modal.tsx`
- `client/src/components/trip-card.tsx`
- `client/src/pages/comprador-detail.tsx`
- `client/src/pages/mina-detail.tsx`
- `client/src/pages/volquetero-detail.tsx`

## Cómo verificar
1) **Volqueteros → Viajes**: usar búsqueda/filtro de fecha, descargar imagen y ver fila de totales.
2) **Minas → Viajes**: descargar imagen y confirmar fila de totales.
3) **Compradores/Minas/Volqueteros**: botón **Editar** en tarjeta abre el modal de edición de viaje.
4) **Volqueteros → Viajes**: botón **Ver recibo** en tarjeta.

