import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatCurrency } from '@/lib/utils';

interface RodmarTransaccionesImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: any[];
  title: string;
  subtitle: string;
  accountType?: string;
}

export function RodmarTransaccionesImageModal({
  isOpen,
  onClose,
  transactions,
  title,
  subtitle,
  accountType
}: RodmarTransaccionesImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  // Validación de datos
  if (!transactions) {
    return null;
  }

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

  const handleDownload = async () => {
    if (!imageRef.current || !transactions) return;

    // Validar que no haya más de 100 transacciones
    if (transactions.length > 100) {
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
        width: 500,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 600,
        windowHeight: imageRef.current.scrollHeight
      });

      const link = document.createElement('a');
      link.download = `${title}_Transacciones_${(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Calcular totales para cuentas RodMar (LCDM/Postobón)
  const totalTransacciones = transactions.length;
  
  let positiveSum = 0;
  let negativeSum = 0;
  
  // Lógica para cuentas RodMar corregida para coincidir con balance de transacciones
  if (accountType === 'lcdm') {
    // LÓGICA CORREGIDA: usar misma lógica que LcdmBalanceTab
    // Positivos: transacciones donde LCDM es origen (deQuienTipo === 'lcdm')
    positiveSum = transactions
      .filter(t => t.deQuienTipo === 'lcdm')
      .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
      
    // Negativos: transacciones donde LCDM es destino (paraQuienTipo === 'lcdm')  
    negativeSum = transactions
      .filter(t => t.paraQuienTipo === 'lcdm')
      .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
      
  } else if (accountType === 'postobon') {
    // Positivos: transacciones donde Postobón es origen (deQuienTipo === 'postobon')
    positiveSum = transactions
      .filter(t => t.deQuienTipo === 'postobon')
      .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
      
    // Negativos: transacciones donde Postobón es destino (paraQuienTipo === 'postobon')
    negativeSum = transactions
      .filter(t => t.paraQuienTipo === 'postobon')
      .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
  }

  // Balance total
  const totalValor = positiveSum - negativeSum;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-auto p-1 sm:p-6">
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
                onClick={onClose}
                className="h-8 px-2"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Advertencia si hay más de 100 transacciones */}
        {transactions.length > 100 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 mt-0.5">⚠️</div>
              <div>
                <h4 className="text-amber-800 font-medium text-sm mb-1">
                  Demasiadas transacciones para descargar ({transactions.length} transacciones)
                </h4>
                <p className="text-amber-700 text-sm">
                  La descarga de imagen está limitada a máximo 100 transacciones. Por favor, aplica filtros para reducir el número de transacciones antes de descargar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido de la imagen */}
        <div className="w-full overflow-x-auto bg-gray-50 rounded-lg p-2 sm:p-4">
          <div 
            ref={imageRef}
            className="bg-white p-2 rounded-lg mx-auto shadow-sm"
            style={{ 
              width: '435px',
              minWidth: '435px',
              maxWidth: '435px',
              fontSize: '11px', 
              lineHeight: '1.3' 
            }}
          >
            {/* Header del reporte */}
            <div className="text-center mb-1 border-b border-gray-200 pb-0.5">
              <div className="text-xs font-bold text-gray-800">{title}</div>
              <div className="text-[10px] text-gray-500">{subtitle}</div>
              <div className="text-[10px] text-gray-500">
                {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            </div>

            {/* Resumen con etiquetas */}
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
                  <div className="font-bold text-gray-800">({transactions.length})</div>
                </div>
              </div>
            </div>

            {/* Tabla de transacciones con anchos personalizados */}
            <div className="border border-gray-300 rounded">
              {/* Header de la tabla */}
              <div className="flex bg-blue-100 border-b border-gray-300">
                <div className="p-1 text-center text-[9px] font-bold text-blue-800 border-r border-gray-300" style={{ width: '60px', minWidth: '60px' }}>FECHA</div>
                <div className="p-1 text-center text-[9px] font-bold text-blue-800 border-r border-gray-300" style={{ width: '160px', minWidth: '160px' }}>CONCEPTO</div>
                <div className="p-1 text-center text-[9px] font-bold text-blue-800 border-r border-gray-300" style={{ width: '130px', minWidth: '130px' }}>COMENTARIOS</div>
                <div className="p-1 text-center text-[9px] font-bold text-blue-800" style={{ width: '85px', minWidth: '85px' }}>VALOR</div>
              </div>

              {/* Filas de transacciones */}
              {transactions.slice(0, 100).map((transaccion, index) => (
                <div key={index} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="p-1 text-center text-[8px] border-r border-gray-200" style={{ width: '60px', minWidth: '60px', verticalAlign: 'middle' }}>
                    {formatDateCompact(transaccion.fecha)}
                  </div>
                  <div className="p-1 text-[8px] border-r border-gray-200" style={{ width: '160px', minWidth: '160px', verticalAlign: 'middle', lineHeight: '1.2' }}>
                    {transaccion.concepto && transaccion.concepto.includes('data:image') ? 
                      '[Imagen]' : 
                      (transaccion.concepto || 'Sin concepto')
                    }
                  </div>
                  <div className="p-1 text-[8px] border-r border-gray-200" style={{ width: '130px', minWidth: '130px', verticalAlign: 'middle', lineHeight: '1.2', wordBreak: 'break-word' }}>
                    {transaccion.comentario || '-'}
                  </div>
                  <div className="p-1 text-left text-[8px] font-medium" style={{ 
                    width: '85px', 
                    minWidth: '85px', 
                    verticalAlign: 'middle',
                    textAlign: 'left',
                    paddingLeft: '8px'
                  }}>
                    <span className={`${
                      accountType === 'postobon' 
                        ? (transaccion.paraQuienTipo === 'postobon' ? 'text-red-600' : 'text-green-600')
                        : accountType === 'lcdm' 
                        ? (transaccion.paraQuienTipo === 'lcdm' ? 'text-red-600' : 'text-green-600')
                        : 'text-gray-600'
                    }`}>
                      {(() => {
                        const valor = parseFloat(transaccion.valor || '0');
                        if (accountType === 'postobon') {
                          return transaccion.paraQuienTipo === 'postobon' ? 
                            `-$${valor.toLocaleString()}` : 
                            `+$${valor.toLocaleString()}`;
                        } else if (accountType === 'lcdm') {
                          return transaccion.paraQuienTipo === 'lcdm' ? 
                            `-$${valor.toLocaleString()}` : 
                            `+$${valor.toLocaleString()}`;
                        }
                        return `$${valor.toLocaleString()}`;
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}