import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

// Hook compartido para calcular balance de minas
export const useMinasBalance = () => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  const { data: minas = [] } = useQuery({
    queryKey: ["/api/minas"],
    staleTime: 30000,
  });

  // OPTIMIZACIÓN: Usar endpoint de agregación en lugar de cargar todos los viajes
  const { 
    data: balancesFromApi = {}, 
    isFetching: isFetchingBalances 
  } = useQuery({
    queryKey: ["/api/balances/minas"],
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
    refetchOnReconnect: false, // No recargar al reconectar
  });

  // Escuchar eventos WebSocket para invalidar queries cuando se actualicen balances
  useEffect(() => {
    if (!socket) return;

    const handleBalanceUpdate = (data: { affectedPartners: Array<{ tipo: string; id: number }> }) => {
      const hasMina = data.affectedPartners.some(p => p.tipo === 'mina');
      if (hasMina) {
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
      }
    };

    // Listener para eventos específicos de balance global y tarjeta actualizada
    const handleSpecificEvent = (eventName: string, data: any) => {
      if (eventName.startsWith('balanceGlobalActualizado:') && data.tipo === 'mina') {
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
      } else if (eventName.startsWith('tarjetaActualizada:') && data.socioTipo === 'mina') {
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
      }
    };

    socket.on("balance-updated", handleBalanceUpdate);
    
    // Escuchar eventos específicos usando onAny
    socket.onAny(handleSpecificEvent);

    return () => {
      socket.off("balance-updated", handleBalanceUpdate);
      socket.offAny(handleSpecificEvent);
    };
  }, [socket, queryClient]);

  // Usar balances del API directamente (ya calculados en el backend)
  const balancesMinas = useMemo(() => {
    const result: Record<number, number> = {};
    Object.entries(balancesFromApi as Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>).forEach(([id, data]) => {
      result[parseInt(id)] = data.balance;
    });
    return result;
  }, [balancesFromApi]);

  // Estadísticas de viajes para ordenamiento inteligente
  const viajesStats = useMemo(() => {
    const result: Record<number, { viajesCount: number; viajesUltimoMes: number }> = {};
    Object.entries(balancesFromApi as Record<number, { balance: number; viajesCount: number; viajesUltimoMes: number }>).forEach(([id, data]) => {
      result[parseInt(id)] = {
        viajesCount: data.viajesCount,
        viajesUltimoMes: data.viajesUltimoMes
      };
    });
    return result;
  }, [balancesFromApi]);

  // Calcular resumen financiero usando useMemo para mantener orden de hooks
  const resumenFinanciero = useMemo(() => {
    let totalPositivos = 0;
    let totalNegativos = 0;

    (minas as any[]).forEach((mina: any) => {
      const balance = balancesMinas[mina.id] || 0;
      
      // Agregar al resumen
      if (balance > 0) {
        totalPositivos += balance;
      } else if (balance < 0) {
        totalNegativos += Math.abs(balance);
      }
    });

    const balanceNeto = totalPositivos - totalNegativos;

    return {
      positivos: totalPositivos,
      negativos: totalNegativos,
      balance: balanceNeto
    };
  }, [minas, balancesMinas]);

  return {
    balancesMinas,
    resumenFinanciero,
    minas,
    viajesStats, // Estadísticas para ordenamiento inteligente
    isFetchingBalances // Indicador de carga en segundo plano
  };
};