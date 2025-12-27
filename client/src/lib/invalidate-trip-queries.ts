import { QueryClient } from "@tanstack/react-query";

/**
 * Información del viaje antes y después de la edición para invalidar queries específicas
 */
export interface TripChangeInfo {
  // IDs de socios ANTES de la edición
  oldMinaId?: number | null;
  oldCompradorId?: number | null;
  oldConductor?: string | null;
  
  // IDs de socios DESPUÉS de la edición
  newMinaId?: number | null;
  newCompradorId?: number | null;
  newConductor?: string | null;
}

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
 * - Refetch explícito de balances y queries específicas de socios involucrados
 * - Refetch siempre de balances críticos (no solo si están activas)
 */
export function invalidateTripRelatedQueries(
  queryClient: QueryClient,
  tripChangeInfo?: TripChangeInfo
) {
  // Invalidar todas las queries de viajes (incluyendo endpoints específicos por socio)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.startsWith("/api/viajes");
    }
  });
  
  // Invalidar queries específicas de viajes por socio (para actualizar transacciones dinámicas)
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      // Invalidar queries de viajes por mina (múltiples formatos)
      if (typeof key === 'string' && key.match(/^\/api\/minas\/\d+\/viajes$/)) return true;
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
      // Formato string directo: ["/api/transacciones/socio/mina/${minaId}"] o ["/api/transacciones/socio/mina/${minaId}/all"]
      if (typeof key === 'string' && key.match(/^\/api\/transacciones\/socio\/mina\/\d+(\/all)?$/)) return true;
      // Formato array: ["/api/transacciones/socio/mina", minaId]
      if (key === "/api/transacciones/socio/mina" && query.queryKey[1]) return true;
      if (key === "/api/transacciones/socio/volquetero" && query.queryKey[1]) return true;
      return false;
    }
  });
  
  // Invalidar balances (siempre, no solo si están activas)
  queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
  
  // Invalidar listados de socios (para actualizar contadores de viajes en las tarjetas)
  queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
  queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
  queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
  
  // Si tenemos información del viaje, invalidar y refetchear queries específicas de socios involucrados
  if (tripChangeInfo) {
    const minasAfectadas = new Set<number>();
    const compradoresAfectados = new Set<number>();
    const conductoresAfectados = new Set<string>();
    
    // Agregar socios anteriores (si el viaje cambió de socio)
    if (tripChangeInfo.oldMinaId) minasAfectadas.add(tripChangeInfo.oldMinaId);
    if (tripChangeInfo.oldCompradorId) compradoresAfectados.add(tripChangeInfo.oldCompradorId);
    if (tripChangeInfo.oldConductor) conductoresAfectados.add(tripChangeInfo.oldConductor);
    
    // Agregar socios nuevos
    if (tripChangeInfo.newMinaId) minasAfectadas.add(tripChangeInfo.newMinaId);
    if (tripChangeInfo.newCompradorId) compradoresAfectados.add(tripChangeInfo.newCompradorId);
    if (tripChangeInfo.newConductor) conductoresAfectados.add(tripChangeInfo.newConductor);
    
    // Invalidar y refetchear queries específicas de minas afectadas
    minasAfectadas.forEach(minaId => {
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}/viajes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}/viajes`, "includeHidden"] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}/all`] });
      
      // Refetchear explícitamente (sin importar si están activas)
      queryClient.refetchQueries({ queryKey: [`/api/minas/${minaId}/viajes`] });
      queryClient.refetchQueries({ queryKey: [`/api/minas/${minaId}/viajes`, "includeHidden"] });
      queryClient.refetchQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.refetchQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}/all`] });
    });
    
    // Invalidar y refetchear queries específicas de compradores afectados
    compradoresAfectados.forEach(compradorId => {
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/comprador", compradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"] });
      
      // Refetchear explícitamente
      queryClient.refetchQueries({ queryKey: ["/api/viajes/comprador", compradorId] });
      queryClient.refetchQueries({ queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"] });
    });
    
    // Para volqueteros, cuando cambia el conductor, necesitamos refetchear la lista completa
    // porque el conteo de viajes se calcula agrupando por nombre de conductor
    if (conductoresAfectados.size > 0) {
      // Refetchear explícitamente la lista de volqueteros para actualizar el conteo
      queryClient.refetchQueries({ queryKey: ["/api/volqueteros"] });
    }
  }
  
  // Refetch SIEMPRE de balances (críticos para tarjetas y encabezados)
  // No usar predicado de isActive - siempre refetchear balances
  queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] });
  queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] });
  queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] });
  
  // Refetch explícito de /api/volqueteros si cambió algún conductor (para actualizar conteo en tarjetas)
  // Esto asegura que el conteo de viajes se actualice inmediatamente
  if (tripChangeInfo && (tripChangeInfo.oldConductor || tripChangeInfo.newConductor)) {
    queryClient.refetchQueries({ queryKey: ["/api/volqueteros"] });
  }
  
  // Refetch de queries activas de viajes y transacciones (para actualización en tiempo real)
  queryClient.refetchQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      const isActive = query.state.status === 'success' && query.observers.length > 0;
      
      if (!isActive) return false;
      
      // Refetch queries de viajes activas (para actualizar listados y pestañas)
      if (key?.startsWith("/api/viajes")) {
        return true;
      }
      
      // Refetch queries de transacciones activas (para actualizar pestañas de transacciones)
      if (key?.startsWith("/api/transacciones") && query.observers.length > 0) {
        return true;
      }
      
      // Refetch queries específicas de viajes por mina activas
      if (key?.startsWith("/api/minas")) {
        if (typeof key === 'string' && key.match(/^\/api\/minas\/\d+\/viajes$/)) {
          return true;
        }
        if (typeof key === 'string' && key.match(/^\/api\/minas\/\d+\/viajes$/) && query.queryKey[1] === "includeHidden") {
          return true;
        }
        if (query.queryKey[1] && query.queryKey[2] === "viajes") {
          return true;
        }
      }
      
      // Refetch queries específicas de transacciones por mina activas
      if (typeof key === 'string') {
        if (key.match(/^\/api\/transacciones\/socio\/mina\/\d+$/)) {
          return true;
        }
        if (key.match(/^\/api\/transacciones\/socio\/mina\/\d+\/all$/)) {
          return true;
        }
      }
      if (key === "/api/transacciones/socio/mina" && query.queryKey[1]) {
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
