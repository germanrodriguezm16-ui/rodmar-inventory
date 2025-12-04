import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ViajeWithDetails } from "@shared/schema";

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedViajes: ViajeWithDetails[];
  onSuccess: () => void;
}

export default function BulkDeleteModal({ isOpen, onClose, selectedViajes, onSuccess }: BulkDeleteModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (viajeIds: string[]) => {
      console.log("🗑️ BULK DELETE - Starting deletion for:", viajeIds.length, "viajes");
      console.log("🗑️ BULK DELETE - Viaje IDs:", viajeIds.slice(0, 5), "...");
      
      try {
        const response = await apiRequest("DELETE", "/api/viajes-bulk-delete", { viajeIds });
        console.log("🗑️ BULK DELETE - Raw response:", response);
        const data = await response.json();
        console.log("🗑️ BULK DELETE - JSON data:", data);
        return data;
      } catch (error) {
        console.error("🗑️ BULK DELETE - API request failed:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Limpiar cache completamente PRIMERO - incluir TODAS las variantes posibles
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/viajes");
        }
      });
      
      // Invalidar todas las consultas críticas
      queryClient.invalidateQueries({ queryKey: ["/api/viajes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      // Invalidar y refetch balances inmediatamente
      queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
      queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
      queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
      queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] });
      
      // Invalidar específicamente todas las consultas de viajes por mina (cualquier ID)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/viajes/mina/");
        }
      });
      
      // Forzar refetch de TODAS las consultas de transacciones por socio
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/transacciones/socio/");
        }
      });
      
      const { deletedCount, totalRequested, errors } = data;
      
      if (errors && errors.length > 0) {
        toast({
          title: "Eliminación parcial",
          description: `Se eliminaron ${deletedCount} de ${totalRequested} viajes. ${errors.length} viajes no se pudieron eliminar.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Viajes eliminados",
          description: `Se eliminaron ${deletedCount} viajes exitosamente.`,
        });
      }
      
      onSuccess();
      onClose();
    },
    onError: (error) => {
      console.error("Error deleting viajes:", error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los viajes. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    const viajeIds = selectedViajes.map(v => v.id);
    deleteMutation.mutate(viajeIds);
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "N/A";
    const num = parseFloat(amount);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Confirmar eliminación masiva
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-foreground mb-2">
              <strong>⚠️ ELIMINAR {selectedViajes.length} VIAJES - ACCIÓN IRREVERSIBLE</strong>
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Esta acción <strong>NO SE PUEDE DESHACER</strong>. Se eliminarán permanentemente:
            </p>
            <ul className="text-xs text-muted-foreground ml-4 space-y-1">
              <li>• Los {selectedViajes.length} viajes seleccionados</li>
              <li>• Todas sus transacciones financieras asociadas</li>
              <li>• Todo el historial y datos relacionados</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Viajes a eliminar:</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {selectedViajes.map((viaje) => (
                <div key={viaje.id} className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{viaje.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {viaje.conductor} • {viaje.placa}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {viaje.mina?.nombre} → {viaje.comprador?.nombre || "Sin asignar"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {viaje.estado === "completado" ? "Completado" : "Pendiente"}
                      </p>
                      {viaje.totalVenta && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(viaje.totalVenta)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                "Eliminando..."
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar {selectedViajes.length} viajes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}