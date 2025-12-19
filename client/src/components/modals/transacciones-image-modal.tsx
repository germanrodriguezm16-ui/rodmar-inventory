import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { TransaccionWithSocio, Mina } from '@shared/schema';
import { useNavigationVisibility } from '@/hooks/use-navigation-visibility';
import { formatCurrency } from '@/lib/utils';

interface TransaccionesImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: any[]; // Acepta transacciones combinadas (manuales + dinámicas de viajes)
  title: string;
  subtitle: string;
  accountType?: string;
  // Props alternativas para compatibilidad con minas
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  transacciones?: any[];
  mina?: Mina;
  filterLabel?: string;
}

export function TransaccionesImageModal({
  isOpen,
  onClose,
  transactions,
  title,
  subtitle,
  accountType,
  // Props alternativas para compatibilidad
  open,
  onOpenChange,
  transacciones,
  mina,
  filterLabel
}: TransaccionesImageModalProps) {
  // Unificar props para compatibilidad
  const modalOpen = isOpen ?? open ?? false;
  const handleClose = onClose ?? (() => onOpenChange?.(false));
  const transaccionesData = transactions ?? transacciones ?? [];
  const modalTitle = title ?? mina?.nombre ?? 'Transacciones';
  const modalSubtitle = subtitle ?? filterLabel ?? 'Período seleccionado';

  const [isGenerating, setIsGenerating] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null); // Ref para tabla clon dedicada a exportar
  // NOTA SOBRE RENDIMIENTO: La tabla clon dedicada para exportar tiene impacto mínimo:
  // - Tablas típicas: 20-200 transacciones (20-200 filas)
  // - html2canvas procesa ~100-500 nodos DOM adicionales (tabla clon)
  // - Tiempo adicional estimado: <100ms para tablas pequeñas (<50 filas), <500ms para grandes (100-200 filas)
  // - El costo principal sigue siendo el renderizado del canvas, no la duplicación del DOM
  // - Conclusión: Impacto aceptable para el beneficio de alineación vertical correcta
  const { hideNavigation, showNavigation } = useNavigationVisibility();

  // Controlar la visibilidad de la navegación basado en el estado del modal
  useEffect(() => {
    if (modalOpen) {
      hideNavigation();
    } else {
      showNavigation();
    }

    // Cleanup: asegurar que la navegación se muestre cuando el componente se desmonte
    return () => {
      showNavigation();
    };
  }, [modalOpen, hideNavigation, showNavigation]);

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

  const handleDownload = async () => {
    // Usar tabla clon para exportar (mejor alineación vertical con html2canvas)
    if (!exportRef.current || !transaccionesData) return;

    // Advertencia informativa (no bloqueante) si hay muchas transacciones
    if (transaccionesData.length > 200) {
      const confirmar = window.confirm(
        `Estás a punto de generar una imagen con ${transaccionesData.length} transacciones. ` +
        `Esto puede tardar varios segundos y generar una imagen muy larga. ¿Deseas continuar?`
      );
      if (!confirmar) return;
    }

    setIsGenerating(true);
    try {
      // Esperar un momento para asegurar que la tabla clon esté renderizada
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
      link.download = `${mina?.nombre || 'Transacciones'}_Transacciones_${(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
      alert('Error al generar la imagen. Si hay muchas transacciones, intenta aplicar filtros para reducir la cantidad.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calcular totales usando lógica adaptativa según el tipo de cuenta
  const totalTransacciones = transaccionesData.length;
  
  // Detectar si es LCDM, Postobón o una mina regular
  const esLCDM = mina?.id?.toString() === 'lcdm' || mina?.nombre === 'La Casa del Motero' || accountType === 'lcdm';
  const esPostobon = mina?.nombre?.toLowerCase().includes('postobón') || mina?.nombre?.toLowerCase().includes('postobon') || accountType === 'postobon';
  const esRodMarAccount = esLCDM || esPostobon;
  
  let positiveSum = 0;
  let negativeSum = 0;
  
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

  // Balance total
  const totalValor = positiveSum - negativeSum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-auto p-2 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm sm:text-base">Vista Previa - Reporte de Transacciones</span>
            <div className="flex items-center gap-2 justify-end">
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3"
                size="sm"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{isGenerating ? "Generando..." : "Descargar"}</span>
                <span className="sm:hidden">{isGenerating ? "..." : "Img"}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 px-2"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Advertencia informativa si hay muchas transacciones */}
        {transaccionesData.length > 200 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">ℹ️</div>
              <div>
                <h4 className="text-blue-800 font-medium text-sm mb-1">
                  Muchas transacciones ({transaccionesData.length} transacciones)
                </h4>
                <p className="text-blue-700 text-sm">
                  La generación de la imagen puede tardar varios segundos. La imagen será muy larga pero incluirá todas las transacciones.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido de la imagen */}
        <div 
          ref={imageRef}
          className="bg-white p-2 rounded-lg w-full"
          style={{ 
            width: '400px', // Ancho móvil optimizado
            minWidth: '400px',
            maxWidth: '400px',
            fontSize: '11px', 
            lineHeight: '1.3' 
          }}
        >
          {/* Header del reporte ultra-compacto - máxima densidad */}
          <div className="text-center mb-1 border-b border-gray-200 pb-0.5">
            <div className="text-xs font-bold text-gray-800">{mina?.nombre || modalTitle} - {filterLabel}</div>
            <div className="text-[10px] text-gray-500">
              {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>

          {/* Resumen ultra-compacto con etiquetas */}
          <div className="mb-1 bg-gray-50 rounded p-1">
            <div className="grid grid-cols-4 gap-1 text-center text-[9px]">
              <div>
                <div className="text-gray-600 text-[8px]">Positivos</div>
                <div className="text-green-600 font-bold">+{formatCurrency(positiveSum.toString())}</div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Negativos</div>
                <div className="text-red-600 font-bold">-{formatCurrency(Math.abs(negativeSum).toString())}</div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Balance</div>
                <div className={`font-bold ${totalValor >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totalValor.toString())}
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-[8px]">Total</div>
                <div className="font-bold text-gray-800">({transaccionesData.length})</div>
              </div>
            </div>
          </div>

          {/* Tabla de transacciones - igual que compradores */}
          {transaccionesData.length === 0 ? (
              <div className="text-center py-3 text-gray-500 text-[9px]">
                No hay transacciones que coincidan con el filtro aplicado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-blue-600 text-white" style={{ height: '20px' }}>
                      <th className="border border-gray-300 text-left font-semibold" style={{ 
                        fontSize: '9px',
                        padding: '0',
                        height: '20px',
                        width: '80px',
                        minWidth: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>FECHA</div>
                      </th>
                      <th className="border border-gray-300 text-left font-semibold" style={{ 
                        fontSize: '9px',
                        padding: '0',
                        height: '20px',
                        width: '210px',
                        minWidth: '210px',
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>COMENTARIO</div>
                      </th>
                      <th className="border border-gray-300 text-right font-semibold" style={{ 
                        fontSize: '9px',
                        padding: '0',
                        height: '20px',
                        width: '60px',
                        minWidth: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>VALOR</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaccionesData.map((transaccion, index) => {
                      const valor = parseFloat(transaccion.valor || '0');
                      const minaId = mina?.id?.toString(); // Definir minaId para visualización
                      
                      // Lógica adaptativa según el tipo de cuenta
                      let colorClass = '';
                      let signo = '';
                      
                      if (esRodMarAccount) {
                        // Lógica para cuentas RodMar (LCDM/Postobón)
                        if (esLCDM) {
                          // Para LCDM: verde si va hacia RodMar/Banco, rojo si va hacia LCDM
                          if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                            colorClass = 'text-green-600';
                            signo = '+';
                          } else if (transaccion.paraQuienTipo === 'lcdm') {
                            colorClass = 'text-red-600';
                            signo = '-';
                          } else {
                            // Fallback para otros tipos
                            colorClass = 'text-gray-600';
                            signo = '';
                          }
                        } else if (esPostobon) {
                          // Para Postobón: lógica similar
                          if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                            colorClass = 'text-green-600';
                            signo = '+';
                          } else if (transaccion.paraQuienTipo === 'postobon') {
                            colorClass = 'text-red-600';
                            signo = '-';
                          } else {
                            colorClass = 'text-gray-600';
                            signo = '';
                          }
                        }
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
                      
                      return (
                        <tr key={transaccion.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '18px' }}>
                          <td className="border border-gray-300" style={{ 
                            fontSize: '9px',
                            padding: '0',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                              {formatDateCompact(transaccion.fecha)}
                            </div>
                          </td>
                          <td className="border border-gray-300" style={{ 
                            fontSize: '9px',
                            padding: '0',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                              {transaccion.concepto && transaccion.concepto.startsWith('Viaje') 
                                ? transaccion.concepto 
                                : (transaccion.comentario || '-')}
                            </div>
                          </td>
                          <td className={`border border-gray-300 text-right font-medium ${colorClass}`} style={{ 
                            fontSize: '9px',
                            padding: '0',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>
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

          {/* Footer compacto */}
          <div className="text-center text-[8px] text-gray-500 mt-2 border-t pt-1">
            <div>Generado por RodMar - Sistema de Gestión Minera</div>
            <div>© 2025 - Todos los derechos reservados</div>
          </div>
        </div>
      </DialogContent>

      {/* Tabla clon dedicada para exportar - oculta fuera de pantalla, estilos optimizados para html2canvas */}
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
            {mina?.nombre || modalTitle} - {modalSubtitle}
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
              <div style={{ color: '#16a34a', fontWeight: 'bold' }}>+{formatCurrency(positiveSum.toString())}</div>
            </div>
            <div>
              <div style={{ color: '#4b5563', fontSize: '8px' }}>Negativos</div>
              <div style={{ color: '#dc2626', fontWeight: 'bold' }}>-{formatCurrency(Math.abs(negativeSum).toString())}</div>
            </div>
            <div>
              <div style={{ color: '#4b5563', fontSize: '8px' }}>Balance</div>
              <div style={{ fontWeight: 'bold', color: totalValor >= 0 ? '#16a34a' : '#dc2626' }}>
                {formatCurrency(totalValor.toString())}
              </div>
            </div>
            <div>
              <div style={{ color: '#4b5563', fontSize: '8px' }}>Total</div>
              <div style={{ fontWeight: 'bold', color: '#1f2937' }}>({transaccionesData.length})</div>
            </div>
          </div>
        </div>

        {/* Tabla de transacciones con estilos optimizados para html2canvas */}
        {transaccionesData.length === 0 ? (
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
                {transaccionesData.map((transaccion, index) => {
                  const valor = parseFloat(transaccion.valor || '0');
                  const minaId = mina?.id?.toString();
                  
                  // Misma lógica de colores que la tabla visible
                  let colorClass = '';
                  let signo = '';
                  
                  if (esRodMarAccount) {
                    if (esLCDM) {
                      if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                        colorClass = '#16a34a';
                        signo = '+';
                      } else if (transaccion.paraQuienTipo === 'lcdm') {
                        colorClass = '#dc2626';
                        signo = '-';
                      } else {
                        colorClass = '#4b5563';
                        signo = '';
                      }
                    } else if (esPostobon) {
                      if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                        colorClass = '#16a34a';
                        signo = '+';
                      } else if (transaccion.paraQuienTipo === 'postobon') {
                        colorClass = '#dc2626';
                        signo = '-';
                      } else {
                        colorClass = '#4b5563';
                        signo = '';
                      }
                    }
                  } else {
                    const esViaje = transaccion.concepto && transaccion.concepto.startsWith('Viaje');
                    
                    if (esViaje) {
                      colorClass = '#16a34a';
                      signo = '+';
                    } else if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId) {
                      colorClass = '#16a34a';
                      signo = '+';
                    } else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId) {
                      colorClass = '#dc2626';
                      signo = '-';
                    } else if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                      colorClass = '#16a34a';
                      signo = '+';
                    } else {
                      colorClass = '#4b5563';
                      signo = '';
                    }
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
                          {transaccion.concepto && transaccion.concepto.startsWith('Viaje') 
                            ? transaccion.concepto 
                            : (transaccion.comentario || '-')}
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
    </Dialog>
  );
}