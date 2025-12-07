import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, FileText, Clock } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useState } from "react";
import { PendingDetailModal } from "./pending-detail-modal";

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

interface PendingListModalProps {
  open: boolean;
  onClose: () => void;
}

export function PendingListModal({ open, onClose }: PendingListModalProps) {
  const [selectedTransaccion, setSelectedTransaccion] = useState<TransaccionPendiente | null>(null);

  const { data: pendientes = [], isLoading } = useQuery<TransaccionPendiente[]>({
    queryKey: ["/api/transacciones/pendientes"],
    enabled: open,
    refetchInterval: 30000, // Refrescar cada 30 segundos cuando está abierto
  });

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
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transacciones Pendientes
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : pendientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay transacciones pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendientes.map((transaccion) => (
                  <div
                    key={transaccion.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedTransaccion(transaccion)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {transaccion.codigo_solicitud || `TX-${transaccion.id}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(transaccion.fecha)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{transaccion.concepto}</h3>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(transaccion.valor)}
                        </p>
                        {transaccion.comentario && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {transaccion.comentario}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTransaccion(transaccion);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de detalle */}
      {selectedTransaccion && (
        <PendingDetailModal
          open={!!selectedTransaccion}
          transaccion={selectedTransaccion}
          onClose={() => setSelectedTransaccion(null)}
        />
      )}
    </>
  );
}

