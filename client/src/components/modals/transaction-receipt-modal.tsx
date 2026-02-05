import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, X } from "lucide-react";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
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
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [preloadedImageUrl, setPreloadedImageUrl] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const imagePreloadRef = useRef<HTMLImageElement | null>(null);

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

  // Pre-cargar la imagen en memoria tan pronto como se detecta el voucher
  useEffect(() => {
    if (!voucherImage || !open) {
      setIsImageLoaded(false);
      setPreloadedImageUrl(null);
      return;
    }

    // Limpiar imagen anterior si existe
    if (imagePreloadRef.current) {
      imagePreloadRef.current.onload = null;
      imagePreloadRef.current.onerror = null;
      imagePreloadRef.current = null;
    }

    // Resetear estado
    setIsImageLoaded(false);

    // Crear imagen en memoria para pre-cargar
    const img = new Image();
    img.onload = () => {
      setIsImageLoaded(true);
      setPreloadedImageUrl(voucherImage);
    };
    img.onerror = () => {
      console.warn('Error pre-cargando imagen del voucher');
      setIsImageLoaded(true); // Permitir continuar aunque haya error
      setPreloadedImageUrl(voucherImage);
    };
    img.src = voucherImage;
    imagePreloadRef.current = img;

    // Cleanup
    return () => {
      if (imagePreloadRef.current) {
        imagePreloadRef.current.onload = null;
        imagePreloadRef.current.onerror = null;
        imagePreloadRef.current = null;
      }
    };
  }, [voucherImage, open]);

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
  // Usar formatDateWithDaySpanish y convertir formato de "Lun. 25/11/2025" a "Lun. 25 Nov 2025"
  const formatDate = (date: string | Date): string => {
    // Usar la función que ya funciona correctamente
    const formatted = formatDateWithDaySpanish(date);
    // Convertir formato de "Lun. 25/11/2025" a "Lun. 25 Nov 2025"
    const match = formatted.match(/^(\w+\.)\s+(\d+)\/(\d+)\/(\d+)$/);
    if (match) {
      const [, diaSemana, dia, mesNum, año] = match;
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const mes = meses[parseInt(mesNum) - 1];
      return `${diaSemana} ${dia} ${mes} ${año}`;
    }
    return formatted;
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
      
      // Calcular scale dinámicamente para pantallas Retina y alta resolución
      // Usar devicePixelRatio para pantallas de alta densidad, mínimo 3 para buena calidad
      const deviceScale = window.devicePixelRatio || 1;
      const scale = Math.max(3, deviceScale * 2);
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: scale, // Alta resolución para mejor calidad (3x o más en pantallas Retina)
        logging: false,
        useCORS: true,
        allowTaint: false,
      });

      // Limitar ancho máximo a 2000px para evitar archivos muy grandes
      // pero mantener alta calidad
      const maxWidth = 2000;
      let finalCanvas = canvas;
      if (canvas.width > maxWidth) {
        const ratio = maxWidth / canvas.width;
        const newHeight = canvas.height * ratio;
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = maxWidth;
        finalCanvas.height = newHeight;
        const ctx = finalCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, maxWidth, newHeight);
        }
      }

      // Convertir canvas a blob en formato JPEG para mejor compatibilidad con WhatsApp
      return new Promise((resolve, reject) => {
        finalCanvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al generar la imagen'));
              return;
            }
            const file = new File([blob], `comprobante-${transaction.id}.jpg`, {
              type: 'image/jpeg',
            });
            resolve(file);
          },
          'image/jpeg',
          0.92 // Alta calidad JPEG (92%) - mejor balance calidad/tamaño para WhatsApp
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
        <div ref={receiptRef} className="relative bg-gradient-to-br from-blue-50 via-white to-green-50 p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3 md:space-y-4 border-2 sm:border-2 md:border-4 border-blue-300 rounded-lg sm:rounded-xl shadow-xl sm:shadow-2xl">
          {/* Arriba: Nombre, Valor */}
          <div className="space-y-2 sm:space-y-3 border-b-2 border-blue-200 pb-3 sm:pb-4 bg-white/50 rounded-lg p-2 sm:p-3 md:p-4">
            <div className="text-base sm:text-lg md:text-xl font-bold text-blue-700">
              {socioDestinoNombre}
            </div>
            <div className="grid grid-cols-3 items-center gap-2">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-600 text-left">
                {formatCurrency(transaction.valor)}
              </div>
              {/* Marca de agua RM en el centro */}
              <div className="flex items-center justify-center">
                <svg 
                  className="text-lg sm:text-xl md:text-2xl font-black"
                  width="60" 
                  height="32" 
                  viewBox="0 0 60 32"
                  style={{ letterSpacing: '-0.05em' }}
                >
                  <defs>
                    <linearGradient id="rmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1d4ed8" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <text
                    x="30"
                    y="22"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="url(#rmGradient)"
                    fontSize="24"
                    fontWeight="900"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ 
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                      letterSpacing: '-0.05em'
                    }}
                  >
                    RM
                  </text>
                </svg>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-emerald-600 text-right">
                {formatDate(transaction.fecha)}
              </div>
            </div>
          </div>

          {/* Voucher como protagonista */}
          {voucherImage ? (
            <div className="flex justify-center bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 border-2 sm:border-2 md:border-4 border-green-300 shadow-md sm:shadow-lg">
              {!isImageLoaded ? (
                <div className="flex items-center justify-center h-32 sm:h-40 md:h-48">
                  <div className="text-sm text-gray-500">Cargando imagen...</div>
                </div>
              ) : (
                <img
                  src={preloadedImageUrl || voucherImage}
                  alt="Voucher"
                  className="max-w-full h-auto rounded-md sm:rounded-lg"
                  style={{ maxHeight: 'clamp(250px, 30vh, 400px)' }}
                  onLoad={() => setIsImageLoaded(true)}
                />
              )}
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

          {/* Footer con marca de agua RodMar */}
          <div className="pt-2 sm:pt-3 border-t border-gray-200/50">
            <div className="flex items-center justify-center text-[10px] sm:text-xs text-gray-400">
              <span>Generado desde <span className="font-semibold text-gray-500">RodMar</span></span>
            </div>
          </div>
        </div>

        {/* Botón de compartir */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4 border-t">
          <Button
            onClick={handleShare}
            disabled={isGenerating || (voucherImage && !isImageLoaded)}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            size="default"
          >
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {isGenerating 
              ? 'Generando...' 
              : (voucherImage && !isImageLoaded)
                ? 'Cargando imagen...'
                : 'Compartir Comprobante'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

