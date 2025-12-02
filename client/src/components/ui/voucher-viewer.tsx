import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVouchers } from '@/hooks/useVouchers';

interface VoucherViewerProps {
  transactionId: number;
  hasVoucher?: boolean;
  className?: string;
}

export function VoucherViewer({ transactionId, hasVoucher = false, className = "" }: VoucherViewerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { loadVoucher, getVoucherFromCache, isVoucherLoading, isVoucherLoaded } = useVouchers();

  const handleToggleVoucher = async () => {
    if (!hasVoucher) return;

    if (!isVisible) {
      // Cargar voucher si no está cargado
      if (!isVoucherLoaded(transactionId)) {
        await loadVoucher(transactionId);
      }
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const rawVoucher = getVoucherFromCache(transactionId);
  const isLoading = isVoucherLoading(transactionId);

  // Procesar el voucher para remover prefijos
  const processVoucher = (voucherData: string | null): string | null => {
    if (!voucherData) return null;
    
    // Si tiene el prefijo |IMAGE:, removerlo
    if (voucherData.startsWith('|IMAGE:')) {
      return voucherData.substring(7); // Remover "|IMAGE:"
    }
    
    // Si ya es una imagen base64 válida, devolverla tal como está
    if (voucherData.startsWith('data:image/')) {
      return voucherData;
    }
    
    return voucherData;
  };

  const voucher = processVoucher(rawVoucher);

  if (!hasVoucher) {
    return null;
  }

  return (
    <div className={className}>
      {/* Botón del ojo */}
      <div className="flex justify-center mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleVoucher}
          disabled={isLoading}
          className="h-8 w-8 p-0 rounded-full bg-gray-100 hover:bg-gray-200"
          title={isVisible ? "Ocultar voucher" : "Ver voucher"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
          ) : isVisible ? (
            <EyeOff className="h-4 w-4 text-gray-600" />
          ) : (
            <Eye className="h-4 w-4 text-gray-600" />
          )}
        </Button>
      </div>
      
      {/* Imagen del voucher cuando está visible */}
      {isVisible && voucher && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <img 
            src={voucher} 
            alt="Voucher" 
            className="max-w-full h-auto rounded border border-gray-300 mx-auto block"
            style={{ maxHeight: '300px' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden text-center text-red-500 text-sm mt-2">
            ❌ Error al cargar la imagen del voucher
          </div>
        </div>
      )}
      
      {/* Mensaje cuando no hay voucher */}
      {isVisible && !voucher && !isLoading && (
        <div className="text-center text-gray-500 text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
          No hay voucher disponible para esta transacción
        </div>
      )}
    </div>
  );
}