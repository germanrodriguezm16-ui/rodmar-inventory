import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { History, Undo2, ArrowRight, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { parseISO } from "date-fns";

interface FusionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FusionRecord {
  id: number;
  tipoEntidad: string;
  origenNombre: string;
  destinoNombre: string;
  fechaFusion: string;
  revertida: boolean;
  fechaReversion?: string;
  transaccionesAfectadas: number;
  viajesAfectados: number;
}

export default function FusionHistoryModal({ open, onOpenChange }: FusionHistoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['/api/fusion-history'],
    enabled: open,
  });

  const revertMutation = useMutation({
    mutationFn: async (fusionId: number) => {
      const response = await apiRequest('POST', '/api/fusion/revert', { fusionId });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Fusión revertida",
        description: `${data.entidadRestaurada} restaurado. ${data.transaccionesRestauradas} transacciones y ${data.viajesRestaurados} viajes restaurados.`,
      });
      
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['/api/fusion-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volqueteros'] });
      queryClient.invalidateQueries({ queryKey: ['/api/minas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/compradores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transacciones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/viajes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al revertir",
        description: error.message || "No se pudo revertir la fusión",
        variant: "destructive",
      });
    },
  });

  const entityTypeNames = {
    volquetero: { singular: 'Volquetero', plural: 'volqueteros' },
    mina: { singular: 'Mina', plural: 'minas' },
    comprador: { singular: 'Comprador', plural: 'compradores' }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>Historial de Fusiones</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando historial...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Historial de Fusiones</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {historial.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay fusiones registradas</p>
            </div>
          ) : (
            historial.map((record: FusionRecord) => (
              <Card key={record.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline">
                          {entityTypeNames[record.tipoEntidad as keyof typeof entityTypeNames]?.singular || record.tipoEntidad}
                        </Badge>
                        {record.revertida ? (
                          <Badge variant="secondary" className="text-xs">
                            <Undo2 className="h-3 w-3 mr-1" />
                            Revertida
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm mb-2">
                        <span className="font-medium">{record.origenNombre}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{record.destinoNombre}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mb-2">
                        <div>
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Fusión: {formatDate(parseISO(record.fechaFusion))}</span>
                          </span>
                        </div>
                        {record.revertida && record.fechaReversion && (
                          <div>
                            <span className="flex items-center space-x-1">
                              <Undo2 className="h-3 w-3" />
                              <span>Revertida: {formatDate(parseISO(record.fechaReversion))}</span>
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-4 text-xs text-muted-foreground">
                        <span>{record.transaccionesAfectadas} transacciones</span>
                        <span>{record.viajesAfectados} viajes</span>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {!record.revertida && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revertMutation.mutate(record.id)}
                          disabled={revertMutation.isPending}
                          className="text-xs"
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          Revertir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}