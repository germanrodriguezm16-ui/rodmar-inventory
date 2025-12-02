import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";

interface DeleteInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  inversion: any;
}

export function DeleteInvestmentModal({ isOpen, onClose, inversion }: DeleteInvestmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteInversionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/inversiones/${inversion.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Inversión eliminada",
        description: "La inversión se ha eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/inversiones/cuenta/${inversion.origen === 'rodmar' ? inversion.origenDetalle : inversion.origen}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/inversiones/cuenta/${inversion.destino === 'rodmar' ? inversion.destinoDetalle : inversion.destino}`] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la inversión",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteInversionMutation.mutateAsync();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!inversion) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar inversión?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Esta acción no se puede deshacer. Se eliminará permanentemente:</p>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="font-medium">{inversion.concepto}</p>
              <p className="text-sm text-gray-600">
                Valor: ${parseFloat(inversion.valor || 0).toLocaleString('es-CO')}
              </p>
              <p className="text-sm text-gray-600">
                Fecha: {new Date(inversion.fecha).toLocaleDateString('es-CO')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="modal-buttons-container">
          <AlertDialogCancel disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || deleteInversionMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}