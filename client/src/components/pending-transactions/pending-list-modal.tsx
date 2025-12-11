import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, FileText, Clock } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useState } from "react";
import { PendingDetailModal } from "./pending-detail-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { CompleteTransactionModal } from "@/components/modals/complete-transaction-modal";

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
  const [editingTransaccion, setEditingTransaccion] = useState<TransaccionPendiente | null>(null);
  const [completingTransaccion, setCompletingTransaccion] = useState<TransaccionPendiente | null>(null);

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
    // Extraer solo la parte de fecha para evitar problemas de zona horaria
    const dateOnly = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const [year, month, day] = dateOnly.split('-').map(Number);
    // Crear fecha en mediodía para evitar problemas de zona horaria UTC
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[450px] max-w-[90vw] max-h-[85vh] overflow-y-auto border-2 border-orange-300 rounded-xl shadow-xl">
          <DialogHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b-2 border-orange-200 -m-6 mb-0 p-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-orange-700">
                <FileText className="h-5 w-5" />
                Transacciones Pendientes
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3 px-1">
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
                    className="border-2 border-orange-200 rounded-lg p-3 hover:border-orange-400 hover:shadow-sm cursor-pointer transition-all bg-gradient-to-br from-white to-orange-50/30"
                    onClick={() => setSelectedTransaccion(transaccion)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-1 rounded-full font-bold shadow-sm whitespace-nowrap">
                            {transaccion.codigo_solicitud || `TX-${transaccion.id}`}
                          </span>
                          <span className="text-xs text-orange-600 font-medium bg-orange-100 px-2 py-1 rounded whitespace-nowrap">
                            {formatDate(transaccion.fecha)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm mb-1 text-gray-800 truncate">{transaccion.concepto}</h3>
                        <p className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                          {formatCurrency(transaccion.valor)}
                        </p>
                      </div>
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
          onEdit={(transaccion) => {
            setEditingTransaccion(transaccion);
            setSelectedTransaccion(null);
          }}
          onComplete={(transaccion) => {
            setCompletingTransaccion(transaccion);
            setSelectedTransaccion(null);
          }}
        />
      )}

      {/* Modal de editar solicitud */}
      {editingTransaccion && (
        <SolicitarTransaccionModal
          open={!!editingTransaccion}
          onClose={() => setEditingTransaccion(null)}
          initialData={{
            id: editingTransaccion.id,
            paraQuienTipo: editingTransaccion.paraQuienTipo || "",
            paraQuienId: editingTransaccion.paraQuienId || "",
            valor: editingTransaccion.valor,
            comentario: editingTransaccion.comentario || undefined,
            detalle_solicitud: editingTransaccion.detalle_solicitud || "",
          }}
        />
      )}

      {/* Modal de completar transacción */}
      {completingTransaccion && (
        <CompleteTransactionModal
          open={!!completingTransaccion}
          onClose={() => setCompletingTransaccion(null)}
          transaccionId={completingTransaccion.id}
          paraQuienTipo={completingTransaccion.paraQuienTipo || undefined}
          paraQuienId={completingTransaccion.paraQuienId || undefined}
        />
      )}
    </>
  );
}

