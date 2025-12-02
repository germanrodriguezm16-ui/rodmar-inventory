import * as XLSX from 'xlsx';
import type { ViajeWithDetails } from '@shared/schema';
import { formatDateWithDaySpanish } from './date-utils';

const formatCurrency = (value: string): string => {
  const num = parseFloat(value);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(num);
};

export function previewCompradorTripHistory(trips: ViajeWithDetails[]): any[] {
  // Tomar solo los primeros 5 viajes para la vista previa
  const previewTrips = trips.slice(0, 5);
  
  // Preparar datos para vista previa
  const exportData = previewTrips.map(trip => ({
    'ID': trip.id || '',
    'FECHA DE CARGUE': trip.fechaCargue ? formatDateWithDaySpanish(trip.fechaCargue) : '-',
    'FECHA DE DESCARGUE': trip.fechaDescargue ? formatDateWithDaySpanish(trip.fechaDescargue) : '-',
    'CONDUCTOR': trip.conductor || '-',
    'TIPO DE CARRO': trip.tipoCarro || '-',
    'PLACA': trip.placa || '-',
    'PESO (Ton)': trip.peso || '-',
    'VUT': trip.vut ? formatCurrency(trip.vut) : '-',
    'FUT': trip.fleteTon ? formatCurrency(trip.fleteTon) : '-',
    'OGF': trip.otrosGastosFlete ? formatCurrency(trip.otrosGastosFlete) : '-',
    'TOTAL VENTA': trip.totalVenta ? formatCurrency(trip.totalVenta) : '-',
    'TOTAL FLETE': trip.totalFlete ? formatCurrency(trip.totalFlete) : '-',
    'VALOR CONSIGNAR': trip.valorConsignar ? formatCurrency(trip.valorConsignar) : '-',
    'ESTADO': trip.estado || '-'
  }));

  // Calcular totales
  const totales = exportData.reduce((acc, trip) => {
    const totalVenta = parseFloat(trip['TOTAL VENTA'].replace(/[\$,.]/g, '')) || 0;
    const totalFlete = parseFloat(trip['TOTAL FLETE'].replace(/[\$,.]/g, '')) || 0;
    const valorConsignar = parseFloat(trip['VALOR CONSIGNAR'].replace(/[\$,.]/g, '')) || 0;
    const peso = parseFloat(trip['PESO (Ton)']) || 0;
    return {
      count: acc.count + 1,
      totalVenta: acc.totalVenta + totalVenta,
      totalFlete: acc.totalFlete + totalFlete,
      valorConsignar: acc.valorConsignar + valorConsignar,
      totalPeso: acc.totalPeso + peso
    };
  }, { count: 0, totalVenta: 0, totalFlete: 0, valorConsignar: 0, totalPeso: 0 });

  // Agregar fila de totales
  const filaTotales = {
    'ID': `${totales.count} viajes`,
    'FECHA DE CARGUE': '',
    'FECHA DE DESCARGUE': '',
    'CONDUCTOR': '',
    'TIPO DE CARRO': '',
    'PLACA': '',
    'PESO (Ton)': totales.totalPeso.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    'VUT': '',
    'FUT': '',
    'OGF': '',
    'TOTAL VENTA': '$' + Math.round(totales.totalVenta).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    'TOTAL FLETE': '$' + Math.round(totales.totalFlete).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    'VALOR CONSIGNAR': '$' + Math.round(totales.valorConsignar).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    'ESTADO': 'TOTALES'
  };

  return [...exportData, filaTotales];
}

export function exportCompradorTripHistory(trips: ViajeWithDetails[], compradorNombre: string) {
  try {
    // Preparar datos para exportación con formato específico del historial de compradores
    const exportData = trips.map(trip => ({
      'ID': trip.id || '',
      'FECHA DE CARGUE': trip.fechaCargue ? formatDateWithDaySpanish(trip.fechaCargue) : '-',
      'FECHA DE DESCARGUE': trip.fechaDescargue ? formatDateWithDaySpanish(trip.fechaDescargue) : '-',
      'CONDUCTOR': trip.conductor || '-',
      'TIPO DE CARRO': trip.tipoCarro || '-',
      'PLACA': trip.placa || '-',
      'PESO (Ton)': trip.peso || '-',
      'VUT': trip.vut ? formatCurrency(trip.vut) : '-',
      'FUT': trip.fleteTon ? formatCurrency(trip.fleteTon) : '-',
      'OGF': trip.otrosGastosFlete ? formatCurrency(trip.otrosGastosFlete) : '-',
      'TOTAL VENTA': trip.totalVenta ? formatCurrency(trip.totalVenta) : '-',
      'TOTAL FLETE': trip.totalFlete ? formatCurrency(trip.totalFlete) : '-',
      'VALOR CONSIGNAR': trip.valorConsignar ? formatCurrency(trip.valorConsignar) : '-',
      'ESTADO': trip.estado || '-'
    }));

    // Crear workbook y worksheet con configuración optimizada
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Calcular totales para la fila de resumen
    const totales = exportData.reduce((acc, trip) => {
      const totalVenta = parseFloat(trip['TOTAL VENTA'].replace(/[\$,.]/g, '')) || 0;
      const totalFlete = parseFloat(trip['TOTAL FLETE'].replace(/[\$,.]/g, '')) || 0;
      const valorConsignar = parseFloat(trip['VALOR CONSIGNAR'].replace(/[\$,.]/g, '')) || 0;
      const peso = parseFloat(trip['PESO (Ton)']) || 0;
      return {
        count: acc.count + 1,
        totalVenta: acc.totalVenta + totalVenta,
        totalFlete: acc.totalFlete + totalFlete,
        valorConsignar: acc.valorConsignar + valorConsignar,
        totalPeso: acc.totalPeso + peso
      };
    }, { count: 0, totalVenta: 0, totalFlete: 0, valorConsignar: 0, totalPeso: 0 });

    // Agregar fila de totales
    const filaTotales = {
      'ID': `${totales.count} viajes`,
      'FECHA DE CARGUE': '',
      'FECHA DE DESCARGUE': '',
      'CONDUCTOR': '',
      'TIPO DE CARRO': '',
      'PLACA': '',
      'PESO (Ton)': totales.totalPeso.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      'VUT': '',
      'FUT': '',
      'OGF': '',
      'TOTAL VENTA': '$' + Math.round(totales.totalVenta).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      'TOTAL FLETE': '$' + Math.round(totales.totalFlete).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      'VALOR CONSIGNAR': '$' + Math.round(totales.valorConsignar).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      'ESTADO': 'TOTALES'
    };

    // Agregar la fila de totales al final
    XLSX.utils.sheet_add_json(ws, [filaTotales], { 
      skipHeader: true, 
      origin: `A${exportData.length + 2}` 
    });

    // Configurar el rango completo del worksheet
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Crear estilos usando el formato que soporta XLSX
    const headerStyle = {
      font: { bold: true, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: "FF4472C4" } },
      alignment: { horizontal: "center", vertical: "center" }
    };

    const evenRowStyle = {
      font: { sz: 10 },
      fill: { patternType: "solid", fgColor: { rgb: "FFF2F2F2" } },
      alignment: { vertical: "center" }
    };

    const oddRowStyle = {
      font: { sz: 10 },
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFFFF" } },
      alignment: { vertical: "center" }
    };

    const totalStyle = {
      font: { bold: true, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: "FF70AD47" } },
      alignment: { horizontal: "center", vertical: "center" }
    };

    // Aplicar estilos a encabezados
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    }

    // Aplicar estilos a filas de datos
    for (let row = 1; row <= exportData.length; row++) {
      const isEvenRow = row % 2 === 0;
      const rowStyle = isEvenRow ? evenRowStyle : oddRowStyle;
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = { ...rowStyle };
          
          // Alinear números a la derecha
          const colIndex = col - range.s.c;
          const headers = ['ID', 'FECHA DE CARGUE', 'FECHA DE DESCARGUE', 'CONDUCTOR', 'TIPO DE CARRO', 'PLACA', 'PESO (Ton)', 'VUT', 'FUT', 'OGF', 'TOTAL VENTA', 'TOTAL FLETE', 'VALOR CONSIGNAR', 'ESTADO'];
          const header = headers[colIndex];
          if (header && ['PESO (Ton)', 'VUT', 'FUT', 'OGF', 'TOTAL VENTA', 'TOTAL FLETE', 'VALOR CONSIGNAR'].includes(header)) {
            ws[cellRef].s.alignment = { ...ws[cellRef].s.alignment, horizontal: "right" };
          }
        }
      }
    }

    // Aplicar estilos a fila de totales
    const totalRow = exportData.length + 1;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: totalRow, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = { ...totalStyle };
        
        // Alinear totales numéricos a la derecha
        const colIndex = col - range.s.c;
        const headers = ['ID', 'FECHA DE CARGUE', 'FECHA DE DESCARGUE', 'CONDUCTOR', 'TIPO DE CARRO', 'PLACA', 'PESO (Ton)', 'VUT', 'FUT', 'OGF', 'TOTAL VENTA', 'TOTAL FLETE', 'VALOR CONSIGNAR', 'ESTADO'];
        const header = headers[colIndex];
        if (header && ['PESO (Ton)', 'TOTAL VENTA', 'TOTAL FLETE', 'VALOR CONSIGNAR'].includes(header)) {
          ws[cellRef].s.alignment = { ...ws[cellRef].s.alignment, horizontal: "right" };
        }
      }
    }

    // Configurar anchos de columna optimizados
    const colWidths = [
      { wch: 12 }, // ID
      { wch: 18 }, // FECHA DE CARGUE
      { wch: 18 }, // FECHA DE DESCARGUE
      { wch: 15 }, // CONDUCTOR
      { wch: 15 }, // TIPO DE CARRO
      { wch: 12 }, // PLACA
      { wch: 12 }, // PESO (Ton)
      { wch: 15 }, // VUT
      { wch: 15 }, // FUT
      { wch: 15 }, // OGF
      { wch: 15 }, // TOTAL VENTA
      { wch: 15 }, // TOTAL FLETE
      { wch: 18 }, // VALOR CONSIGNAR
      { wch: 12 }  // ESTADO
    ];
    
    ws['!cols'] = colWidths;

    // Configurar como tabla Excel automática con filtros
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: range.e.r, c: range.e.c })}` };
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Historial de Viajes');

    // Configurar las propiedades del libro
    wb.Props = {
      Title: `Historial de Viajes - ${compradorNombre}`,
      Subject: `Exportación de historial de viajes para comprador ${compradorNombre}`,
      Author: "Sistema RodMar",
      CreatedDate: new Date(),
      Comments: `Generado el ${new Date().toLocaleDateString('es-CO')} con ${exportData.length} viajes del comprador ${compradorNombre}`
    };

    // Generar archivo con nombre descriptivo
    const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
    const fileName = `RodMar_${compradorNombre.replace(/[^a-zA-Z0-9]/g, '_')}_Historial_${fecha}_${exportData.length}viajes.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    return true;
  } catch (error) {
    console.error('Error exportando Excel de historial de compradores:', error);
    alert('Error al generar el archivo Excel. Por favor intenta de nuevo.');
    return false;
  }
}