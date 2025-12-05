import { QueryClient } from "@tanstack/react-query";

/**
 * Función optimizada para invalidar todas las queries relacionadas con viajes
 * cuando se completa o edita un viaje. Esto actualiza:
 * - Transacciones dinámicas de viajes en minas, volqueteros y compradores
 * - Balances de socios y módulos (tarjetas y encabezados)
 * - Listados de viajes en las pestañas
 * - Pestañas de transacciones de los socios involucrados
 * 
 * Optimizaciones:
 * - Usa predicados para invalidar solo queries relevantes
 * - Agrupa invalidaciones para evitar múltiples re-renders
 * - Solo refetch queries activas (visible en pantalla)
 * - Refetch inmediato de balances para actualización en tiempo real
 */
export function invalidateTripRelatedQueries(queryClient: QueryClient) {
  // Invalidar todas las queries de viajes (incluyendo endpoints específicos por socio)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      // Invalidar todas las queries que empiezan con /api/viajes
      // Esto incluye: /api/viajes, /api/viajes/comprador/:id, /api/minas/:id/viajes, /api/volqueteros/:id/viajes
      return key?.startsWith("/api/viajes");
    }
  });
  
  // Invalidar queries específicas de viajes por socio (para actualizar transacciones dinámicas)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      // Invalidar queries de viajes por mina
      if (key?.startsWith("/api/minas") && query.queryKey[1] && query.queryKey[2] === "viajes") return true;
      // Invalidar queries de viajes por comprador
      if (key === "/api/viajes/comprador" && query.queryKey[1]) return true;
      // Invalidar queries de viajes por volquetero
      if (key?.startsWith("/api/volqueteros") && query.queryKey[1] && query.queryKey[2] === "viajes") return true;
      return false;
    }
  });
  
  // Invalidar queries de transacciones (solo las que pueden contener transacciones dinámicas de viajes)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      // Invalidar queries de transacciones por socio (minas, compradores, volqueteros)
      if (key?.startsWith("/api/transacciones")) return true;
      if (key?.startsWith("/api/volqueteros") && query.queryKey[1] && query.queryKey[2] === "transacciones") return true;
      if (key?.startsWith("/api/compradores") && query.queryKey[1] && query.queryKey[2] === "transacciones") return true;
      if (key?.startsWith("/api/minas") && query.queryKey[1] && query.queryKey[2] === "transacciones") return true;
      // Invalidar queries específicas de transacciones por socio
      if (key === "/api/transacciones/comprador" && query.queryKey[1]) return true;
      if (key === "/api/transacciones/socio/mina" && query.queryKey[1]) return true;
      if (key === "/api/transacciones/socio/volquetero" && query.queryKey[1]) return true;
      return false;
    }
  });
  
  // Invalidar balances y hacer refetch inmediato solo de queries activas
  // Esto actualiza las tarjetas y encabezados de los listados
  queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
  
  // Invalidar listados de socios (para actualizar contadores de viajes en las tarjetas)
  queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
  queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
  
  // Refetch inmediato solo de queries activas (visible en pantalla) para actualización en tiempo real
  // Esto es más eficiente que refetch todas las queries y mantiene la responsividad
  queryClient.refetchQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      const isActive = query.state.status === 'success' && query.observers.length > 0;
      
      if (!isActive) return false;
      
      // Refetch balances activos (para actualizar tarjetas y encabezados inmediatamente)
      if (key === "/api/balances/minas" || key === "/api/balances/compradores" || key === "/api/balances/volqueteros") {
        return true;
      }
      
      // Refetch queries de viajes activas (para actualizar listados y pestañas)
      if (key?.startsWith("/api/viajes")) {
        return true;
      }
      
      // Refetch queries de transacciones activas (para actualizar pestañas de transacciones)
      if (key?.startsWith("/api/transacciones") && query.observers.length > 0) {
        return true;
      }
      
      // Refetch queries específicas de viajes por mina activas
      // Formato: ["/api/minas", minaId, "viajes"] o ["/api/minas/${minaId}/viajes", "includeHidden"]
      if (key?.startsWith("/api/minas")) {
        // Query de viajes de mina específica
        if (query.queryKey[1] && query.queryKey[2] === "viajes") {
          return true;
        }
        // Query de viajes de mina con includeHidden
        if (query.queryKey[0]?.toString().includes("/viajes") || query.queryKey[1] === "includeHidden") {
          return true;
        }
        // Query directa de viajes de mina: ["/api/minas/${minaId}/viajes"]
        if (query.queryKey[0]?.toString().match(/^\/api\/minas\/\d+\/viajes$/)) {
          return true;
        }
      }
      
      // Refetch queries específicas de transacciones por mina activas
      // Formato: ["/api/transacciones/socio/mina", minaId] o ["/api/transacciones/socio/mina/${minaId}/all"]
      if (key === "/api/transacciones/socio/mina" && query.queryKey[1]) {
        return true;
      }
      if (key?.startsWith("/api/transacciones/socio/mina/") && query.queryKey[1]) {
        return true;
      }
      
      // Refetch queries específicas de viajes por comprador activas
      if (key === "/api/viajes/comprador" && query.queryKey[1]) {
        return true;
      }
      
      // Refetch queries específicas de transacciones por comprador activas
      if (key === "/api/transacciones/comprador" && query.queryKey[1]) {
        return true;
      }
      
      // Refetch queries específicas de viajes por volquetero activas
      if (key?.startsWith("/api/volqueteros") && query.queryKey[1] && query.queryKey[2] === "viajes") {
        return true;
      }
      
      // Refetch queries específicas de transacciones por volquetero activas
      if (key?.startsWith("/api/volqueteros") && query.queryKey[1] && query.queryKey[2] === "transacciones") {
        return true;
      }
      if (key === "/api/transacciones/socio/volquetero" && query.queryKey[1]) {
        return true;
      }
      
      return false;
    },
    type: 'active' // Solo queries activas
  });
}
