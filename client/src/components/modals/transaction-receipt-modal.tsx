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

  // Formatear fecha
  const formatDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj);
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
      <DialogContent className="sm:max-w-[500px] max-w-[90vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              ¿Compartir comprobante a {socioDestinoNombre}?
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Comprobante - Este es el que se capturará como imagen */}
        <div ref={receiptRef} className="bg-white p-6 space-y-4">
          {/* Arriba: Nombre, Valor, Fecha */}
          <div className="space-y-2 border-b pb-4">
            <div className="text-lg font-semibold text-gray-900">
              {socioDestinoNombre}
            </div>
            <div className="flex justify-between items-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(transaction.valor)}
              </div>
              <div className="text-sm text-gray-600">
                {formatDate(transaction.fecha)}
              </div>
            </div>
          </div>

          {/* Voucher como protagonista */}
          {voucherImage ? (
            <div className="flex justify-center">
              <img
                src={voucherImage}
                alt="Voucher"
                className="max-w-full h-auto rounded-lg shadow-md"
                style={{ maxHeight: '400px' }}
              />
            </div>
          ) : (
            <div className="flex justify-center items-center h-48 bg-gray-100 rounded-lg">
              <span className="text-gray-400 text-sm">Sin voucher adjunto</span>
            </div>
          )}

          {/* Debajo: Comentarios y Detalle (texto pequeño, sin tarjetas grandes) */}
          <div className="space-y-2 pt-4 border-t">
            {transaction.comentario && transaction.comentario.trim() && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Comentario:</span> {transaction.comentario}
              </div>
            )}
            {(transaction as any).detalle_solicitud && (transaction as any).detalle_solicitud.trim() && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Detalle:</span> {(transaction as any).detalle_solicitud}
              </div>
            )}
            {(transaction as any).origenDetalle && (transaction as any).origenDetalle.trim() && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Origen:</span> {(transaction as any).origenDetalle}
              </div>
            )}
            {(transaction as any).destinoDetalle && (transaction as any).destinoDetalle.trim() && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Destino:</span> {(transaction as any).destinoDetalle}
              </div>
            )}
          </div>
        </div>

        {/* Botón de compartir */}
        <div className="px-6 pb-6 pt-4 border-t">
          <Button
            onClick={handleShare}
            disabled={isGenerating}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <Share2 className="h-5 w-5 mr-2" />
            {isGenerating ? 'Generando...' : 'Compartir Comprobante'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

