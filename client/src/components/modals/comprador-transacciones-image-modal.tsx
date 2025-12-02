import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Comprador } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';

interface CompradorTransaccionesImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacciones: any[]; // Acepta transacciones combinadas (manuales + dinámicas de viajes)
  comprador: Comprador;
  filterLabel: string;
}

export function CompradorTransaccionesImageModal({
  open,
  onOpenChange,
  transacciones,
  comprador,
  filterLabel
}: CompradorTransaccionesImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  // Función para obtener día de la semana abreviado
  const getDayOfWeek = (dateInput: string | Date): string => {
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    let date: Date;
    if (typeof dateInput === 'string') {
      // Si es string, crear fecha sin problemas UTC
      const dateStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
      const [year, month, day] = dateStr.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = dateInput;
    }
    
    return daysOfWeek[date.getDay()];
  };

  const formatDateCompact = (date: Date | string) => {
    // Formato con día de la semana para imagen descargable
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

  // APLICAR EXACTAMENTE EL MISMO ORDENAMIENTO QUE LA PESTAÑA
  const transaccionesParaImagen = [...transacciones].sort((a, b) => {
    // Copia exacta del ordenamiento de comprador-detail.tsx líneas 1120-1150
    const fechaAStr = a.fecha instanceof Date 
      ? a.fecha.toISOString().split('T')[0]
      : a.fecha;
    const fechaBStr = b.fecha instanceof Date 
      ? b.fecha.toISOString().split('T')[0]
      : b.fecha;
    
    // Ordenar por fecha descendente (más recientes primero)
    const fechaComparison = fechaBStr.localeCompare(fechaAStr);
    if (fechaComparison !== 0) {
      return fechaComparison;
    }
    
    // Si las fechas son iguales, ordenar por ID descendente
    const aId = typeof a.id === 'string' ? a.id : String(a.id);
    const bId = typeof b.id === 'string' ? b.id : String(b.id);
    return bId.localeCompare(aId);
  });
  
  console.log('🖼️ MODAL DEBUG - TRANSACCIONES PARA IMAGEN:', {
    totalTransacciones: transacciones.length,
    tiposTransacciones: Array.from(new Set(transacciones.map(t => t.tipo))),
    transaccionesParaImagen: transaccionesParaImagen.length,
    primeraTransaccion: transacciones[0] ? {
      id: transacciones[0].id,
      fecha: transacciones[0].fecha,
      fechaType: typeof transacciones[0].fecha,
      concepto: transacciones[0].concepto,
      tipo: transacciones[0].tipo
    } : null,
    ultimaTransaccion: transacciones[transacciones.length - 1] ? {
      id: transacciones[transacciones.length - 1].id,
      fecha: transacciones[transacciones.length - 1].fecha,
      fechaType: typeof transacciones[transacciones.length - 1].fecha,
      concepto: transacciones[transacciones.length - 1].concepto,
      tipo: transacciones[transacciones.length - 1].tipo
    } : null
  });

  const handleDownload = async () => {
    if (!imageRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        height: imageRef.current.scrollHeight,
        width: imageRef.current.scrollWidth
      });

      // Crear enlace de descarga
      const link = document.createElement('a');
      link.download = `RodMar_Transacciones_${comprador.nombre}_${filterLabel}_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
      alert('Error al generar la imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calcular totales con lógica correcta para compradores - usar transacciones balanceadas
  const totales = transaccionesParaImagen.reduce((acc, t) => {
    const valor = parseFloat(t.valor);
    
    if (t.tipo === "Manual") {
      // Para transacciones manuales, verificar la dirección real de la transacción
      if (t.paraQuienTipo === 'comprador') {
        // Transacciones hacia comprador = negativas (egresos para el comprador)
        acc.totalManualesNegativos += Math.abs(valor);
        acc.totalGeneral -= Math.abs(valor);
      } else {
        // Transacciones desde comprador = positivas (ingresos para el comprador)
        acc.totalManualesPositivos += Math.abs(valor);
        acc.totalGeneral += Math.abs(valor);
      }
    } else if (t.tipo === "Viaje") {
      // Transacciones de viajes = negativas para compradores
      acc.totalViajes += Math.abs(valor);
      acc.totalGeneral -= Math.abs(valor);
    }
    
    return acc;
  }, { 
    totalManualesPositivos: 0, 
    totalManualesNegativos: 0, 
    totalViajes: 0, 
    totalGeneral: 0 
  });

  // Ajustar tamaño visual basado en la cantidad de transacciones
  const getVisualSizes = (count: number) => {
    if (count <= 10) {
      return { fontSize: '11px', rowHeight: '30px', headerHeight: '35px' };
    } else if (count <= 20) {
      return { fontSize: '10px', rowHeight: '26px', headerHeight: '32px' };
    } else if (count <= 30) {
      return { fontSize: '9px', rowHeight: '22px', headerHeight: '28px' };
    } else if (count <= 40) {
      return { fontSize: '8px', rowHeight: '20px', headerHeight: '26px' };
    } else {
      return { fontSize: '7px', rowHeight: '18px', headerHeight: '24px' };
    }
  };

  const visualSizes = getVisualSizes(transaccionesParaImagen.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transacciones del Comprador - {comprador.nombre}</span>
            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generando...' : 'Descargar PNG'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={imageRef} className="bg-white p-2" style={{ 
          width: '400px',
          minWidth: '400px',
          maxWidth: '400px',
          fontSize: '11px',
          lineHeight: '1.3'
        }}>
          {/* Header ultra-compacto */}
          <div className="text-center mb-1 border-b border-gray-200 pb-0.5">
            <div className="text-xs font-bold text-gray-800">{comprador.nombre} - {filterLabel}</div>
            <div className="text-[10px] text-gray-500">
              {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>

          {/* Resumen ultra-compacto con etiquetas */}
          <div className="mb-1 bg-gray-50 rounded p-1">
            <div className="grid grid-cols-4 gap-1 text-center text-[9px]">
              <div>
                <div className="text-gray-600 text-[8px]">Positivos</div>
                <div className="text-green-600 font-bold">+{formatCurrency(totales.totalManualesPositivos.toString())}</div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Negativos</div>
                <div className="text-red-600 font-bold">-{formatCurrency((totales.totalManualesNegativos + totales.totalViajes).toString())}</div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Balance</div>
                <div className={`font-bold ${totales.totalGeneral >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totales.totalGeneral.toString())}
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Total</div>
                <div className="font-bold text-gray-800">({transacciones.length})</div>
              </div>
            </div>
          </div>

          {/* Tabla de transacciones */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-blue-600 text-white" style={{ height: visualSizes.headerHeight }}>
                  <th className="border border-gray-300 px-2 text-left font-semibold" style={{ 
                    fontSize: visualSizes.fontSize,
                    verticalAlign: 'middle',
                    lineHeight: '1.2'
                  }}>FECHA</th>
                  <th className="border border-gray-300 px-2 text-left font-semibold" style={{ 
                    fontSize: visualSizes.fontSize,
                    verticalAlign: 'middle',
                    lineHeight: '1.2'
                  }}>CONCEPTO</th>
                  <th className="border border-gray-300 px-2 text-right font-semibold" style={{ 
                    fontSize: visualSizes.fontSize,
                    verticalAlign: 'middle',
                    lineHeight: '1.2'
                  }}>VALOR</th>
                </tr>
              </thead>
              <tbody>
                {transaccionesParaImagen.map((transaccion, index) => {
                  const valor = parseFloat(transaccion.valor);
                  
                  // Transacción renderizada en modal con orden correcto
                  
                  // Aplicar lógica específica para compradores
                  let colorClass = '';
                  let signo = '';
                  
                  if (transaccion.tipo === "Viaje") {
                    // Transacciones automáticas de viajes = ROJO y NEGATIVO
                    colorClass = 'text-red-600';
                    signo = '-';
                  } else if (transaccion.tipo === "Manual") {
                    // Para transacciones manuales, verificar la dirección
                    if (transaccion.paraQuienTipo === 'comprador') {
                      // Transacciones hacia comprador = ROJO y NEGATIVO
                      colorClass = 'text-red-600';
                      signo = '-';
                    } else {
                      // Transacciones desde comprador = VERDE y POSITIVO
                      colorClass = 'text-green-600';
                      signo = '+';
                    }
                  }
                  
                  return (
                    <tr key={transaccion.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: visualSizes.rowHeight }}>
                      <td className="border border-gray-300 px-2" style={{ 
                        fontSize: visualSizes.fontSize,
                        verticalAlign: 'middle',
                        lineHeight: '1.2'
                      }}>
                        {formatDateCompact(transaccion.fecha)}
                      </td>
                      <td className="border border-gray-300 px-2" style={{ 
                        fontSize: visualSizes.fontSize,
                        verticalAlign: 'middle',
                        lineHeight: '1.2'
                      }}>
                        {transaccion.concepto}
                      </td>
                      <td className={`border border-gray-300 px-2 text-right font-semibold ${colorClass}`} style={{ 
                        fontSize: visualSizes.fontSize,
                        verticalAlign: 'middle',
                        lineHeight: '1.2'
                      }}>
                        {signo}{formatCurrency(Math.abs(valor))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Este reporte fue generado automáticamente por RodMar - Sistema de Gestión Minera</p>
            <p>Para consultas o soporte técnico, contacte al administrador del sistema</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}