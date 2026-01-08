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
import type { Tercero } from "@shared/schema";

interface DeleteTerceroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tercero: Tercero | null;
}

export default function DeleteTerceroModal({
  open,
  onOpenChange,
  tercero
}: DeleteTerceroModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/terceros/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
      toast({
        title: "Tercero eliminado",
        description: "El tercero ha sido eliminado exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el tercero",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    if (!tercero) return;
    
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(tercero.id);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!tercero) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Eliminar Tercero</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            ¿Estás seguro de que deseas eliminar el tercero <strong>{tercero.nombre}</strong>?
            <br /><br />
            Esta acción no se puede deshacer. Solo se pueden eliminar terceros que no tengan transacciones asociadas.
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



