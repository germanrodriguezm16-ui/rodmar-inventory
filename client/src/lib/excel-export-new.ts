import ExcelJS from 'exceljs';
import { ViajeWithDetails } from '@shared/schema';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper para obtener la URL base del backend (Railway en producción)
const getBackendUrl = (): string => {
  if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return window.location.origin;
};

const formatCurrency = (value: string): string => {
  const num = parseFloat(value);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(num);
};

// Función para formatear fechas con día de la semana
const formatDateWithDay = (date: Date | null): string => {
  if (!date) return "";
  return format(date, "EEE. dd/MM/yyyy", { locale: es });
};

export async function exportTripsToExcel(trips: ViajeWithDetails[]) {
  try {
    // Crear workbook y worksheet con ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Viajes');

    // Definir columnas con encabezados
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Fecha de Cargue', key: 'fechaCargue', width: 15 },
      { header: 'Mina', key: 'mina', width: 20 },
      { header: 'Conductor', key: 'conductor', width: 15 },
      { header: 'Tipo de Carro', key: 'tipoCarro', width: 15 },
      { header: 'Placa', key: 'placa', width: 10 },
      { header: 'CUT', key: 'cut', width: 12 },
      { header: 'Fecha de Descargue', key: 'fechaDescargue', width: 15 },
      { header: 'Comprador', key: 'comprador', width: 20 },
      { header: 'Peso', key: 'peso', width: 10 },
      { header: 'VUT', key: 'vut', width: 12 },
      { header: 'FUT', key: 'fut', width: 12 },
      { header: 'OGF', key: 'ogf', width: 12 },
      { header: 'Total Venta', key: 'totalVenta', width: 15 },
      { header: 'Total Compra', key: 'totalCompra', width: 15 },
      { header: 'Total Flete', key: 'totalFlete', width: 15 },
      { header: 'Valor a Consignar', key: 'valorConsignar', width: 18 },
      { header: 'Ganancias', key: 'ganancias', width: 15 },
      { header: '¿QPF?', key: 'qpf', width: 15 },
      { header: 'Recibo', key: 'recibo', width: 15 },
      { header: 'Observaciones', key: 'observaciones', width: 20 }
    ];

    // Estilo para encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Calcular totales
    let totalPeso = 0;
    let totalVenta = 0;
    let totalCompra = 0;
    let totalFlete = 0;
    let totalValorConsignar = 0;
    let totalGanancias = 0;

    // Agregar datos de viajes
    trips.forEach((trip, index) => {
      const rowData = {
        id: trip.id,
        fechaCargue: trip.fechaCargue ? formatDateWithDay(new Date(trip.fechaCargue)) : '',
        mina: trip.mina?.nombre || `Mina ID: ${trip.minaId}`,
        conductor: trip.conductor,
        tipoCarro: trip.tipoCarro,
        placa: trip.placa,
        cut: trip.cut ? formatCurrency(trip.cut) : '',
        fechaDescargue: trip.fechaDescargue ? formatDateWithDay(new Date(trip.fechaDescargue)) : '',
        comprador: trip.comprador?.nombre || `Comprador ID: ${trip.compradorId}`,
        peso: trip.peso || '',
        vut: trip.vut ? formatCurrency(trip.vut) : '',
        fut: trip.fut ? formatCurrency(trip.fut) : '',
        ogf: trip.otrosGastosFlete ? formatCurrency(trip.otrosGastosFlete) : '',
        totalVenta: trip.totalVenta ? formatCurrency(trip.totalVenta) : '',
        totalCompra: trip.totalCompra ? formatCurrency(trip.totalCompra) : '',
        totalFlete: trip.totalFlete ? formatCurrency(trip.totalFlete) : '',
        valorConsignar: trip.valorConsignar ? formatCurrency(trip.valorConsignar) : '',
        ganancias: trip.ganancia ? formatCurrency(trip.ganancia) : '',
        qpf: trip.quienPagaFlete === 'comprador' ? 'El comprador' : 'Tú',
        recibo: trip.recibo ? 'Ver Recibo' : '',
        observaciones: trip.observaciones || ''
      };

      // Acumular totales
      totalPeso += parseFloat(trip.peso || '0');
      totalVenta += parseFloat(trip.totalVenta || '0');
      totalCompra += parseFloat(trip.totalCompra || '0');
      totalFlete += parseFloat(trip.totalFlete || '0');
      totalValorConsignar += parseFloat(trip.valorConsignar || '0');
      totalGanancias += parseFloat(trip.ganancia || '0');

      const row = worksheet.addRow(rowData);
      
      // Estilo para filas de datos (alternando colores)
      const isEvenRow = (index + 1) % 2 === 0;
      const fillColor = isEvenRow ? 'FFF2F2F2' : 'FFFFFFFF';
      
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };
        cell.alignment = { vertical: 'middle' };
      });

      // Alineación derecha para columnas numéricas
      ['cut', 'vut', 'fut', 'ogf', 'totalVenta', 'totalCompra', 'totalFlete', 'valorConsignar', 'ganancias', 'peso'].forEach(key => {
        const colIndex = worksheet.columns.findIndex(col => col.key === key) + 1;
        if (colIndex > 0) {
          row.getCell(colIndex).alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });

      // Agregar hiperenlace para recibo si existe
      if (trip.recibo) {
        const reciboCell = row.getCell('recibo');
        reciboCell.value = {
          text: 'Ver Recibo',
          hyperlink: `${getBackendUrl()}/recibo/${trip.id}`,
          tooltip: 'Abrir imagen del recibo'
        };
        reciboCell.font = { color: { argb: 'FF0000FF' }, underline: true };
      }
    });

    // Agregar fila de totales
    const totalRowData = {
      id: '',
      fechaCargue: '',
      mina: '',
      conductor: '',
      tipoCarro: '',
      placa: '',
      cut: '',
      fechaDescargue: '',
      comprador: 'TOTALES',
      peso: totalPeso.toFixed(2),
      vut: '',
      fut: '',
      ogf: '',
      totalVenta: formatCurrency(totalVenta.toString()),
      totalCompra: formatCurrency(totalCompra.toString()),
      totalFlete: formatCurrency(totalFlete.toString()),
      valorConsignar: formatCurrency(totalValorConsignar.toString()),
      ganancias: formatCurrency(totalGanancias.toString()),
      qpf: '',
      recibo: '',
      observaciones: ''
    };

    const totalRow = worksheet.addRow(totalRowData);
    
    // Estilo para fila de totales
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thick' },
        left: { style: 'thin' },
        bottom: { style: 'thick' },
        right: { style: 'thin' }
      };
    });

    // Alineación derecha para columnas numéricas en totales
    ['peso', 'totalVenta', 'totalCompra', 'totalFlete', 'valorConsignar', 'ganancias'].forEach(key => {
      const colIndex = worksheet.columns.findIndex(col => col.key === key) + 1;
      if (colIndex > 0) {
        totalRow.getCell(colIndex).alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    // Configurar filtros automáticos
    worksheet.autoFilter = {
      from: 'A1',
      to: worksheet.getCell(1, 21).address
    };

    // Configurar propiedades del workbook
    workbook.creator = 'Sistema RodMar';
    workbook.title = 'Reporte de Viajes - RodMar';
    workbook.description = `Exportación completa de viajes con totales y formato profesional. Generado el ${new Date().toLocaleDateString('es-CO')} con ${trips.length} viajes.`;
    workbook.created = new Date();

    // Generar y descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
    const filename = `RodMar_Viajes_${fecha}_${trips.length}viajes.xlsx`;
    
    // Crear blob y descargar
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error exportando Excel:', error);
    alert('Error al generar el archivo Excel. Por favor intenta de nuevo.');
  }
}