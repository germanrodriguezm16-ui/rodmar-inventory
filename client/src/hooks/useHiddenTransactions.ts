import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para manejar transacciones ocultas de forma temporal y local.
 * Las transacciones ocultas solo afectan al usuario actual y se limpian
 * al cambiar de pestaña, página o módulo.
 */
export function useHiddenTransactions(moduleKey: string) {
  // Estado en memoria: se reinicia al refrescar o cambiar de página/pestaña
  const [hiddenTransactions, setHiddenTransactions] = useState<Set<string>>(() => {
    return new Set<string>();
  });

  // Función para ocultar una transacción
  const hideTransaction = useCallback((transactionId: string | number) => {
    const normalizedId = String(transactionId);
    setHiddenTransactions(prev => {
      const newSet = new Set(prev);
      newSet.add(normalizedId);
      return newSet;
    });
  }, []);

  // Función para mostrar una transacción
  const showTransaction = useCallback((transactionId: string | number) => {
    const normalizedId = String(transactionId);
    setHiddenTransactions(prev => {
      const newSet = new Set(prev);
      newSet.delete(normalizedId);
      return newSet;
    });
  }, []);

  // Función para mostrar todas las transacciones ocultas
  const showAllHidden = useCallback(() => {
    setHiddenTransactions(new Set());
  }, []);

  // Función para verificar si una transacción está oculta
  const isHidden = useCallback((transactionId: string | number) => {
    return hiddenTransactions.has(String(transactionId));
  }, [hiddenTransactions]);

  // Función para obtener el conteo de transacciones ocultas
  const getHiddenCount = useCallback(() => {
    return hiddenTransactions.size;
  }, [hiddenTransactions]);

  // Función para filtrar transacciones (excluir las ocultas)
  const filterVisible = useCallback(<T extends { id: string | number }>(transactions: T[]): T[] => {
    return transactions.filter(t => !hiddenTransactions.has(String(t.id)));
  }, [hiddenTransactions]);

  return {
    hiddenTransactions,
    hideTransaction,
    showTransaction,
    showAllHidden,
    isHidden,
    getHiddenCount,
    filterVisible,
  };
}

















