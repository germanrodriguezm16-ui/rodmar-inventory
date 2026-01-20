import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Tercero } from '@shared/schema';
import { formatCurrency } from '@/lib/utils';

interface TerceroTransaccionesImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacciones: any[];
  tercero: Tercero;
  filterLabel: string;
  terceroId: number;
}

export function TerceroTransaccionesImageModal({
  open,
  onOpenChange,
  transacciones,
  tercero,
  filterLabel,
  terceroId
}: TerceroTransaccionesImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Función para obtener día de la semana abreviado
  const getDayOfWeek = (dateInput: string | Date): string => {
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    let date: Date;
    if (typeof dateInput === 'string') {
      const dateStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
      const [year, month, day] = dateStr.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = dateInput;
    }
    
    return daysOfWeek[date.getDay()];
  };

  const formatDateCompact = (date: Date | string) => {
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

  // Ordenar transacciones por fecha descendente (más recientes primero)
  const transaccionesParaImagen = [...transacciones].sort((a, b) => {
    const fechaAStr = a.fecha instanceof Date 
      ? a.fecha.toISOString().split('T')[0]
      : a.fecha;
    const fechaBStr = b.fecha instanceof Date 
      ? b.fecha.toISOString().split('T')[0]
      : b.fecha;
    
    const fechaComparison = fechaBStr.localeCompare(fechaAStr);
    if (fechaComparison !== 0) {
      return fechaComparison;
    }
    
    const aId = typeof a.id === 'string' ? a.id : String(a.id);
    const bId = typeof b.id === 'string' ? b.id : String(b.id);
    return bId.localeCompare(aId);
  });

  const handleDownload = async () => {
    if (!exportRef.current || !transaccionesParaImagen) return;

    if (transaccionesParaImagen.length > 200) {
      const confirmar = window.confirm(
        `Estás a punto de generar una imagen con ${transaccionesParaImagen.length} transacciones. ` +
        `Esto puede tardar varios segundos y generar una imagen muy larga. ¿Deseas continuar?`
      );
      if (!confirmar) return;
    }

    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        height: exportRef.current.scrollHeight,
        width: exportRef.current.scrollWidth,
        scrollX: 0,
        scrollY: 0
      });

      const link = document.createElement('a');
      link.download = `RodMar_Transacciones_${tercero.nombre}_${filterLabel}_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
      alert('Error al generar la imagen. Si hay muchas transacciones, intenta aplicar filtros para reducir la cantidad.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calcular totales con lógica correcta para terceros
  // Positivos: desde tercero (RodMar le debe al tercero)
  // Negativos: hacia tercero (el tercero le debe a RodMar)
  const totales = transaccionesParaImagen.reduce((acc, t) => {
    const valor = parseFloat(t.valor);
    
    // Lógica para terceros (igual que minas/compradores):
    if (t.deQuienTipo === 'tercero' && t.deQuienId === terceroId.toString()) {
      // Positivos: desde tercero (RodMar le debe al tercero)
      acc.totalPositivos += Math.abs(valor);
      acc.totalGeneral += Math.abs(valor);
    } else if (t.paraQuienTipo === 'tercero' && t.paraQuienId === terceroId.toString()) {
      // Negativos: hacia tercero (el tercero le debe a RodMar)
      acc.totalNegativos += Math.abs(valor);
      acc.totalGeneral -= Math.abs(valor);
    }
    
    return acc;
  }, { 
    totalPositivos: 0, 
    totalNegativos: 0, 
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
            <span>Transacciones del Tercero - {tercero.nombre}</span>
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
            <div className="text-xs font-bold text-gray-800">{tercero.nombre} - {filterLabel}</div>
            <div className="text-[10px] text-gray-500">
              {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>

          {/* Resumen ultra-compacto con etiquetas */}
          <div className="mb-1 bg-gray-50 rounded p-1">
            <div className="grid grid-cols-4 gap-1 text-center text-[9px]">
              <div>
                <div className="text-gray-600 text-[8px]">Positivos</div>
                <div className="text-green-600 font-bold">+{formatCurrency(totales.totalPositivos.toString())}</div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Negativos</div>
                <div className="text-red-600 font-bold">-{formatCurrency(totales.totalNegativos.toString())}</div>
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
                  }}>COMENTARIO</th>
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
                  
                  // Aplicar lógica específica para terceros
                  let colorClass = '';
                  let signo = '';
                  
                  if (transaccion.deQuienTipo === 'tercero' && transaccion.deQuienId === terceroId.toString()) {
                    // Positivos: desde tercero (RodMar le debe al tercero)
                    colorClass = 'text-green-600';
                    signo = '+';
                  } else if (transaccion.paraQuienTipo === 'tercero' && transaccion.paraQuienId === terceroId.toString()) {
                    // Negativos: hacia tercero (el tercero le debe a RodMar)
                    colorClass = 'text-red-600';
                    signo = '-';
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
                        {transaccion.comentario || '-'}
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

          {/* Footer compacto */}
          <div className="text-center text-[8px] text-gray-500 mt-2 border-t border-gray-200 pt-1">
            <div>Generado por RodMar - Sistema de Gestión Minera</div>
            <div>© 2025 - Todos los derechos reservados</div>
          </div>
        </div>

        {/* Tabla clon dedicada para exportar - oculta fuera de pantalla */}
        <div
          ref={exportRef}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '400px',
            minWidth: '400px',
            maxWidth: '400px',
            backgroundColor: '#ffffff',
            padding: '8px',
            fontSize: '11px',
            lineHeight: '1.3'
          }}
        >
          {/* Header del reporte */}
          <div style={{ textAlign: 'center', marginBottom: '4px', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', transform: 'translateY(-12px)' }}>
              {tercero.nombre} - {filterLabel}
            </div>
            <div style={{ fontSize: '10px', color: '#6b7280', transform: 'translateY(-12px)' }}>
              {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>

          {/* Resumen */}
          <div style={{ marginBottom: '4px', backgroundColor: '#f9fafb', borderRadius: '4px', padding: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center', fontSize: '9px' }}>
              <div>
                <div style={{ color: '#4b5563', fontSize: '8px' }}>Positivos</div>
                <div style={{ color: '#16a34a', fontWeight: 'bold' }}>+{formatCurrency(totales.totalPositivos.toString())}</div>
              </div>
              <div>
                <div style={{ color: '#4b5563', fontSize: '8px' }}>Negativos</div>
                <div style={{ color: '#dc2626', fontWeight: 'bold' }}>-{formatCurrency(totales.totalNegativos.toString())}</div>
              </div>
              <div>
                <div style={{ color: '#4b5563', fontSize: '8px' }}>Balance</div>
                <div style={{ fontWeight: 'bold', color: totales.totalGeneral >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatCurrency(totales.totalGeneral.toString())}
                </div>
              </div>
              <div>
                <div style={{ color: '#4b5563', fontSize: '8px' }}>Total</div>
                <div style={{ fontWeight: 'bold', color: '#1f2937' }}>({transaccionesParaImagen.length})</div>
              </div>
            </div>
          </div>

          {/* Tabla de transacciones con estilos optimizados para html2canvas */}
          {transaccionesParaImagen.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px', color: '#6b7280', fontSize: '9px' }}>
              No hay transacciones que coincidan con el filtro aplicado
            </div>
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
                <thead>
                  <tr style={{ backgroundColor: '#2563eb', color: '#ffffff', height: '20px' }}>
                    <th style={{
                      border: '1px solid #d1d5db',
                      fontSize: '9px',
                      fontWeight: '600',
                      padding: '0',
                      height: '20px',
                      width: '80px',
                      minWidth: '80px',
                      textAlign: 'left',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        height: '100%', 
                        paddingLeft: '8px', 
                        paddingRight: '8px',
                        paddingTop: '9px',
                        paddingBottom: '0px',
                        transform: 'translateY(-10px)'
                      }}>
                        FECHA
                      </div>
                    </th>
                    <th style={{
                      border: '1px solid #d1d5db',
                      fontSize: '9px',
                      fontWeight: '600',
                      padding: '0',
                      height: '20px',
                      width: '210px',
                      minWidth: '210px',
                      textAlign: 'left',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        height: '100%', 
                        paddingLeft: '8px', 
                        paddingRight: '8px',
                        paddingTop: '9px',
                        paddingBottom: '0px',
                        transform: 'translateY(-10px)'
                      }}>
                        COMENTARIO
                      </div>
                    </th>
                    <th style={{
                      border: '1px solid #d1d5db',
                      fontSize: '9px',
                      fontWeight: '600',
                      padding: '0',
                      height: '20px',
                      width: '60px',
                      minWidth: '60px',
                      textAlign: 'right',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end', 
                        height: '100%', 
                        paddingLeft: '8px', 
                        paddingRight: '8px',
                        paddingTop: '9px',
                        paddingBottom: '0px',
                        transform: 'translateY(-10px)'
                      }}>
                        VALOR
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transaccionesParaImagen.map((transaccion, index) => {
                    const valor = parseFloat(transaccion.valor);
                    
                    let colorClass = '';
                    let signo = '';
                    
                    if (transaccion.deQuienTipo === 'tercero' && transaccion.deQuienId === terceroId.toString()) {
                      colorClass = '#16a34a';
                      signo = '+';
                    } else if (transaccion.paraQuienTipo === 'tercero' && transaccion.paraQuienId === terceroId.toString()) {
                      colorClass = '#dc2626';
                      signo = '-';
                    }
                    
                    return (
                      <tr key={transaccion.id} style={{
                        height: '18px',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                      }}>
                        <td style={{
                          border: '1px solid #d1d5db',
                          fontSize: '9px',
                          padding: '0',
                          height: '18px',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            height: '100%', 
                            paddingLeft: '8px', 
                            paddingRight: '8px',
                            paddingTop: '6px',
                            paddingBottom: '0px',
                            transform: 'translateY(-8px)'
                          }}>
                            {formatDateCompact(transaccion.fecha)}
                          </div>
                        </td>
                        <td style={{
                          border: '1px solid #d1d5db',
                          fontSize: '9px',
                          padding: '0',
                          height: '18px',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            height: '100%', 
                            paddingLeft: '8px', 
                            paddingRight: '8px',
                            paddingTop: '6px',
                            paddingBottom: '0px',
                            transform: 'translateY(-8px)'
                          }}>
                            {transaccion.comentario || '-'}
                          </div>
                        </td>
                        <td style={{
                          border: '1px solid #d1d5db',
                          fontSize: '9px',
                          padding: '0',
                          height: '18px',
                          fontWeight: '500',
                          color: colorClass,
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'flex-end', 
                            height: '100%', 
                            paddingLeft: '8px', 
                            paddingRight: '8px',
                            paddingTop: '6px',
                            paddingBottom: '0px',
                            transform: 'translateY(-8px)'
                          }}>
                            {signo}{formatCurrency(Math.abs(valor))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: '8px', color: '#6b7280', marginTop: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
            <div style={{ transform: 'translateY(-10px)' }}>Generado por RodMar - Sistema de Gestión Minera</div>
            <div style={{ transform: 'translateY(-10px)' }}>© 2025 - Todos los derechos reservados</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


