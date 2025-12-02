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
import type { Mina } from "@shared/schema";

interface DeleteMinaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mina: Mina | null;
}

export default function DeleteMinaModal({
  open,
  onOpenChange,
  mina
}: DeleteMinaModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/minas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      toast({
        title: "Mina eliminada",
        description: "La mina ha sido eliminada exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la mina",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    if (!mina) return;
    
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(mina.id);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!mina) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Eliminar Mina</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            ¿Estás seguro de que deseas eliminar la mina <strong>{mina.nombre}</strong>?
            <br /><br />
            Esta acción no se puede deshacer. Solo se pueden eliminar minas que no tengan viajes ni transacciones asociados.
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