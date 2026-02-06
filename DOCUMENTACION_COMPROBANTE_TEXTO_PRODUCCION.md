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

---

## Mejoras de Diseño y Calidad (Commit a681595)

### Tamaños de Texto Aumentados
Para dar mayor protagonismo a los textos del comprobante, se aumentaron los tamaños base:

- **Nombre del socio**: 30px → 44px
- **Valor**: 38px → 56px
- **RM (marca de agua)**: 34px → 42px
- **Fecha**: 22px → 32px
- **Comentario label**: 20px → 28px
- **Comentario texto**: 19px → 26px
- **Footer**: 16px → 18px

### Textos del Encabezado Más Gruesos
Para hacer los textos del encabezado más gruesos sin cambiar su tamaño, se implementó stroke en los paths:

- Se agregó parámetro `strokeWidth` a `renderTextPath()` (por defecto 0)
- Textos del encabezado (nombre, valor, RM, fecha) usan `strokeWidth: 1.5px`
- Footer usa `strokeWidth: 1.2px` para negrita
- El stroke se aplica al mismo color del fill para mantener consistencia visual

**Implementación técnica:**
```typescript
const renderTextPath = (
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  anchor: "start" | "middle" | "end" = "start",
  strokeWidth: number = 0, // Nuevo parámetro
) => {
  // ...
  const strokeAttr = strokeWidth > 0 
    ? ` stroke="${fill}" stroke-width="${strokeWidth}" stroke-linejoin="round"` 
    : "";
  return `<path d="${path.toPathData(2)}" fill="${fill}"${strokeAttr} />`;
}
```

### Dimensiones Adaptativas del Voucher
El comprobante se adapta al tamaño y orientación del voucher adjunto:

- **Ancho fijo**: 1200px (aumentado de 1100px para más espacio)
- **Alturas controladas**:
  - Vouchers verticales: máximo 900px, mínimo 450px
  - Vouchers horizontales: máximo 650px, mínimo 450px
  - Sin voucher: 350px
- **Cálculo adaptativo**: Se detecta la orientación del voucher y se calcula la altura del área del voucher basándose en su aspect ratio, pero siempre dentro de los límites establecidos
- **Header más alto**: 180px (aumentado de 160px) para dar más espacio a los textos más grandes

**Lógica de adaptación:**
```typescript
if (voucherMetadata) {
  const voucherAspectRatio = voucherMetadata.width / voucherMetadata.height;
  const isVertical = voucherMetadata.height > voucherMetadata.width;
  const availableWidth = baseWidth - basePadding * 2 - 40;
  
  if (isVertical) {
    const calculatedHeight = Math.ceil(availableWidth / voucherAspectRatio) + 40;
    voucherHeight = Math.min(maxVoucherHeightVertical, Math.max(minVoucherHeight, calculatedHeight));
  } else {
    const calculatedHeight = Math.ceil(availableWidth / voucherAspectRatio) + 40;
    voucherHeight = Math.min(maxVoucherHeightHorizontal, Math.max(minVoucherHeight, calculatedHeight));
  }
}
```

### Calidad de Imagen
- **Calidad JPG**: 100 (aumentada de 92) para evitar pérdida de calidad
- Se mantiene formato JPG con `mozjpeg: true` para mejor compresión

### Consideraciones de Diseño
- Los textos nunca se sobreponen: se mantiene un ancho mínimo y se verifica el espacio requerido
- El voucher no domina el comprobante: tiene límites máximos razonables
- Balance visual: los textos tienen protagonismo adecuado sin que el voucher pierda importancia
- Coherencia: un voucher vertical puede estar en un comprobante más horizontal (rectángulo horizontal con espacio a los lados)

### Archivos Modificados
- `server/routes.ts`:
  - `renderTextPath()`: agregado parámetro `strokeWidth`
  - `buildReceiptImage()`: tamaños aumentados, stroke aplicado, dimensiones adaptativas

### Validación
1. Verificar que los textos se vean con el tamaño y grosor correctos
2. Probar con vouchers verticales y horizontales para validar adaptación
3. Confirmar que no hay solapamiento de textos en el encabezado
4. Verificar calidad de imagen en el comprobante compartido
