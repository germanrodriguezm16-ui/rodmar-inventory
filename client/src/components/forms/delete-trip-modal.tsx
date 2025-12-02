import React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import type { ViajeWithDetails } from "@shared/schema";

interface DeleteTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  viaje: ViajeWithDetails | null;
}

export default function DeleteTripModal({ isOpen, onClose, viaje }: DeleteTripModalProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!viaje) throw new Error("No hay viaje para eliminar");
      
      const response = await apiRequest("DELETE", `/api/viajes/${viaje.id}`);
      return response;
    },
    onSuccess: () => {
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
      
      toast({
        title: "Viaje eliminado",
        description: `El viaje ${viaje?.id} y todas sus transacciones relacionadas han sido eliminados correctamente.`,
        duration: 3000,
      });
      
      onClose();
    },
    onError: (error) => {
      console.error("Error deleting trip:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el viaje. Inténtalo de nuevo.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  if (!viaje) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">
            ⚠️ Eliminar Viaje
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p className="font-medium">
              ¿Estás seguro de que deseas eliminar el viaje <span className="font-bold">{viaje.id}</span>?
            </p>
            
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-2">
                ⚠️ ADVERTENCIA - Esta acción es irreversible:
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Se eliminará todo el registro del viaje</li>
                <li>• Se eliminarán las transacciones relacionadas</li>
                <li>• Se recalcularán los saldos de mina y comprador</li>
                {viaje.totalVenta && (
                  <li>• Se perderá el registro de venta: {formatCurrency(viaje.totalVenta.toString())}</li>
                )}
              </ul>
            </div>

            {viaje.estado === "completado" && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Este viaje está completado y tiene datos financieros asociados.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleteMutation.isPending ? "Eliminando..." : "Sí, Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}