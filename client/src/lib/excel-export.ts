import * as XLSX from 'xlsx';
import { ViajeWithDetails } from '@/../../shared/schema';
import { formatCurrency } from './calculations';

export function exportTripsToCSV(trips: ViajeWithDetails[]) {
  try {
    // Preparar datos para exportación con formato exacto según imagen del usuario
    const exportData = trips.map(trip => ({
      'ID': trip.id || '',
      'Fecha de Cargue': trip.fechaCargue ? new Date(trip.fechaCargue).toLocaleDateString('es-CO') : '',
      'Mina': trip.mina?.nombre || '',
      'Conductor': trip.conductor || '',
      'Tipo de Carro': trip.tipoCarro || '',
      'Placa': trip.placa || '',
      'CUT': trip.cut ? formatCurrency(trip.cut) : '',
      'Fecha de Descargue': trip.fechaDescargue ? new Date(trip.fechaDescargue).toLocaleDateString('es-CO') : '',
      'Comprador': trip.comprador?.nombre || '',
      'Peso': trip.peso || '',
      'VUT': trip.vut ? formatCurrency(trip.vut) : '',
      'FUT': trip.fut ? formatCurrency(trip.fut) : '',
      'OGF': trip.otrosGastosFlete ? formatCurrency(trip.otrosGastosFlete) : '',
      'Total Venta': trip.totalVenta ? formatCurrency(trip.totalVenta) : '',
      'Total Compra': trip.totalCompra ? formatCurrency(trip.totalCompra) : '',
      'Total Flete': trip.totalFlete ? formatCurrency(trip.totalFlete) : '',
      'Valor a Consignar': trip.valorConsignar ? formatCurrency(trip.valorConsignar) : '',
      'Ganancias': trip.ganancia ? formatCurrency(trip.ganancia) : '',
      '¿QPF?': trip.quienPagaFlete === 'comprador' ? 'El comprador' : 'Tú',
      'Recibo': trip.recibo ? `=HYPERLINK("https://${window.location.host}/recibo/${trip.id}","Ver Recibo")` : '',
      'Observaciones': trip.observaciones || ''
    }));

    // Crear workbook y worksheet con configuración optimizada
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Calcular totales para la fila de resumen
    const totales = exportData.reduce((acc, trip) => {
      const peso = parseFloat(trip.Peso.replace(',', '.')) || 0;
      const totalVenta = parseFloat(trip['Total Venta'].replace(/[\$,]/g, '')) || 0;
      const totalCompra = parseFloat(trip['Total Compra'].replace(/[\$,]/g, '')) || 0;
      const totalFlete = parseFloat(trip['Total Flete'].replace(/[\$,]/g, '')) || 0;
      const valorConsignar = parseFloat(trip['Valor a Consignar'].replace(/[\$,]/g, '')) || 0;
      const ganancias = parseFloat(trip['Ganancias'].replace(/[\$,]/g, '')) || 0;
      
      return {
        peso: acc.peso + peso,
        totalVenta: acc.totalVenta + totalVenta,
        totalCompra: acc.totalCompra + totalCompra,
        totalFlete: acc.totalFlete + totalFlete,
        valorConsignar: acc.valorConsignar + valorConsignar,
        ganancias: acc.ganancias + ganancias
      };
    }, { peso: 0, totalVenta: 0, totalCompra: 0, totalFlete: 0, valorConsignar: 0, ganancias: 0 });

    // Agregar fila de totales
    const filaTotales = {
      'ID': '',
      'Fecha de Cargue': '',
      'Mina': '',
      'Conductor': '',
      'Tipo de Carro': '',
      'Placa': '',
      'CUT': '',
      'Fecha de Descargue': '',
      'Comprador': 'TOTALES',
      'Peso': totales.peso.toFixed(2),
      'VUT': '',
      'FUT': '',
      'OGF': '',
      'Total Venta': formatCurrency(totales.totalVenta.toString()),
      'Total Compra': formatCurrency(totales.totalCompra.toString()),
      'Total Flete': formatCurrency(totales.totalFlete.toString()),
      'Valor a Consignar': formatCurrency(totales.valorConsignar.toString()),
      'Ganancias': formatCurrency(totales.ganancias.toString()),
      '¿QPF?': '',
      'Recibo': '',
      'Observaciones': ''
    };

    // Agregar la fila de totales al final
    XLSX.utils.sheet_add_json(ws, [filaTotales], { 
      skipHeader: true, 
      origin: `A${exportData.length + 2}` 
    });

    // Configurar estilos y colores
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Estilo para encabezados (fila 1)
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }

    // Estilo para filas de datos (alternando colores)
    for (let row = 1; row <= exportData.length; row++) {
      const isEvenRow = row % 2 === 0;
      const fillColor = isEvenRow ? "F2F2F2" : "FFFFFF";
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;
        
        ws[cellAddress].s = {
          fill: { fgColor: { rgb: fillColor } },
          border: {
            top: { style: "thin", color: { rgb: "D0D0D0" } },
            bottom: { style: "thin", color: { rgb: "D0D0D0" } },
            left: { style: "thin", color: { rgb: "D0D0D0" } },
            right: { style: "thin", color: { rgb: "D0D0D0" } }
          },
          alignment: { vertical: "center" }
        };

        // Alineación especial para columnas de dinero
        const colHeader = Object.keys(exportData[0])[col];
        if (colHeader && ['Total Venta', 'Total Compra', 'Total Flete', 'Valor a Consignar', 'Ganancias', 'Peso', 'VUT', 'FUT', 'CUT', 'OGF'].includes(colHeader)) {
          ws[cellAddress].s.alignment = { ...ws[cellAddress].s.alignment, horizontal: "right" };
        }
      }
    }

    // Estilo especial para fila de totales
    const totalRow = exportData.length + 1;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: totalRow, c: col });
      if (!ws[cellAddress]) continue;
      
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "70AD47" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thick", color: { rgb: "000000" } },
          bottom: { style: "thick", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };

      // Alineación derecha para columnas numéricas en totales
      const colHeader = Object.keys(exportData[0])[col];
      if (colHeader && ['Total Venta', 'Total Compra', 'Total Flete', 'Valor a Consignar', 'Ganancias', 'Peso'].includes(colHeader)) {
        ws[cellAddress].s.alignment = { ...ws[cellAddress].s.alignment, horizontal: "right" };
      }
    }

    // Configurar anchos de columna según el nuevo formato
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 15 }, // Fecha de Cargue
      { wch: 15 }, // Mina
      { wch: 15 }, // Conductor
      { wch: 15 }, // Tipo de Carro
      { wch: 10 }, // Placa
      { wch: 15 }, // CUT
      { wch: 15 }, // Fecha de Descargue
      { wch: 15 }, // Comprador
      { wch: 10 }, // Peso
      { wch: 15 }, // VUT
      { wch: 15 }, // FUT
      { wch: 15 }, // OGF
      { wch: 15 }, // Total Venta
      { wch: 15 }, // Total Compra
      { wch: 15 }, // Total Flete
      { wch: 18 }, // Valor a Consignar
      { wch: 15 }, // Ganancias
      { wch: 15 }, // ¿QPF?
      { wch: 15 }, // Recibo
      { wch: 20 }  // Observaciones
    ];
    
    ws['!cols'] = colWidths;

    // Configurar como tabla Excel automática con filtros
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: range.e.r, c: range.e.c })}` };
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Viajes');

    // Configurar las propiedades del libro mejoradas
    wb.Props = {
      Title: "Reporte de Viajes - RodMar",
      Subject: "Exportación completa de viajes con totales y formato profesional",
      Author: "Sistema RodMar",
      CreatedDate: new Date(),
      Comments: `Generado el ${new Date().toLocaleDateString('es-CO')} con ${exportData.length} viajes`
    };

    // Generar archivo con nombre más descriptivo
    const fecha = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
    const fileName = `RodMar_Viajes_${fecha}_${exportData.length}viajes.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error('Error exportando Excel:', error);
    alert('Error al generar el archivo Excel. Por favor intenta de nuevo.');
  }
}