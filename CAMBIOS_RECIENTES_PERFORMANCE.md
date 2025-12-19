# Cambios Recientes - Optimización de Performance

## Fecha: Diciembre 2025

### Resumen
Se implementaron optimizaciones críticas para reducir el tiempo de carga inicial del módulo **Principal (Viajes)** y mejorar la experiencia en dispositivos móviles Android.

---

## 1. Optimización: Diferir carga de lista de pendientes

**Problema:** Al entrar al módulo Principal, el Dashboard siempre cargaba la lista completa de transacciones pendientes (`/api/transacciones/pendientes`), compitiendo con la carga de viajes y ralentizando el primer paint.

**Solución:**
- La lista de pendientes ahora se carga **~1.5s después** del montaje del Dashboard, o inmediatamente si el usuario abre el modal de pendientes o llega una notificación.
- El conteo de pendientes (`/api/transacciones/pendientes/count`) sigue cargándose inmediatamente para el badge/indicador.

**Archivos modificados:**
- `client/src/pages/dashboard.tsx`

**Impacto:** Reducción de requests simultáneos en la carga inicial, mejorando la percepción de velocidad.

---

## 2. Optimización: Eliminar dynamic imports en queryFn de viajes

**Problema:** El `queryFn` de `/api/viajes` hacía `await import()` de `apiUrl` y `getAuthToken` antes de hacer el fetch, causando delay en Android por descarga/parsing de chunks.

**Solución:**
- Cambiados a imports estáticos en `principal.tsx`.

**Archivos modificados:**
- `client/src/components/modules/principal.tsx`

**Impacto:** Eliminación de delay artificial antes del fetch en Android.

---

## 3. Optimización CRÍTICA: No enviar recibos base64 en listado de viajes

**Problema:** El endpoint `/api/viajes?page=1&limit=50` enviaba **~5.3MB** de datos porque cada viaje incluía el campo `recibo` como base64 (`data:image/jpeg;base64,...`). Esto causaba:
- Tiempos de carga >5s en móvil
- Alto consumo de memoria/parsing JSON
- Posibles crashes en Android

**Solución:**
- **Backend:** `getViajes()` y `getViajesPaginated()` ahora **excluyen** el campo `recibo` del payload.
- En su lugar, envían un flag `tieneRecibo: boolean` para indicar si existe recibo.
- **Frontend:** El botón "Ver recibo" en `EditTripModal` y `TripCard` carga el recibo **on-demand** desde `GET /recibo/:tripId` cuando el usuario lo solicita.

**Archivos modificados:**
- `shared/schema.ts` (agregado `tieneRecibo?: boolean` a `ViajeWithDetails`)
- `server/db-storage.ts` (excluido `recibo`, agregado `tieneRecibo` en queries de listado)
- `client/src/components/ui/receipt-image-upload.tsx` (soporte para carga remota de recibo)
- `client/src/components/forms/edit-trip-modal.tsx` (carga lazy del recibo)
- `client/src/components/modules/principal.tsx` (actualizado queryKey para romper caché)

**Impacto esperado:**
- Reducción de payload de **~5.3MB a <200-400KB** para 50 viajes
- Tiempo de carga inicial de **>5s a ~1-2.5s** (PC) y **~2-4s** (Android)
- Menor consumo de RAM y mejor estabilidad en móviles

---

## 4. Feature: Botón "Ver recibo" en tarjeta de viaje

**Descripción:**
- Agregado botón "Ver recibo" en la **tercera fila, tercera columna** de la tarjeta de viaje (`TripCard`).
- Solo aparece si `viaje.tieneRecibo === true`.
- Carga el recibo on-demand y lo muestra en un modal `ImageViewer`.

**Archivos modificados:**
- `client/src/components/trip-card.tsx`

**Nota:** El botón solo aparece cuando **NO** es contexto `volquetero` (en volqueteros, la fila 3 muestra FUT/OGF/T. Flete).

---

## 5. Fix: Conversión de blob a data URL para recibos

**Problema:** Al cargar el recibo, se creaba un `blob:` URL que se revocaba al cerrar el modal. Al reabrir, el estado todavía contenía el blob URL revocado, causando `ERR_FILE_NOT_FOUND`.

**Solución:**
- El blob ahora se convierte a **data URL (base64)** usando `FileReader.readAsDataURL()`, que es persistente y no requiere revocación.

**Archivos modificados:**
- `client/src/components/trip-card.tsx`

---

## 6. Fix: Soporte para recibos con prefijo `|IMAGE:`

**Problema:** El endpoint `GET /recibo/:tripId` solo aceptaba recibos que empezaran con `data:image/...`, pero los recibos se guardan como `|IMAGE:data:image/...`.

**Solución:**
- El backend ahora normaliza el recibo removiendo el prefijo `|IMAGE:` antes de validar/servir la imagen.

**Archivos modificados:**
- `server/routes.ts`

---

## 7. Fix: Botones ojo/X visibles en móvil

**Problema:** La fila de botones en `ReceiptImageUpload` era `flex` sin wrap, causando que en pantallas pequeñas los botones ojo/X quedaran fuera/ocultos.

**Solución:**
- Cambiada a `flex-wrap` con `min-w` para que siempre aparezcan en móvil.

**Archivos modificados:**
- `client/src/components/ui/receipt-image-upload.tsx`

---

## Estado Actual

✅ **Optimizado:**
- `/api/viajes` (listado principal) - **NO envía recibos**
- `/api/transacciones` (listado general) - **NO envía vouchers** (ya estaba optimizado)

✅ **Optimizado:**
- `/api/viajes/mina/:minaId` - **NO envía recibos** (optimizado: `tieneRecibo` flag)
- `/api/viajes/comprador/:compradorId` - **NO envía recibos** (optimizado: `tieneRecibo` flag)
- `/api/volqueteros/:id/viajes` - **NO envía recibos** (optimizado: `tieneRecibo` flag)
- `/api/transacciones/socio/:tipoSocio/:socioId` - **NO envía vouchers** (ya optimizado con `voucher: null`)

---

## Recomendaciones Futuras

1. **Aplicar la misma optimización** a `getViajesByMina`, `getViajesByComprador`, y `getViajesByVolquetero` para excluir `recibo` y agregar `tieneRecibo`.
2. **Considerar paginación** en endpoints de viajes por mina/comprador/volquetero si el volumen crece.
3. **Monitorear payloads** en Network tab para detectar otros campos pesados (ej: `observaciones` muy largas).

