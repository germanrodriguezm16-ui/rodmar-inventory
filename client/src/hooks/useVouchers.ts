import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface VoucherCache {
  [transactionId: number]: string | null;
}

export function useVouchers() {
  const [loadedVouchers, setLoadedVouchers] = useState<VoucherCache>({});
  const [loadingVouchers, setLoadingVouchers] = useState<Set<number>>(new Set());

  const loadVoucher = useCallback(async (transactionId: number): Promise<string | null> => {
    // Si ya está cargado, devolverlo inmediatamente
    if (transactionId in loadedVouchers) {
      return loadedVouchers[transactionId];
    }

    // Si ya se está cargando, devolver null
    if (loadingVouchers.has(transactionId)) {
      return null;
    }

    // Marcar como cargándose
    setLoadingVouchers(prev => new Set(prev).add(transactionId));

    try {
      const response = await fetch(`/api/transacciones/${transactionId}/voucher`);
      if (!response.ok) {
        throw new Error('Failed to load voucher');
      }
      
      const data = await response.json();
      const voucher = data.voucher;

      // Guardar en cache
      setLoadedVouchers(prev => ({
        ...prev,
        [transactionId]: voucher
      }));

      return voucher;
    } catch (error) {
      console.error('Error loading voucher:', error);
      return null;
    } finally {
      // Remover del estado de carga
      setLoadingVouchers(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  }, [loadedVouchers, loadingVouchers]);

  const getVoucherFromCache = useCallback((transactionId: number): string | null => {
    return loadedVouchers[transactionId] ?? null;
  }, [loadedVouchers]);

  const isVoucherLoading = useCallback((transactionId: number): boolean => {
    return loadingVouchers.has(transactionId);
  }, [loadingVouchers]);

  const isVoucherLoaded = useCallback((transactionId: number): boolean => {
    return transactionId in loadedVouchers;
  }, [loadedVouchers]);

  return {
    loadVoucher,
    getVoucherFromCache,
    isVoucherLoading,
    isVoucherLoaded
  };
}