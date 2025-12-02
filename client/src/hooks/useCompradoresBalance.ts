import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// Hook compartido para calcular balance de compradores
export const useCompradoresBalance = () => {
  const { data: compradores = [] } = useQuery({
    queryKey: ["/api/compradores"],
    staleTime: 30000,
  });

  // OPTIMIZACIÓN: Usar endpoint de agregación en lugar de cargar todos los viajes
  const { 
    data: balancesFromApi = {}, 
    isFetching: isFetchingBalances 
  } = useQuery({
    queryKey: ["/api/balances/compradores"],
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
    refetchOnReconnect: false, // No recargar al reconectar
  });

  // Usar balances del API directamente (ya calculados en el backend)
  const balancesCompradores = useMemo(() => {
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

  // Calcular resumen financiero general usando useMemo para mantener orden de hooks
  const resumenFinanciero = useMemo(() => {
    let totalPositivos = 0;
    let totalNegativos = 0;

    compradores.forEach((comprador: any) => {
      const balance = balancesCompradores[comprador.id] || 0;
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
  }, [compradores, balancesCompradores]);

  return {
    balancesCompradores,
    resumenFinanciero,
    compradores,
    viajesStats, // Estadísticas para ordenamiento inteligente
    isFetchingBalances // Indicador de carga en segundo plano
  };
};