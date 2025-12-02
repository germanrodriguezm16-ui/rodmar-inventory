import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

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

      // Invalidar queries específicas según entidades afectadas
      if (affectedEntityTypes.includes("mina")) {
        queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
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

      if (affectedEntityTypes.includes("lcdm")) {
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/lcdm"] });
      }

      if (affectedEntityTypes.includes("postobon")) {
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/postobon"] });
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

      // Forzar refetch de queries activas para actualización inmediata
      queryClient.refetchQueries({ type: "active" });
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


