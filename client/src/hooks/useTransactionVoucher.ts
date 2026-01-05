import { useState, useEffect } from 'react';
import { useVouchers } from './useVouchers';

/**
 * Hook para cargar y obtener vouchers de transacciones
 * 
 * Este hook centraliza la lógica de carga de vouchers que estaba duplicada
 * en múltiples componentes. Automáticamente carga el voucher si no está en cache
 * y devuelve el estado de carga.
 * 
 * @param transactionId - ID de la transacción (debe ser numérico para transacciones manuales)
 * @returns Objeto con el voucher cargado y el estado de carga
 * 
 * @example
 * ```tsx
 * const { voucher, isLoading } = useTransactionVoucher(transactionId);
 * 
 * if (isLoading) return <Loading />;
 * if (voucher) return <img src={voucher} />;
 * ```
 */
export function useTransactionVoucher(transactionId: number | undefined | string) {
  const { loadVoucher, getVoucherFromCache, isVoucherLoaded, isVoucherLoading } = useVouchers();
  const [voucher, setVoucher] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Solo procesar si el ID es un número (transacciones manuales)
    // Ignorar IDs de tipo string (como 'viaje-123' para transacciones de viaje)
    if (!transactionId || typeof transactionId !== 'number') {
      setVoucher(null);
      setIsLoading(false);
      return;
    }

    // Si ya está cargado en cache, obtenerlo inmediatamente
    if (isVoucherLoaded(transactionId)) {
      const cachedVoucher = getVoucherFromCache(transactionId);
      setVoucher(cachedVoucher);
      setIsLoading(false);
      return;
    }

    // Si ya se está cargando, solo actualizar el estado de carga
    if (isVoucherLoading(transactionId)) {
      setIsLoading(true);
      return;
    }

    // Cargar el voucher desde el servidor
    setIsLoading(true);
    loadVoucher(transactionId)
      .then(() => {
        const loadedVoucher = getVoucherFromCache(transactionId);
        setVoucher(loadedVoucher);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading voucher:', error);
        setVoucher(null);
        setIsLoading(false);
      });
  }, [transactionId, loadVoucher, getVoucherFromCache, isVoucherLoaded, isVoucherLoading]);

  return { voucher, isLoading };
}

