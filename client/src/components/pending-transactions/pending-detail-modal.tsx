import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TransaccionPendiente {
  id: number;
  concepto: string;
  valor: string;
  fecha: string;
  codigo_solicitud: string | null;
  detalle_solicitud: string | null;
  paraQuienTipo: string | null;
  paraQuienId: string | null;
  comentario: string | null;
  createdAt?: string;
  horaInterna?: string;
}

interface PendingDetailModalProps {
  open: boolean;
  transaccion: TransaccionPendiente;
  onClose: () => void;
}

export function PendingDetailModal({ open, transaccion, onClose }: PendingDetailModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const formatCurrency = (value: string) => {
    const numValue = parseFloat(value);
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(numValue);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const handleCopy = async () => {
    if (!transaccion.detalle_solicitud) return;

    try {
      await navigator.clipboard.writeText(transaccion.detalle_solicitud);
      setCopied(true);
      toast({
        title: "Copiado",
        description: "El detalle de la solicitud se ha copiado al portapapeles.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalle de Solicitud</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Código de solicitud */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Código</label>
            <p className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block">
              {transaccion.codigo_solicitud || `TX-${transaccion.id}`}
            </p>
          </div>

          {/* Concepto */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Concepto</label>
            <p className="text-base font-semibold">{transaccion.concepto}</p>
          </div>

          {/* Valor */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Valor</label>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(transaccion.valor)}
            </p>
          </div>

          {/* Fecha */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Fecha</label>
            <p className="text-base">{formatDate(transaccion.fecha)}</p>
          </div>

          {/* Detalle de solicitud */}
          {transaccion.detalle_solicitud && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Detalle de la Solicitud
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-muted p-3 rounded-lg border">
                <p className="text-sm whitespace-pre-wrap">{transaccion.detalle_solicitud}</p>
              </div>
            </div>
          )}

          {/* Comentario */}
          {transaccion.comentario && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Comentario</label>
              <p className="text-base">{transaccion.comentario}</p>
            </div>
          )}

          {/* Botón para completar transacción */}
          <div className="pt-4 border-t">
            <Button
              className="w-full"
              onClick={() => {
                // TODO: Implementar navegación al modal de completar transacción
                // Por ahora, solo cerramos este modal
                onClose();
              }}
            >
              Completar Transacción
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

