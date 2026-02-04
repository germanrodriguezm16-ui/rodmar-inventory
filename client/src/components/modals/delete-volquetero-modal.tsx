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
import type { VolqueteroConPlacas } from "@shared/schema";

interface DeleteVolqueteroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volquetero: VolqueteroConPlacas | null;
}

export default function DeleteVolqueteroModal({
  open,
  onOpenChange,
  volquetero,
}: DeleteVolqueteroModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/volqueteros/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros/resumen"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
      toast({
        title: "Volquetero eliminado",
        description: "El volquetero ha sido eliminado exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el volquetero",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    if (!volquetero) return;

    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(volquetero.id);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!volquetero) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Eliminar Volquetero</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            ¿Estás seguro de que deseas eliminar el volquetero{" "}
            <strong>{volquetero.nombre}</strong>?
            <br />
            <br />
            Esta acción no se puede deshacer. Solo se pueden eliminar volqueteros
            que no tengan viajes ni transacciones asociados.
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
