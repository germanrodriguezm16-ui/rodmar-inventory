import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { setupCacheSync, setupCacheSyncListener } from "@/lib/cacheSync";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Conectar al servidor Socket.io
    // En producción usa VITE_API_URL, en desarrollo usa window.location.origin
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    
    // Solo conectar si tenemos una URL válida
    if (!apiUrl) {
      console.warn("⚠️ VITE_API_URL no configurada, Socket.io no se conectará");
      return;
    }
    
    const socket = io(apiUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Configurar sincronización de caché
    setupCacheSync(queryClient, socket);
    setupCacheSyncListener(queryClient, socket);

    // Escuchar eventos de actualización de transacciones
    socket.on("transaction-updated", (data: {
      type: "created" | "updated" | "deleted";
      transactionId: number | string;
      affectedEntityTypes: string[];
      affectedAccounts?: string[];
      timestamp: string;
    }) => {
      console.log("📡 Evento recibido: transaction-updated", data);

      const { affectedEntityTypes, affectedAccounts } = data;

      // Invalidar queries de transacciones principales
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      
      // Invalidar pendientes SOLO si el evento indica que es una transacción pendiente
      // Esto evita invalidaciones innecesarias que pueden causar errores 404/500
      if (affectedEntityTypes.includes("pending-transactions")) {
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      }

      // Invalidar queries específicas según entidades afectadas
      if (affectedEntityTypes.includes("mina")) {
        queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
        // Invalidar endpoint de balances para actualizar listados
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0].startsWith("/api/transacciones/socio/mina/");
          },
        });
      }

      if (affectedEntityTypes.includes("comprador")) {
        queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
        // Invalidar endpoint de balances para actualizar listados
        queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] }); // Refetch inmediato
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0].startsWith("/api/transacciones/comprador/");
          },
        });
      }

      if (affectedEntityTypes.includes("volquetero")) {
        queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
        // Invalidar endpoint de balances para actualizar listados
        queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] }); // Refetch inmediato
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              (queryKey[0].startsWith("/api/volqueteros/") ||
                queryKey[0].startsWith("/api/transacciones/socio/volquetero/"));
          },
        });
      }

      if (affectedEntityTypes.includes("tercero")) {
        queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
        queryClient.refetchQueries({ queryKey: ["/api/terceros"] }); // Refetch inmediato
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0].startsWith("/api/terceros/");
          },
        });
      }

      if (affectedEntityTypes.includes("lcdm")) {
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        // Invalidar queries de transacciones LCDM (con paginación)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/transacciones/lcdm";
          },
        });
      }

      if (affectedEntityTypes.includes("postobon")) {
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        // Invalidar queries de transacciones Postobón (con paginación)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/transacciones/postobon";
          },
        });
      }

      // Invalidar queries de cuentas RodMar específicas
      if (affectedAccounts && affectedAccounts.length > 0) {
        affectedAccounts.forEach((accountId) => {
          const accountNames: Record<string, string> = {
            bemovil: "Bemovil",
            corresponsal: "Corresponsal",
            efectivo: "Efectivo",
            "cuentas-german": "Cuentas German",
            "cuentas-jhon": "Cuentas Jhon",
            otros: "Otros",
          };
          const accountName = accountNames[accountId] || accountId;
          // Invalidar todas las queries que empiecen con este patrón (incluye paginación y filtros)
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === `/api/transacciones/cuenta/${accountName}`;
            },
          });
        });
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
      }

      // React Query refetchea automáticamente las queries activas cuando se invalidan
      // No es necesario forzar refetch aquí - React Query lo hace automáticamente
    });

    // Listener para eventos específicos de transacciones actualizadas (patrón dinámico)
    // Socket.io no soporta wildcards directamente, así que usamos onAny y filtramos
    socket.onAny((eventName: string, data: any) => {
      if (eventName.startsWith('transaccionActualizada:')) {
        const { socioTipo, socioId } = data;
        
        console.log(`📡 [WebSocket] transaccionActualizada recibida para ${socioTipo}:${socioId}`);
        
        // Invalidar queries de transacciones del socio (usando patrones específicos)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length > 0) {
              const firstKey = queryKey[0] as string;
              // Invalidar queries como ["/api/transacciones/socio/mina/${id}"] y ["/api/transacciones/socio/mina/${id}/all"]
              if (firstKey === `/api/transacciones/socio/${socioTipo}/${socioId}` || 
                  firstKey === `/api/transacciones/socio/${socioTipo}/${socioId}/all`) {
                return true;
              }
              // Para compradores, también invalidar ["/api/transacciones/comprador", id]
              if (socioTipo === 'comprador' && firstKey === '/api/transacciones/comprador' && queryKey[1] === socioId) {
                return true;
              }
            }
            return false;
          },
        });
        
        // También invalidar queries genéricas
        queryClient.invalidateQueries({
          queryKey: ['transacciones', socioTipo, socioId]
        });
        
        // Forzar refetch de las queries de transacciones del socio para actualización inmediata
        queryClient.refetchQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length > 0) {
              const firstKey = queryKey[0] as string;
              return (
                firstKey === `/api/transacciones/socio/${socioTipo}/${socioId}` ||
                firstKey === `/api/transacciones/socio/${socioTipo}/${socioId}/all` ||
                (socioTipo === 'comprador' && firstKey === '/api/transacciones/comprador' && queryKey[1] === socioId)
              );
            }
            return false;
          },
        });
      } else if (eventName.startsWith('balanceActualizado:')) {
        const { socioTipo, socioId } = data;
        
        // Invalidar query de balance real del socio
        queryClient.invalidateQueries({ 
          queryKey: ['balance-real', socioTipo, socioId] 
        });
      } else if (eventName.startsWith('balanceGlobalActualizado:')) {
        const { tipo } = data;
        
        // Invalidar query de balance global del módulo
        queryClient.invalidateQueries({ 
          queryKey: ['balance-global', tipo] 
        });
        
        // También invalidar el endpoint de balances agregados
        if (tipo === 'mina') {
          queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] });
        } else if (tipo === 'comprador') {
          queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] });
        } else if (tipo === 'volquetero') {
          queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] });
        }
      } else if (eventName.startsWith('tarjetaActualizada:')) {
        const { socioTipo, socioId } = data;
        
        // Invalidar queries de tarjetas
        queryClient.invalidateQueries({ 
          queryKey: ['tarjetas', socioTipo] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['tarjeta', socioTipo, socioId] 
        });
        
        // También invalidar el listado completo del módulo para actualizar la tarjeta
        if (socioTipo === 'mina') {
          queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
          queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] });
        } else if (socioTipo === 'comprador') {
          queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
          queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] });
        } else if (socioTipo === 'volquetero') {
          queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
          queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] });
        }
      }
    });

    // Manejar eventos de conexión
    socket.on("connect", () => {
      console.log("✅ Conectado a Socket.io");
    });

    socket.on("disconnect", () => {
      console.log("❌ Desconectado de Socket.io");
    });

    socket.on("connect_error", (error) => {
      // Solo mostrar error si no es un error de DNS (ERR_NAME_NOT_RESOLVED)
      // Estos errores son esperados si Railway está pausado
      if (error.message && !error.message.includes("ERR_NAME_NOT_RESOLVED")) {
        console.error("❌ Error de conexión Socket.io:", error);
      }
    });

    // Cleanup al desmontar
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);

  return socketRef.current;
}


