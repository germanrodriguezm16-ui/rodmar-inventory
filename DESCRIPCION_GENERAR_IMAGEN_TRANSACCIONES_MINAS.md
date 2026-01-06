# Descripción Completa: Generar y Descargar Imagen de Transacciones en Minas

## Resumen General

La funcionalidad permite generar una imagen PNG de las transacciones filtradas de una mina, con un diseño optimizado para impresión/compartir. La imagen se genera en el cliente usando `html2canvas` y se descarga automáticamente.

---

## 1. Ubicación y Activación

### Ubicación del Botón
- **Página:** `mina-detail.tsx` (página de detalle de mina)
- **Pestaña:** "Transacciones" (tab activo)
- **Posición:** En la barra de herramientas superior de la sección de transacciones
- **Estilo:** Botón morado con ícono de ojo (`Eye`) y texto "Imagen"

```1243:1251:RodMarInventory/client/src/pages/mina-detail.tsx
                      <Button
                        onClick={() => setShowTransaccionesImagePreview(true)}
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-600 hover:bg-purple-50 h-7 sm:h-8 px-2 sm:px-3 text-xs"
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Imagen</span>
                      </Button>
```

### Flujo de Activación
1. Usuario hace clic en el botón "Imagen"
2. Se actualiza el estado `showTransaccionesImagePreview` a `true`
3. Se abre el modal `TransaccionesImageModal`

---

## 2. Preparación de Datos

### Transacciones Filtradas
El modal recibe `transaccionesFiltradas`, que es el resultado de aplicar múltiples filtros:

```710:760:RodMarInventory/client/src/pages/mina-detail.tsx
  const transaccionesFiltradas = useMemo(() => {
    let filtered = filterType === "todos" ? 
      todasTransacciones.filter(t => !t.oculta) : 
      todasTransacciones.filter(t => t.oculta);

    // Aplicar filtro de fecha
    filtered = filterTransaccionesByDate(filtered, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd);

    // Aplicar filtro de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.concepto?.toLowerCase().includes(term) ||
        t.valor?.toString().includes(term) ||
        t.formaPago?.toLowerCase().includes(term) ||
        t.comentario?.toLowerCase().includes(term)
      );
    }

    // Aplicar filtro de balance usando la misma lógica que las tarjetas
    if (balanceFilter === 'positivos') {
      filtered = filtered.filter(t => {
        // Verde/Positivo para minas - misma lógica que las tarjetas
        if (t.deQuienTipo === 'viaje') {
          return true; // Viajes siempre positivos (verdes)
        } else if (t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString()) {
          return true; // Desde esta mina = ingreso positivo (verde)
        } else if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
          return true; // Hacia RodMar/Banco = positivo (verde)
        }
        return false;
      });
    } else if (balanceFilter === 'negativos') {
      filtered = filtered.filter(t => {
        // Rojo/Negativo para minas - misma lógica que las tarjetas
        return t.deQuienTipo !== 'viaje' && 
               t.paraQuienTipo === 'mina' && 
               t.paraQuienId === minaId.toString() &&
               !(t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString());
      });
    }
    // Si balanceFilter === 'all', no filtrar por balance

    // Aplicar ordenamiento
    if (sortByFecha !== "ninguno") {
      filtered.sort((a, b) => {
        const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return sortByFecha === "asc" ? fechaA - fechaB : fechaB - fechaA;
```

**Filtros aplicados:**
- **Filtro de visibilidad:** Ocultas vs. No ocultas
- **Filtro de fecha:** Múltiples opciones (todos, exactamente, entre, después de, antes de, hoy, ayer, esta semana, semana pasada, este mes, mes pasado, este año, año pasado)
- **Filtro de búsqueda:** Por concepto, valor, forma de pago o comentario
- **Filtro de balance:** Positivos, Negativos, o Todos
- **Ordenamiento:** Por fecha (ascendente/descendente)

### Datos Pasados al Modal

```1932:1969:RodMarInventory/client/src/pages/mina-detail.tsx
      <TransaccionesImageModal
        open={showTransaccionesImagePreview}
        onOpenChange={(open) => setShowTransaccionesImagePreview(open)}
        transacciones={transaccionesFiltradas}
        mina={mina}
        filterLabel={(() => {
          // Función para formatear fecha en formato DD/MM/YYYY
          const formatDateForLabel = (dateString: string): string => {
            if (!dateString) return "";
            if (dateString.includes('-')) {
              const [year, month, day] = dateString.split('-');
              return `${day}/${month}/${year}`;
            }
            return dateString;
          };

          const formatValue = formatDateForLabel(transaccionesFechaFilterValue);
          const formatValueEnd = formatDateForLabel(transaccionesFechaFilterValueEnd);
          
          const filterLabels: Record<string, string> = {
            "todos": "Todas las Transacciones",
            "exactamente": `Fecha: ${formatValue}`,
            "entre": `Entre: ${formatValue} - ${formatValueEnd}`,
            "despues-de": `Después de ${formatValue}`,
            "antes-de": `Antes de ${formatValue}`,
            "hoy": "Hoy",
            "ayer": "Ayer",
            "esta-semana": "Esta Semana",
            "semana-pasada": "Semana Pasada",
            "este-mes": "Este Mes",
            "mes-pasado": "Mes Pasado",
            "este-año": "Este Año",
            "año-pasado": "Año Pasado"
          };
          
          return filterLabels[transaccionesFechaFilterType] || "Filtro Personalizado";
        })()}
      />
```

**Props del modal:**
- `transacciones`: Array de transacciones filtradas
- `mina`: Objeto con información de la mina (nombre, id, etc.)
- `filterLabel`: Etiqueta descriptiva del filtro aplicado (ej: "Este Mes", "Entre: 01/01/2025 - 31/01/2025")

---

## 3. Modal y Vista Previa

### Componente: `TransaccionesImageModal`

**Ubicación:** `client/src/components/modals/transacciones-image-modal.tsx`

### Estructura del Modal

1. **Header:**
   - Título: "Vista Previa - Reporte de Transacciones"
   - Botón "Descargar" (morado) con ícono de descarga
   - Botón "Cerrar" (X)

2. **Advertencia (si aplica):**
   - Si hay más de 100 transacciones, muestra una advertencia en amarillo indicando que la descarga está limitada a 100 transacciones

3. **Contenido de la Imagen (ref: `imageRef`):**
   - Diseño optimizado para móvil: ancho fijo de 400px
   - Fuente pequeña (11px) para máxima densidad de información
   - Fondo blanco

### Estructura del Reporte en la Imagen

#### A. Header del Reporte
```
[Nombre de la Mina] - [Etiqueta del Filtro]
[Fecha actual en formato DD/MM/YYYY]
```

#### B. Resumen Compacto (Grid 4 columnas)
- **Positivos:** Suma de valores positivos (verde)
- **Negativos:** Suma de valores negativos (rojo)
- **Balance:** Diferencia (positivo = verde, negativo = rojo)
- **Total:** Cantidad de transacciones

#### C. Tabla de Transacciones
**Columnas:**
- **FECHA:** Formato compacto con día de la semana (ej: "Lun. 15/01/25")
- **COMENTARIO:** Concepto o comentario de la transacción
- **VALOR:** Valor formateado como moneda con signo (+/-) y color

**Límite de visualización:** Solo muestra las primeras 50 transacciones en la tabla (aunque el cálculo de totales incluye todas)

#### D. Footer
```
Generado por RodMar - Sistema de Gestión Minera
© 2025 - Todos los derechos reservados
```

---

## 4. Lógica de Cálculo de Totales

### Para Minas Regulares

```168:199:RodMarInventory/client/src/components/modals/transacciones-image-modal.tsx
  } else {
    // Lógica original para minas regulares
    const viajesEnTransacciones = transaccionesData.filter(t => 
      t.concepto && t.concepto.startsWith('Viaje')
    );
    
    const transaccionesManuales = transaccionesData.filter(t => 
      !(t.concepto && t.concepto.startsWith('Viaje'))
    );

    // Ingresos por viajes
    const ingresosViajes = viajesEnTransacciones.reduce((sum, t) => sum + parseFloat(t.valor), 0);

    // Usar la MISMA lógica corregida que la pestaña de transacciones
    const minaId = mina?.id?.toString();
    
    // Separar positivos y negativos usando orden correcto de evaluación
    transaccionesManuales.forEach(t => {
      const valor = parseFloat(t.valor || '0');
      
      // ORDEN CORRECTO: Evaluar primero si la mina es ORIGEN (ingreso)
      if (t.deQuienTipo === 'mina' && t.deQuienId === minaId) {
        positiveSum += valor; // Ingreso positivo - mina es origen
      } else if (t.paraQuienTipo === 'mina' && t.paraQuienId === minaId) {
        negativeSum += valor; // Egreso negativo - mina es destino
      } else if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
        positiveSum += valor; // Ingreso hacia RodMar/Banco
      }
    });
    
    // Agregar ingresos de viajes a positivos
    positiveSum += ingresosViajes;
  }
```

**Reglas de clasificación:**
1. **Viajes:** Siempre se consideran ingresos positivos (verde)
2. **Transacciones desde la mina:** Ingresos positivos (verde)
3. **Transacciones hacia la mina:** Egresos negativos (rojo)
4. **Transacciones hacia RodMar/Banco:** Ingresos positivos (verde)

### Para Cuentas RodMar (LCDM/Postobón)

```145:166:RodMarInventory/client/src/components/modals/transacciones-image-modal.tsx
  if (esRodMarAccount) {
    // Lógica para cuentas RodMar (LCDM/Postobón)
    transaccionesData.forEach(t => {
      const valor = parseFloat(t.valor || '0');
      
      if (esLCDM) {
        // Para LCDM: transacciones DESDE lcdm hacia rodmar = verde/positivo
        // transacciones HACIA lcdm desde rodmar = rojo/negativo
        if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
          positiveSum += valor;
        } else if (t.paraQuienTipo === 'lcdm') {
          negativeSum += valor;
        }
      } else if (esPostobon) {
        // Para Postobón: similar lógica adaptativa
        if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
          positiveSum += valor;
        } else if (t.paraQuienTipo === 'postobon') {
          negativeSum += valor;
        }
      }
    });
  }
```

---

## 5. Generación y Descarga de la Imagen

### Proceso de Generación

```99:132:RodMarInventory/client/src/components/modals/transacciones-image-modal.tsx
  const handleDownload = async () => {
    if (!imageRef.current || !transaccionesData) return;

    // Validar que no haya más de 100 transacciones
    if (transaccionesData.length > 100) {
      alert('No se puede descargar la imagen con más de 100 transacciones. Por favor, aplica filtros para reducir el número de transacciones a máximo 100.');
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        height: imageRef.current.scrollHeight,
        width: 400, // Ancho fijo para diseño móvil
        scrollX: 0,
        scrollY: 0,
        windowWidth: 500,
        windowHeight: imageRef.current.scrollHeight
      });

      const link = document.createElement('a');
      link.download = `${mina?.nombre || 'Transacciones'}_Transacciones_${(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
    } finally {
      setIsGenerating(false);
    }
  };
```

### Pasos del Proceso

1. **Validación:**
   - Verifica que `imageRef.current` exista
   - Verifica que haya transacciones
   - **Límite:** Máximo 100 transacciones (muestra alerta si excede)

2. **Generación del Canvas:**
   - Usa `html2canvas` para convertir el DOM a imagen
   - **Configuración:**
     - `backgroundColor: '#ffffff'` (fondo blanco)
     - `scale: 2` (calidad 2x para mejor resolución)
     - `useCORS: true` (permite imágenes externas)
     - `allowTaint: true` (permite contenido cross-origin)
     - `width: 400px` (ancho fijo para diseño móvil)
     - `height: scrollHeight` (altura dinámica según contenido)

3. **Creación del Enlace de Descarga:**
   - Crea un elemento `<a>` temporal
   - **Nombre del archivo:** `[NombreMina]_Transacciones_[YYYY-MM-DD].png`
   - **Ejemplo:** `Mina Merardo Marín_Transacciones_2025-01-15.png`
   - Convierte el canvas a data URL (base64)
   - Simula un clic para iniciar la descarga
   - Elimina el elemento temporal

4. **Manejo de Errores:**
   - Captura errores en consola
   - Restablece el estado `isGenerating` a `false`

---

## 6. Limitaciones y Consideraciones

### Limitaciones Técnicas

1. **Límite de transacciones:** Máximo 100 transacciones para descargar
   - Si hay más, muestra advertencia y bloquea la descarga
   - El usuario debe aplicar filtros para reducir el número

2. **Visualización en tabla:** Solo muestra las primeras 50 transacciones en la tabla
   - Los totales se calculan con todas las transacciones filtradas
   - Esto puede causar confusión si hay más de 50 transacciones

3. **Dependencia de `html2canvas`:**
   - Requiere que el contenido esté renderizado en el DOM
   - Puede tener problemas con estilos complejos o fuentes externas
   - El proceso puede ser lento con muchas transacciones

4. **Ancho fijo:** 400px (optimizado para móvil)
   - Puede verse pequeño en pantallas grandes
   - No es responsive

### Consideraciones de UX

1. **Ocultación de navegación:** El modal oculta la navegación inferior mientras está abierto
2. **Estado de carga:** Muestra "Generando..." mientras se procesa la imagen
3. **Vista previa:** El usuario puede ver exactamente cómo se verá la imagen antes de descargarla

---

## 7. Colores y Signos en la Tabla

### Lógica de Colores para Minas Regulares

```364:389:RodMarInventory/client/src/components/modals/transacciones-image-modal.tsx
                      } else {
                        // Lógica corregida para minas regulares - MISMO ORDEN que pestaña de transacciones
                        const esViaje = transaccion.concepto && transaccion.concepto.startsWith('Viaje');
                        
                        if (esViaje) {
                          // Viajes = VERDE y POSITIVO siempre en minas
                          colorClass = 'text-green-600';
                          signo = '+';
                        } else if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId) {
                          // PRIMERO: Transacciones DESDE esta mina = VERDE y POSITIVO (ingreso)
                          colorClass = 'text-green-600';
                          signo = '+';
                        } else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId) {
                          // DESPUÉS: Transacciones HACIA esta mina = ROJO y NEGATIVO (egreso)
                          colorClass = 'text-red-600';
                          signo = '-';
                        } else if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                          // Transacciones hacia RodMar/Banco = VERDE y POSITIVO
                          colorClass = 'text-green-600';
                          signo = '+';
                        } else {
                          // Fallback
                          colorClass = 'text-gray-600';
                          signo = '';
                        }
                      }
```

**Reglas:**
- **Verde (+):** Viajes, transacciones desde la mina, transacciones hacia RodMar/Banco
- **Rojo (-):** Transacciones hacia la mina
- **Gris (sin signo):** Otros casos (fallback)

---

## 8. Formato de Fechas

### En el Header
- Formato: `DD/MM/YYYY` (fecha actual)

### En la Tabla
- Formato compacto: `[DíaSemana]. DD/MM/YY`
- Ejemplo: `Lun. 15/01/25`
- Función: `formatDateCompact()`

```81:97:RodMarInventory/client/src/components/modals/transacciones-image-modal.tsx
  const formatDateCompact = (date: Date | string) => {
    // Formato con día de la semana para imagen descargable de minas
    const fecha = date;
    if (typeof fecha === 'string') {
      const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
      const [year, month, day] = dateStr.split('-');
      const dayOfWeek = getDayOfWeek(fecha);
      return `${dayOfWeek}. ${day}/${month}/${year?.slice(-2) || ''}`;
    } else if (fecha instanceof Date) {
      const day = String(fecha.getDate()).padStart(2, '0');
      const month = String(fecha.getMonth() + 1).padStart(2, '0');
      const year = String(fecha.getFullYear()).slice(-2);
      const dayOfWeek = getDayOfWeek(fecha);
      return `${dayOfWeek}. ${day}/${month}/${year}`;
    }
    return 'Fecha inválida';
  };
```

---

## 9. Flujo Completo (Resumen)

```
1. Usuario en página de mina → Pestaña "Transacciones"
2. Usuario aplica filtros (opcional): fecha, búsqueda, balance, ordenamiento
3. Usuario hace clic en botón "Imagen" (morado con ícono de ojo)
4. Se abre modal TransaccionesImageModal
5. Modal muestra vista previa del reporte con:
   - Header con nombre de mina y filtro aplicado
   - Resumen con totales (positivos, negativos, balance, cantidad)
   - Tabla con transacciones (máx. 50 visibles, pero totales incluyen todas)
6. Usuario hace clic en botón "Descargar"
7. Sistema valida que no haya más de 100 transacciones
8. Si válido:
   - Genera canvas con html2canvas
   - Crea enlace de descarga con nombre: [Mina]_Transacciones_[Fecha].png
   - Inicia descarga automática
9. Si inválido (>100 transacciones):
   - Muestra alerta
   - Bloquea descarga
```

---

## 10. Archivos Relacionados

- **Frontend:**
  - `client/src/pages/mina-detail.tsx` (página principal, botón y preparación de datos)
  - `client/src/components/modals/transacciones-image-modal.tsx` (modal y generación de imagen)

- **Dependencias:**
  - `html2canvas` (generación de imagen desde DOM)
  - `@tanstack/react-query` (gestión de datos)
  - `lucide-react` (íconos)

---

## 11. Posibles Mejoras Futuras

1. **Aumentar límite de transacciones:** Permitir más de 100 (con paginación o scroll en imagen)
2. **Mostrar todas las transacciones:** No limitar a 50 en la tabla
3. **Opciones de formato:** Permitir elegir entre PNG, PDF, o Excel
4. **Ancho configurable:** Permitir elegir ancho de imagen (móvil/desktop)
5. **Incluir gráficos:** Agregar gráficos de barras o líneas en la imagen
6. **Filtros avanzados:** Permitir aplicar filtros directamente desde el modal











