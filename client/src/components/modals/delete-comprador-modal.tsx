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
import type { Comprador } from "@shared/schema";

interface DeleteCompradorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprador: Comprador | null;
}

export default function DeleteCompradorModal({
  open,
  onOpenChange,
  comprador
}: DeleteCompradorModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // Fixed: method first, URL second
      return apiRequest("DELETE", `/api/compradores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      toast({
        title: "Comprador eliminado",
        description: "El comprador ha sido eliminado exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el comprador",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    if (!comprador) return;
    
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(comprador.id);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!comprador) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Eliminar Comprador</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            ¿Estás seguro de que deseas eliminar el comprador <strong>{comprador.nombre}</strong>?
            <br /><br />
            Esta acción no se puede deshacer. Solo se pueden eliminar compradores que no tengan viajes ni transacciones asociados.
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