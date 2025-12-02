import * as XLSX from 'xlsx';

// Función para formatear moneda colombiana
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value);
}

// Interfaz para transacciones de comprador
interface CompradorTransaccion {
  id: number;
  concepto: string;
  valor: string;
  fecha: Date;
  formaPago: string;
  voucher: string | null;
  comentario: string | null;
  deQuienTipo: string;
  deQuienId: string;
  paraQuienTipo: string;
  paraQuienId: string;
  isFromTrip?: boolean;
}

// Función para vista previa de transacciones de comprador
export function previewCompradorTransactionHistory(transacciones: CompradorTransaccion[], compradorNombre?: string) {
  if (!transacciones || transacciones.length === 0) {
    return {
      preview: [],
      totalIngresos: 0,
      totalEgresos: 0,
      balanceNeto: 0
    };
  }

  // Tomar las primeras 5 transacciones para vista previa
  const firstFive = transacciones.slice(0, 5);

  // Convertir transacciones a formato Excel
  const excelData = firstFive.map(transaccion => {
    const fecha = transaccion.fecha instanceof Date ? transaccion.fecha : new Date(transaccion.fecha);
    return {
      'FECHA': fecha.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\./g, ''),
      'CONCEPTO': transaccion.concepto,
      'VALOR': formatCurrency(parseFloat(transaccion.valor))
    };
  });

  // Calcular totales de todas las transacciones (no solo las 5 de vista previa)
  const totalIngresos = transacciones
    .filter(t => parseFloat(t.valor) > 0)
    .reduce((sum, t) => sum + parseFloat(t.valor), 0);
  
  const totalEgresos = transacciones
    .filter(t => parseFloat(t.valor) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.valor)), 0);

  const balanceNeto = totalIngresos - totalEgresos;

  return {
    preview: excelData,
    totalIngresos,
    totalEgresos,
    balanceNeto
  };
}

// Función para exportar historial completo de transacciones de comprador
export function exportCompradorTransactionHistory(transacciones: CompradorTransaccion[], compradorNombre: string) {
  if (!transacciones || transacciones.length === 0) {
    console.log('No hay transacciones para exportar');
    return;
  }

  // Convertir todas las transacciones a formato Excel
  const excelData = transacciones.map(transaccion => {
    const fecha = transaccion.fecha instanceof Date ? transaccion.fecha : new Date(transaccion.fecha);
    return {
      'FECHA': fecha.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\./g, ''),
      'CONCEPTO': transaccion.concepto,
      'VALOR': parseFloat(transaccion.valor)
    };
  });

  // Calcular totales
  const totalIngresos = transacciones
    .filter(t => parseFloat(t.valor) > 0)
    .reduce((sum, t) => sum + parseFloat(t.valor), 0);
  
  const totalEgresos = transacciones
    .filter(t => parseFloat(t.valor) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.valor)), 0);

  const balanceNeto = totalIngresos - totalEgresos;

  // Fila de totales
  const totalRow = {
    'FECHA': 'TOTALES',
    'CONCEPTO': `${transacciones.length} transacciones`,
    'VALOR': balanceNeto
  };

  // Agregar fila de totales
  excelData.push(totalRow);

  // Crear workbook
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Configurar anchos de columna
  const columnWidths = [
    { wch: 12 }, // FECHA
    { wch: 25 }, // CONCEPTO
    { wch: 15 }  // VALOR
  ];
  worksheet['!cols'] = columnWidths;

  // Aplicar estilos a los encabezados (fila 1)
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:C1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = {
        fill: { fgColor: { rgb: '4472C4' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }

  // Aplicar estilos a las filas de datos (filas 2 hasta última-1)
  const dataRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:C1');
  for (let row = 1; row < dataRange.e.r; row++) { // Saltar encabezados y totales
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress]) {
        const isOddRow = row % 2 === 1;
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: isOddRow ? 'FFFFFF' : 'F2F2F2' } },
          alignment: { horizontal: col === 2 ? 'right' : 'left' }, // VALOR alineado a la derecha
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
      }
    }
  }

  // Aplicar estilos a la fila de totales (última fila)
  const lastRowIndex = excelData.length - 1;
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: lastRowIndex + 1, c: col });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = {
        fill: { fgColor: { rgb: '70AD47' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: col === 2 ? 'right' : 'center' }, // VALOR alineado a la derecha
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }

  // Aplicar formato de moneda a la columna VALOR
  const dataRangeFormatting = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:C1');
  for (let row = 1; row < dataRangeFormatting.e.r; row++) { // Saltar encabezados y totales
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 }); // Columna VALOR (ahora es la tercera columna, índice 2)
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].z = '"$"#,##0.00_);("$"#,##0.00)';
      worksheet[cellAddress].s = {
        alignment: { horizontal: 'right' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }

  // Habilitar filtros automáticos
  worksheet['!autofilter'] = { ref: `A1:C${excelData.length}` };

  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');

  // Configurar propiedades del archivo
  workbook.Props = {
    Title: `RodMar - Transacciones ${compradorNombre}`,
    Subject: 'Historial de Transacciones',
    Author: 'RodMar System',
    CreatedDate: new Date()
  };

  // Generar nombre del archivo
  const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
  const filename = `RodMar_${compradorNombre}_Transacciones_${fecha}_${transacciones.length}transacciones.xlsx`;

  // Descargar archivo
  XLSX.writeFile(workbook, filename);
  console.log(`✅ Archivo Excel exportado: ${filename}`);
}