import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeleteRodmarCuentaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuenta: any | null;
}

export default function DeleteRodmarCuentaModal({
  open,
  onOpenChange,
  cuenta
}: DeleteRodmarCuentaModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/rodmar-cuentas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-cuentas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances/rodmar"] });
      toast({
        title: "Cuenta eliminada",
        description: "La cuenta RodMar ha sido eliminada exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la cuenta",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    if (!cuenta) return;
    
    const cuentaId = cuenta.id;
    if (!cuentaId) {
      toast({
        title: "Error",
        description: "ID de cuenta no válido",
        variant: "destructive",
      });
      return;
    }
    
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(cuentaId);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!cuenta) return null;

  const cuentaNombre = cuenta.nombre || cuenta.cuenta || "esta cuenta";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Eliminar Cuenta RodMar</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            ¿Estás seguro de que deseas eliminar la cuenta <strong>{cuentaNombre}</strong>?
            <br /><br />
            Esta acción no se puede deshacer. Solo se pueden eliminar cuentas que no tengan transacciones asociadas.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

