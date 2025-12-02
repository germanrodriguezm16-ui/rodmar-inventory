import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// Hook compartido para calcular balance de minas
export const useMinasBalance = () => {
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