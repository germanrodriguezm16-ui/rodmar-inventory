import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useRecalculatePrecalculos() {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/maintenance/recalculate-all-balances");
    },
    onSuccess: () => {
      // Invalidar cache de todas las entidades para refrescar con nuevos precálculos
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
      
      toast({
        title: "Precálculos actualizados",
        description: "Todos los balances precalculados han sido recalculados exitosamente",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error recalculando precálculos:", error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar los precálculos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    recalcular: mutation.mutate,
    isRecalculando: mutation.isPending,
  };
}