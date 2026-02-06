## Problema
En produccion, el texto del comprobante compartido aparecia en blanco (o como cuadros). En desarrollo se veia bien.

## Causa real
La generacion del comprobante depende de renderizar texto en un SVG. En entornos serverless/produccion, el motor de renderizado no siempre encuentra la fuente o no puede resolverla correctamente, aunque este embebida. Esto provoca que el texto no se pinte en el raster final.

Se detecto ademas que los archivos `Roboto-Regular.ttf` locales estaban corruptos (eran HTML), lo que hacia mas probable la falla de carga de fuente. Aun con el archivo correcto, la renderizacion seguia siendo inestable en produccion por la dependencia del motor de fuentes.

## Solucion definitiva
Convertir el texto a trazos vectoriales (paths) en el SVG antes de renderizar.

- Se usa `opentype.js` para convertir texto a rutas SVG (`<path>`), con lo cual el render final no depende de la disponibilidad de fuentes.
- Se mantiene un fallback a `<text>` solo si el parser falla, pero en produccion el flujo principal usa paths.

Archivos claves:
- `server/routes.ts`:
  - `getReceiptFont()` carga la fuente desde `ROBOTO_REGULAR_BASE64`.
  - `renderTextPath()` genera `<path>` usando `opentype.js`.
  - `buildReceiptImage()` usa `renderTextPath()` en todos los textos del comprobante.
- `server/receipt-font.ts`: base64 de Roboto (debe ser un TTF valido).

## Como validar
1. Endpoint: `GET /api/transacciones/:id/comprobante.jpg`
2. Verificar que todo el texto del encabezado, comentario y footer se vea en produccion.

## Mejores practicas y futuras mejoras
- Asegurar que el TTF de `server/assets/fonts/Roboto-Regular.ttf` sea un archivo valido.
- Si se cambia de tipografia, regenerar `server/receipt-font.ts` a partir del TTF real.
- Si se agregan nuevos textos, usar siempre `renderTextPath()` en lugar de `<text>`.
- Se puede crear un script de validacion que verifique el header del TTF (debe iniciar con `00010000` en hex).

## Razon tecnica del cambio
El render de texto en SVG no es determinista entre motores y entornos. Convertir a paths elimina la dependencia de fuentes y garantiza consistencia visual.
