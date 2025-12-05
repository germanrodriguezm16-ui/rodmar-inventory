import { QueryClient } from "@tanstack/react-query";

/**
 * Función optimizada para invalidar todas las queries relacionadas con viajes
 * cuando se completa o edita un viaje. Esto actualiza:
 * - Transacciones dinámicas de viajes en minas, volqueteros y compradores
 * - Balances de socios y módulos
 * - Listados de viajes en las pestañas
 * 
 * Optimizaciones:
 * - Usa predicados para invalidar solo queries relevantes
 * - Agrupa invalidaciones para evitar múltiples re-renders
 * - Solo refetch queries activas (visible en pantalla)
 */
export function invalidateTripRelatedQueries(queryClient: QueryClient) {
  // Invalidar todas las queries de viajes (incluyendo endpoints específicos)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.startsWith("/api/viajes");
    }
  });
  
  // Invalidar queries de transacciones (solo las que pueden contener transacciones dinámicas de viajes)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      // Invalidar queries de transacciones por socio (minas, compradores, volqueteros)
      return key?.startsWith("/api/transacciones") || 
             key?.startsWith("/api/volqueteros") && query.queryKey[1] && query.queryKey[2] === "transacciones" ||
             key?.startsWith("/api/compradores") && query.queryKey[1] && query.queryKey[2] === "transacciones" ||
             key?.startsWith("/api/minas") && query.queryKey[1] && query.queryKey[2] === "transacciones";
    }
  });
  
  // Invalidar balances (solo invalidar, no refetch - se refetcharán cuando se necesiten)
  queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
  
  // Invalidar listados de socios (para actualizar contadores de viajes)
  queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
  queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
  
  // Refetch solo queries activas (visible en pantalla) para actualización inmediata
  // Esto es más eficiente que refetch todas las queries
  queryClient.refetchQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      const isActive = query.state.status === 'success' && query.observers.length > 0;
      
      // Solo refetch queries activas relacionadas con viajes o balances
      return isActive && (
        key?.startsWith("/api/viajes") ||
        key?.startsWith("/api/balances") ||
        (key?.startsWith("/api/transacciones") && query.observers.length > 0)
      );
    },
    type: 'active' // Solo queries activas
  });
}

