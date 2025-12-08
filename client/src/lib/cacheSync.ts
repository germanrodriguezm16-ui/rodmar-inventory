/**
 * Sistema de sincronización de invalidaciones de caché vía Socket.io
 * Intercepta todas las invalidaciones y las sincroniza con otros clientes
 */

import type { QueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";

interface InvalidationOptions {
  queryKey?: readonly unknown[];
  predicate?: (query: any) => boolean;
  exact?: boolean;
  refetchType?: "active" | "inactive" | "all" | "none";
}

interface PendingInvalidation {
  options: InvalidationOptions;
  timestamp: number;
}

export function setupCacheSync(queryClient: QueryClient, socket: Socket | null) {
  if (!socket) {
    console.warn("⚠️ Socket.io no disponible, sincronización de caché deshabilitada");
    return;
  }

  // Cola de invalidaciones pendientes para debouncing
  const pendingInvalidations = new Map<string, PendingInvalidation>();
  let debounceTimer: NodeJS.Timeout | null = null;
  const DEBOUNCE_DELAY = 100; // Agrupar invalidaciones en 100ms

  // Cache de eventos recientes para evitar duplicados
  const recentEvents = new Map<string, number>();
  const DEDUPLICATION_WINDOW = 2000; // 2 segundos

  // Guardar referencia al método original
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);

  // Interceptar invalidaciones
  // @ts-ignore - Interceptamos el método para agregar funcionalidad
  queryClient.invalidateQueries = function(options: InvalidationOptions = {}) {
    // 1. Ejecutar invalidación normal (síncrono, rápido)
    const result = originalInvalidate(options);

    // 2. Agregar a cola de invalidaciones (para debouncing)
    const key = getInvalidationKey(options);
    pendingInvalidations.set(key, {
      options,
      timestamp: Date.now()
    });

    // 3. Debounce: agrupar invalidaciones en 100ms
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (socket && socket.connected && pendingInvalidations.size > 0) {
        // Agrupar todas las invalidaciones pendientes
        const invalidations = Array.from(pendingInvalidations.values());
        pendingInvalidations.clear();

        // Crear evento único para todas las invalidaciones
        const eventKey = invalidations.map(inv => getInvalidationKey(inv.options)).join('|');
        const now = Date.now();

        // Verificar si este evento ya se emitió recientemente (deduplicación)
        const lastEmitted = recentEvents.get(eventKey);
        if (lastEmitted && (now - lastEmitted) < DEDUPLICATION_WINDOW) {
          console.log("🔄 [CacheSync] Evento duplicado ignorado:", eventKey);
          return;
        }

        // Emitir evento Socket.io (asíncrono, no bloquea)
        socket.emit("cache-invalidate", {
          invalidations: invalidations.map(inv => ({
            queryKey: inv.options.queryKey,
            predicate: inv.options.predicate ? "predicate" : undefined, // No enviar la función, solo indicar que hay predicate
            exact: inv.options.exact,
            refetchType: inv.options.refetchType
          })),
          timestamp: now
        });

        // Guardar en cache de eventos recientes
        recentEvents.set(eventKey, now);

        // Limpiar cache de eventos antiguos (cada 10 segundos)
        if (recentEvents.size > 100) {
          const cutoff = now - DEDUPLICATION_WINDOW;
          for (const [key, time] of recentEvents.entries()) {
            if (time < cutoff) {
              recentEvents.delete(key);
            }
          }
        }

        console.log("📡 [CacheSync] Invalidaciones sincronizadas:", invalidations.length);
      }
    }, DEBOUNCE_DELAY);

    return result;
  };

  console.log("✅ [CacheSync] Sistema de sincronización de caché inicializado");
}

/**
 * Genera una clave única para una invalidación
 */
function getInvalidationKey(options: InvalidationOptions): string {
  if (options.queryKey) {
    return JSON.stringify(options.queryKey);
  }
  if (options.predicate) {
    return "predicate"; // Para predicates, usar una clave genérica
  }
  return "all";
}

/**
 * Configura el listener para recibir invalidaciones de otros clientes
 */
export function setupCacheSyncListener(queryClient: QueryClient, socket: Socket | null) {
  if (!socket) {
    return;
  }

  socket.on("cache-invalidate", (data: {
    invalidations: Array<{
      queryKey?: readonly unknown[];
      predicate?: string;
      exact?: boolean;
      refetchType?: "active" | "inactive" | "all" | "none";
    }>;
    timestamp: number;
  }) => {
    console.log("📥 [CacheSync] Invalidaciones recibidas de otro cliente:", data.invalidations.length);

    // Procesar cada invalidación
    data.invalidations.forEach((inv) => {
      const options: InvalidationOptions = {};

      if (inv.queryKey) {
        options.queryKey = inv.queryKey;
      }

      if (inv.predicate) {
        // Para predicates, invalidar todas las queries (comportamiento seguro)
        // En la práctica, los predicates se usan para patrones específicos
        // que ya están cubiertos por los eventos transaction-updated existentes
        options.predicate = () => true; // Invalidar todas (React Query optimizará)
      }

      if (inv.exact !== undefined) {
        options.exact = inv.exact;
      }

      if (inv.refetchType) {
        options.refetchType = inv.refetchType;
      }

      // Invalidar sin refetch inmediato (React Query decidirá cuándo refetchear)
      queryClient.invalidateQueries(options);
    });

    console.log("✅ [CacheSync] Caché invalidado desde otro cliente");
  });

  console.log("✅ [CacheSync] Listener de invalidaciones configurado");
}

