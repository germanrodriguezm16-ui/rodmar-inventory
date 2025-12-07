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
          <DialogHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200 -m-6 mb-0 p-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-orange-700">Detalle de Solicitud</DialogTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Código de solicitud */}
          <div className="bg-gradient-to-r from-orange-100 to-amber-100 p-4 rounded-lg border border-orange-200">
            <label className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 block">Código</label>
            <p className="text-sm font-mono bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-full inline-block font-bold shadow-sm">
              {transaccion.codigo_solicitud || `TX-${transaccion.id}`}
            </p>
          </div>

          {/* Concepto */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Concepto</label>
            <p className="text-base font-semibold text-gray-800">{transaccion.concepto}</p>
          </div>

          {/* Valor */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-lg border-2 border-orange-200">
            <label className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 block">Valor</label>
            <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              {formatCurrency(transaccion.valor)}
            </p>
          </div>

          {/* Fecha */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Fecha</label>
            <p className="text-base text-gray-800">{formatDate(transaccion.fecha)}</p>
          </div>

          {/* Detalle de solicitud */}
          {transaccion.detalle_solicitud && (
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Detalle de la Solicitud
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2 bg-white hover:bg-blue-100 border-blue-300 text-blue-700"
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
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <p className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{transaccion.detalle_solicitud}</p>
              </div>
            </div>
          )}

          {/* Comentario */}
          {transaccion.comentario && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Comentario</label>
              <p className="text-base text-gray-800">{transaccion.comentario}</p>
            </div>
          )}

          {/* Botón para completar transacción */}
          <div className="pt-4 border-t border-orange-200">
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md"
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

