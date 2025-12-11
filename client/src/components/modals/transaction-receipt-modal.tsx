import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, X } from "lucide-react";
import type { TransaccionWithSocio } from "@shared/schema";
import type { Mina, Comprador, Volquetero } from "@shared/schema";

interface TransactionReceiptModalProps {
  open: boolean;
  onClose: () => void;
  transaction: TransaccionWithSocio;
  socioDestinoNombre: string; // Solo el nombre, sin tipo
  minas?: Mina[];
  compradores?: Comprador[];
  volqueteros?: Volquetero[];
}

export function TransactionReceiptModal({
  open,
  onClose,
  transaction,
  socioDestinoNombre,
}: TransactionReceiptModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Validar que transaction existe y tiene los datos necesarios
  if (!transaction || !transaction.paraQuienTipo) {
    return null;
  }

  // Extraer imagen del voucher (limpiar prefijos si existen)
  const getVoucherImage = (): string | null => {
    if (!transaction.voucher) return null;
    
    let cleanVoucher = transaction.voucher;
    
    // Remover prefijo "IMAGE:" si existe
    if (cleanVoucher.startsWith('IMAGE:')) {
      cleanVoucher = cleanVoucher.substring(6);
    }
    
    // Remover cualquier prefijo de pipe encoded o normal
    if (cleanVoucher.startsWith('%7CIMAGE:')) {
      cleanVoucher = cleanVoucher.substring(8);
    } else if (cleanVoucher.startsWith('|IMAGE:')) {
      cleanVoucher = cleanVoucher.substring(7);
    }
    
    // Verificar si es una imagen válida
    if (cleanVoucher.startsWith('data:image') || cleanVoucher.startsWith('http')) {
      return cleanVoucher;
    }
    
    return null;
  };

  const voucherImage = getVoucherImage();

  // Formatear valor como moneda
  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  // Formatear fecha con día de la semana (ej: "Lun. 25 Nov 2025")
  const formatDate = (date: string | Date): string => {
    let dateObj: Date;
    
    // Extraer siempre la parte de fecha (YYYY-MM-DD) sin importar el formato
    let dateString: string;
    if (typeof date === 'string') {
      // Si es string ISO (ej: "2025-07-02T00:00:00.000Z"), extraer solo la parte de fecha
      dateString = date.includes('T') ? date.split('T')[0] : date;
    } else {
      // Si ya es Date, extraer componentes usando UTC para evitar problemas de zona horaria
      // Usar UTC para obtener la fecha correcta sin importar la zona horaria local
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      dateString = `${year}-${month}-${day}`;
    }
    
    // Crear fecha en mediodía local usando solo la parte de fecha extraída
    const [year, month, day] = dateString.split('-').map(Number);
    dateObj = new Date(year, month - 1, day, 12, 0, 0);
    
    // Días de la semana abreviados
    const diasSemana = ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'];
    // Meses abreviados
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const diaSemana = diasSemana[dateObj.getDay()];
    const dia = dateObj.getDate();
    const mes = meses[dateObj.getMonth()];
    const año = dateObj.getFullYear();
    
    return `${diaSemana} ${dia} ${mes} ${año}`;
  };

  // Generar imagen del comprobante usando Canvas
  const generateReceiptImage = async (): Promise<File> => {
    if (!receiptRef.current) {
      throw new Error('No se pudo generar el comprobante');
    }

    setIsGenerating(true);

    try {
      // Usar html2canvas para capturar el div del comprobante
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Mayor resolución para mejor calidad
        logging: false,
        useCORS: true,
      });

      // Convertir canvas a blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al generar la imagen'));
              return;
            }
            const file = new File([blob], `comprobante-${transaction.id}.png`, {
              type: 'image/png',
            });
            resolve(file);
          },
          'image/png',
          0.95 // Alta calidad
        );
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Compartir comprobante usando Web Share API
  const handleShare = async () => {
    try {
      const file = await generateReceiptImage();

      // Verificar si Web Share API está disponible
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Comprobante - ${socioDestinoNombre}`,
          text: `Comprobante de transacción para ${socioDestinoNombre}`,
        });
      } else {
        // Fallback: descargar la imagen
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-${transaction.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      // Si el usuario cancela, no mostrar error
      if (error.name !== 'AbortError') {
        console.error('Error al compartir:', error);
        alert('Error al compartir el comprobante. Inténtalo de nuevo.');
      }
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[450px] max-w-[90vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg">
              ¿Compartir comprobante a {socioDestinoNombre}?
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 sm:h-8 sm:w-8">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Comprobante - Este es el que se capturará como imagen */}
        <div ref={receiptRef} className="bg-gradient-to-br from-blue-50 via-white to-green-50 p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3 md:space-y-4 border-2 sm:border-2 md:border-4 border-blue-300 rounded-lg sm:rounded-xl shadow-xl sm:shadow-2xl">
          {/* Arriba: Nombre, Valor, Fecha */}
          <div className="space-y-2 sm:space-y-3 border-b-2 border-blue-200 pb-3 sm:pb-4 bg-white/50 rounded-lg p-2 sm:p-3 md:p-4">
            <div className="text-base sm:text-lg md:text-xl font-bold text-blue-700">
              {socioDestinoNombre}
            </div>
            <div className="flex justify-between items-center gap-2">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-600">
                {formatCurrency(transaction.valor)}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-blue-600 bg-blue-100 px-2.5 sm:px-3 md:px-3.5 py-1 sm:py-1.5 rounded-full border border-blue-300 whitespace-nowrap flex-shrink-0">
                {formatDate(transaction.fecha)}
              </div>
            </div>
          </div>

          {/* Voucher como protagonista */}
          {voucherImage ? (
            <div className="flex justify-center bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 border-2 sm:border-2 md:border-4 border-green-300 shadow-md sm:shadow-lg">
              <img
                src={voucherImage}
                alt="Voucher"
                className="max-w-full h-auto rounded-md sm:rounded-lg"
                style={{ maxHeight: 'clamp(250px, 30vh, 400px)' }}
              />
            </div>
          ) : (
            <div className="flex justify-center items-center h-32 sm:h-40 md:h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg sm:rounded-xl border-2 border-dashed border-gray-300">
              <span className="text-gray-500 text-xs sm:text-sm font-medium">Sin voucher adjunto</span>
            </div>
          )}

          {/* Debajo: Comentarios y Detalle (texto pequeño, sin tarjetas grandes) */}
          {(transaction.comentario && transaction.comentario.trim()) || 
           ((transaction as any).detalle_solicitud && (transaction as any).detalle_solicitud.trim()) ||
           ((transaction as any).origenDetalle && (transaction as any).origenDetalle.trim()) ||
           ((transaction as any).destinoDetalle && (transaction as any).destinoDetalle.trim()) ? (
            <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t-2 border-gray-200 bg-white/30 rounded-lg p-2 sm:p-2.5 md:p-3">
              {transaction.comentario && transaction.comentario.trim() && (
                <div className="text-xs text-gray-700">
                  <span className="font-semibold text-blue-600">Comentario:</span> {transaction.comentario}
                </div>
              )}
              {(transaction as any).detalle_solicitud && (transaction as any).detalle_solicitud.trim() && (
                <div className="text-xs text-gray-700">
                  <span className="font-semibold text-green-600">Detalle:</span> {(transaction as any).detalle_solicitud}
                </div>
              )}
              {(transaction as any).origenDetalle && (transaction as any).origenDetalle.trim() && (
                <div className="text-xs text-gray-700">
                  <span className="font-semibold text-purple-600">Origen:</span> {(transaction as any).origenDetalle}
                </div>
              )}
              {(transaction as any).destinoDetalle && (transaction as any).destinoDetalle.trim() && (
                <div className="text-xs text-gray-700">
                  <span className="font-semibold text-orange-600">Destino:</span> {(transaction as any).destinoDetalle}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Botón de compartir */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4 border-t">
          <Button
            onClick={handleShare}
            disabled={isGenerating}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base"
            size="default"
          >
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {isGenerating ? 'Generando...' : 'Compartir Comprobante'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

