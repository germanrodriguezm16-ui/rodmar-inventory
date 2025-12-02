import { useState, useEffect } from "react";

interface UsePaginationOptions {
  storageKey: string;
  defaultPageSize?: number;
  defaultPage?: number;
}

export function usePagination({
  storageKey,
  defaultPageSize = 50,
  defaultPage = 1,
}: UsePaginationOptions) {
  // Cargar pageSize desde localStorage al inicializar
  const [pageSize, setPageSizeState] = useState<number | "todo">(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed === "todo" ? "todo" : (parsed || defaultPageSize);
      }
    } catch (error) {
      console.error(`Error loading pagination from localStorage (${storageKey}):`, error);
    }
    return defaultPageSize;
  });

  const [currentPage, setCurrentPage] = useState(defaultPage);

  // Guardar en localStorage cuando cambie pageSize
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pageSize));
    } catch (error) {
      console.error(`Error saving pagination to localStorage (${storageKey}):`, error);
    }
  }, [pageSize, storageKey]);

  // Resetear a página 1 cuando cambie pageSize
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const setPageSize = (newSize: number | "todo") => {
    setPageSizeState(newSize);
  };

  // Obtener el límite numérico para enviar al servidor
  const getLimitForServer = (total?: number): number => {
    if (pageSize === "todo") {
      // Si es "todo", usar un número muy grande o el total si está disponible
      return total ? total : 999999;
    }
    return pageSize;
  };

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    getLimitForServer,
  };
}

