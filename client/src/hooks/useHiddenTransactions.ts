import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para manejar transacciones ocultas de forma temporal y local.
 * Las transacciones ocultas solo afectan al usuario actual y se limpian
 * al cambiar de pestaña, página o módulo.
 */
export function useHiddenTransactions(moduleKey: string) {
  // Usar sessionStorage para persistir solo durante la sesión del navegador
  // Se limpia automáticamente al cerrar la pestaña
  const storageKey = `hidden_transactions_${moduleKey}`;
  
  // Inicializar desde sessionStorage o crear Set vacío
  const [hiddenTransactions, setHiddenTransactions] = useState<Set<number>>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        return new Set(ids);
      }
    } catch (error) {
      console.error('Error reading hidden transactions from sessionStorage:', error);
    }
    return new Set<number>();
  });

  // Sincronizar con sessionStorage cuando cambie el estado
  useEffect(() => {
    try {
      const ids = Array.from(hiddenTransactions);
      sessionStorage.setItem(storageKey, JSON.stringify(ids));
    } catch (error) {
      console.error('Error saving hidden transactions to sessionStorage:', error);
    }
  }, [hiddenTransactions, storageKey]);

  // Limpiar al cambiar de módulo/página
  useEffect(() => {
    return () => {
      // Cleanup: limpiar al desmontar el componente o cambiar de módulo
      try {
        sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Error clearing hidden transactions from sessionStorage:', error);
      }
    };
  }, [storageKey]);

  // Función para ocultar una transacción
  const hideTransaction = useCallback((transactionId: number) => {
    setHiddenTransactions(prev => {
      const newSet = new Set(prev);
      newSet.add(transactionId);
      return newSet;
    });
  }, []);

  // Función para mostrar una transacción
  const showTransaction = useCallback((transactionId: number) => {
    setHiddenTransactions(prev => {
      const newSet = new Set(prev);
      newSet.delete(transactionId);
      return newSet;
    });
  }, []);

  // Función para mostrar todas las transacciones ocultas
  const showAllHidden = useCallback(() => {
    setHiddenTransactions(new Set());
  }, []);

  // Función para verificar si una transacción está oculta
  const isHidden = useCallback((transactionId: number) => {
    return hiddenTransactions.has(transactionId);
  }, [hiddenTransactions]);

  // Función para obtener el conteo de transacciones ocultas
  const getHiddenCount = useCallback(() => {
    return hiddenTransactions.size;
  }, [hiddenTransactions]);

  // Función para filtrar transacciones (excluir las ocultas)
  const filterVisible = useCallback(<T extends { id: number }>(transactions: T[]): T[] => {
    return transactions.filter(t => !hiddenTransactions.has(t.id));
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

