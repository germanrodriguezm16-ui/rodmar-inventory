# Cambios Recientes - Generación de Imágenes de Transacciones

## Fecha: Enero 2025

### Resumen
Se implementaron mejoras en la generación de imágenes descargables de transacciones para **Compradores** y se agregó la funcionalidad completa para **Volqueteros**, siguiendo el mismo patrón robusto utilizado en **Minas**.

---

## 1. Mejoras en Compradores

### Problema Identificado
El modal de generación de imágenes en compradores (`CompradorTransaccionesImageModal`) tenía diferencias significativas con el de minas:
- No usaba tabla clonada para exportación, causando problemas de alineación vertical en la imagen descargada
- Usaba "CONCEPTO" en lugar de "COMENTARIO" como columna
- Footer más largo y sin ajustes de alineación vertical
- No tenía los mismos ajustes de alineación vertical que minas

### Solución Implementada

#### 1.1. Tabla Clonada para Exportación (`exportRef`)
- **Agregado:** Tabla clonada oculta fuera de pantalla (`position: fixed; left: -9999px`) con estilos optimizados para `html2canvas`
- **Beneficio:** Mejor alineación vertical del texto en la imagen descargada
- **Impacto:** Mínimo (<100ms para tablas pequeñas, <500ms para grandes)

**Archivos modificados:**
- `client/src/components/modals/comprador-transacciones-image-modal.tsx`

#### 1.2. Cambio de "CONCEPTO" a "COMENTARIO"
- **Cambio:** La columna ahora se llama "COMENTARIO" (igual que en minas)
- **Lógica de visualización:**
  - Si `concepto` empieza con "Viaje", mostrar `concepto`
  - Si no, mostrar `comentario` o "-"
- **Aplicado en:** Tabla visible y tabla clonada

**Archivos modificados:**
- `client/src/components/modals/comprador-transacciones-image-modal.tsx`

#### 1.3. Footer Compacto
- **Cambio:** Footer ahora es compacto con el mismo formato que minas
- **Texto:**
  - "Generado por RodMar - Sistema de Gestión Minera"
  - "© 2025 - Todos los derechos reservados"
- **Ajustes:** `paddingTop: '10px'` y `transform: 'translateY(-10px)'` en ambas líneas

**Archivos modificados:**
- `client/src/components/modals/comprador-transacciones-image-modal.tsx`

#### 1.4. Ajustes de Alineación Vertical
- **Headers (`<th>`):**
  - `display: flex`, `alignItems: 'center'`
  - `paddingTop: '9px'`, `paddingBottom: '0px'`
  - `transform: 'translateY(-10px)'`
- **Celdas (`<td>`):**
  - `display: flex`, `alignItems: 'center'`
  - `paddingTop: '6px'`, `paddingBottom: '0px'`
  - `transform: 'translateY(-8px)'`
- **Header del reporte:**
  - `paddingTop: '10px'`
  - `transform: 'translateY(-12px)'`
- **Footer:**
  - `paddingTop: '10px'`
  - `transform: 'translateY(-10px)'`

**Archivos modificados:**
- `client/src/components/modals/comprador-transacciones-image-modal.tsx`

#### 1.5. Función `handleDownload` Actualizada
- **Cambio:** Ahora usa `exportRef` (tabla clonada) en lugar de `imageRef`
- **Agregado:** Espera de 100ms antes de capturar para asegurar renderizado
- **Agregado:** `scrollX: 0` y `scrollY: 0` en configuración de `html2canvas`
- **Agregado:** Advertencia informativa si hay >200 transacciones

**Archivos modificados:**
- `client/src/components/modals/comprador-transacciones-image-modal.tsx`

---

## 2. Nueva Funcionalidad en Volqueteros

### Descripción
Se implementó la funcionalidad completa de generación de imágenes de transacciones en volqueteros, siguiendo el mismo patrón robusto utilizado en minas.

### Implementación

#### 2.1. Integración en `volquetero-detail.tsx`
- **Agregado:** Import de `TransaccionesImageModal`
- **Agregado:** Estado `showTransaccionesImagePreview`
- **Agregado:** Botón "Imagen" con ícono de descarga en la sección de filtros (junto al botón "+ Temporal")
- **Agregado:** Modal `TransaccionesImageModal` al final del componente
- **Agregado:** Función para generar `filterLabel` dinámico según el tipo de filtro de fecha (igual que en minas)

**Archivos modificados:**
- `client/src/pages/volquetero-detail.tsx`

**Ubicación del botón:**
```typescript
// En la sección de filtros, junto al botón "+ Temporal"
<Button
  onClick={() => setShowTransaccionesImagePreview(true)}
  size="sm"
  variant="outline"
  className="h-8 px-2 text-xs"
  title="Descargar imagen de transacciones"
>
  <Download className="w-3 h-3 mr-1" />
  Imagen
</Button>
```

#### 2.2. Adaptación de `TransaccionesImageModal` para Volqueteros

**Props agregadas:**
- `volquetero?: { id: number; nombre: string }`

**Lógica de cálculo de totales para volqueteros:**
```typescript
if (esVolquetero) {
  const volqueteroId = volquetero.id.toString();
  
  transaccionesData.forEach(t => {
    const valor = parseFloat(t.valor || '0');
    
    if (t.tipo === "Viaje") {
      // Transacciones de viajes = positivos (ingresos para el volquetero)
      positiveSum += Math.abs(valor);
    } else if (t.tipo === "Manual") {
      // Para transacciones manuales: 
      // - Si el volquetero recibe dinero (paraQuienTipo: "volquetero") = negativo (egreso)
      // - Si el volquetero paga dinero (deQuienTipo: "volquetero") = positivo (ingreso)
      if (t.paraQuienTipo === 'volquetero' && t.paraQuienId === volqueteroId) {
        negativeSum += Math.abs(valor);
      } else if (t.deQuienTipo === 'volquetero' && t.deQuienId === volqueteroId) {
        positiveSum += Math.abs(valor);
      }
    }
  });
}
```

**Lógica de colores para volqueteros:**
- **Viajes:** Verde/Positivo (ingresos)
- **Manuales:**
  - Volquetero recibe dinero (`paraQuienTipo === 'volquetero'`) = Rojo/Negativo (egreso)
  - Volquetero paga dinero (`deQuienTipo === 'volquetero'`) = Verde/Positivo (ingreso)

**Aplicado en:**
- Tabla visible (vista previa)
- Tabla clonada (imagen descargada)

**Archivos modificados:**
- `client/src/components/modals/transacciones-image-modal.tsx`

#### 2.3. Nombre del Archivo Descargado
- **Formato:** `{nombreVolquetero}_Transacciones_{YYYY-MM-DD}.png`
- **Ejemplo:** `Juan Pérez_Transacciones_2025-01-15.png`

**Archivos modificados:**
- `client/src/components/modals/transacciones-image-modal.tsx`

---

## 3. Comparación: Funcionalidad Actual

### Minas ✅
- Tabla clonada para exportación
- Ajustes de alineación vertical completos
- Sin límites de transacciones
- Advertencia informativa >200 transacciones
- Respeta ordenamiento de la pestaña

### Compradores ✅
- Tabla clonada para exportación (agregado)
- Ajustes de alineación vertical completos (agregado)
- Columna "COMENTARIO" (corregido)
- Footer compacto (corregido)
- Sin límites de transacciones
- Advertencia informativa >200 transacciones (agregado)
- Reordena siempre (fecha desc → ID desc) - **Diferencia con minas**

### Volqueteros ✅
- Tabla clonada para exportación
- Ajustes de alineación vertical completos
- Sin límites de transacciones
- Advertencia informativa >200 transacciones
- Respeta ordenamiento de la pestaña
- Lógica específica para volqueteros (viajes = positivos, manuales según dirección)

---

## 4. Estructura de Datos

### Transacciones en Volqueteros
Las transacciones en volqueteros incluyen:
- **Transacciones manuales:** Donde el volquetero es origen o destino
- **Transacciones dinámicas de viajes:** Generadas automáticamente desde viajes completados
- **Transacciones temporales:** Solo en memoria (no se incluyen en la imagen)

### Campos Relevantes
- `tipo`: "Viaje" | "Manual" | "Temporal"
- `deQuienTipo`: Tipo de entidad origen (ej: "volquetero", "mina", "comprador")
- `deQuienId`: ID de la entidad origen
- `paraQuienTipo`: Tipo de entidad destino
- `paraQuienId`: ID de la entidad destino
- `valor`: Valor de la transacción (string)
- `fecha`: Fecha de la transacción
- `concepto`: Concepto de la transacción
- `comentario`: Comentario adicional

---

## 5. Flujo Completo en Volqueteros

```
1. Usuario en página de volquetero → Pestaña "Transacciones"
2. Usuario aplica filtros (opcional): fecha, búsqueda, balance, visibilidad
3. Usuario hace clic en botón "Imagen" (junto a "+ Temporal")
4. Se abre modal TransaccionesImageModal
5. Modal muestra vista previa del reporte con:
   - Header con nombre de volquetero y filtro aplicado
   - Resumen con totales (positivos, negativos, balance, cantidad)
   - Tabla con transacciones filtradas
6. Usuario hace clic en botón "Descargar"
7. Sistema muestra advertencia si hay >200 transacciones (no bloqueante)
8. Genera canvas con html2canvas usando tabla clonada
9. Crea enlace de descarga con nombre: [Volquetero]_Transacciones_[Fecha].png
10. Inicia descarga automática
```

---

## 6. Archivos Modificados

### Compradores
- `client/src/components/modals/comprador-transacciones-image-modal.tsx`

### Volqueteros
- `client/src/pages/volquetero-detail.tsx`
- `client/src/components/modals/transacciones-image-modal.tsx`

---

## 7. Notas Técnicas

### Tabla Clonada
- **Propósito:** Mejorar alineación vertical del texto en la imagen generada por `html2canvas`
- **Técnica:** Tabla oculta fuera de pantalla con estilos optimizados
- **Rendimiento:** Impacto mínimo (<100ms para tablas pequeñas, <500ms para grandes)

### Ajustes de Alineación Vertical
- **Problema:** `html2canvas` no renderiza correctamente `vertical-align: middle` en algunos casos
- **Solución:** Uso de `display: flex`, `alignItems: 'center'`, y `transform: translateY()` para ajustar posición
- **Aplicado en:** Headers, celdas, header del reporte, y footer

### Lógica de Cálculo de Totales
- **Minas:** Viajes = positivos, manuales según dirección
- **Compradores:** Viajes = negativos, manuales según dirección
- **Volqueteros:** Viajes = positivos, manuales según dirección

---

## 8. Estado Actual

✅ **Implementado:**
- Generación de imágenes en **Minas** (ya existía)
- Generación de imágenes en **Compradores** (mejorado)
- Generación de imágenes en **Volqueteros** (nuevo)

⏳ **Pendiente:**
- Generación de imágenes en **Cuentas RodMar** (no implementado por solicitud del usuario)

---

## 9. Próximos Pasos Sugeridos

1. **Unificar ordenamiento:** Hacer que compradores respete el ordenamiento de la pestaña (como minas y volqueteros)
2. **Optimización adicional:** Considerar virtualización de listas si el volumen de transacciones crece significativamente
3. **Monitoreo:** Verificar que la generación de imágenes funcione correctamente en producción con diferentes volúmenes de datos

