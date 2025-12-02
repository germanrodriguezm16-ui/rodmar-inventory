import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Entity {
  id: number;
  nombre: string;
}

interface MergeEntitiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  entityType: 'volqueteros' | 'minas' | 'compradores';
  onSuccess?: () => void;
}

export default function MergeEntitiesModal({ 
  open, 
  onOpenChange, 
  entities, 
  entityType,
  onSuccess 
}: MergeEntitiesModalProps) {
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const entityTypeNames = {
    volqueteros: { singular: 'volquetero', plural: 'volqueteros' },
    minas: { singular: 'mina', plural: 'minas' },
    compradores: { singular: 'comprador', plural: 'compradores' }
  };

  const mergeMutation = useMutation({
    mutationFn: async ({ origenId, destinoId }: { origenId: number; destinoId: number }) => {
      const response = await apiRequest('POST', `/api/${entityType}/merge`, { origenId, destinoId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Fusión completada",
        description: `${entityTypeNames[entityType].singular} fusionado exitosamente. ${data.transaccionesTransferidas} transacciones y ${data.viajesTransferidos} viajes transferidos.`,
      });
      
      // Invalidar queries relevantes
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/transacciones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/viajes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fusion-history'] });
      
      onOpenChange(false);
      setOrigenId("");
      setDestinoId("");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error en la fusión",
        description: error.message || "No se pudo completar la fusión",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!origenId || !destinoId) {
      toast({
        title: "Selección incompleta",
        description: `Debe seleccionar ambos ${entityTypeNames[entityType].plural}`,
        variant: "destructive",
      });
      return;
    }

    if (origenId === destinoId) {
      toast({
        title: "Selección inválida",
        description: `No se puede fusionar un ${entityTypeNames[entityType].singular} consigo mismo`,
        variant: "destructive",
      });
      return;
    }

    mergeMutation.mutate({ 
      origenId: parseInt(origenId), 
      destinoId: parseInt(destinoId) 
    });
  };

  const origenEntity = entities.find(e => e.id.toString() === origenId);
  const destinoEntity = entities.find(e => e.id.toString() === destinoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fusionar {entityTypeNames[entityType].plural}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">¡Atención!</p>
                <p className="mt-1">
                  Esta acción fusionará dos {entityTypeNames[entityType].plural}. 
                  Todas las transacciones y viajes se transferirán al {entityTypeNames[entityType].singular} destino 
                  y el {entityTypeNames[entityType].singular} origen será eliminado.
                </p>
                <p className="mt-1 font-medium">
                  ✅ Se puede revertir desde el historial de fusiones.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="origen">
                {entityTypeNames[entityType].singular} origen (se eliminará)
              </Label>
              <Select value={origenId} onValueChange={setOrigenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id.toString()}>
                      {entity.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destino">
                {entityTypeNames[entityType].singular} destino (conservará datos)
              </Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id.toString()}>
                      {entity.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {origenEntity && destinoEntity && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">{origenEntity.nombre}</span>
                <ArrowRight className="h-4 w-4" />
                <span className="font-medium">{destinoEntity.nombre}</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Todos los datos de "{origenEntity.nombre}" se transferirán a "{destinoEntity.nombre}"
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={mergeMutation.isPending || !origenId || !destinoId}
          >
            {mergeMutation.isPending ? "Fusionando..." : "Fusionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}