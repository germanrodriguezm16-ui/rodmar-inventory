import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  onEdit?: (transaccion: TransaccionPendiente) => void;
  onComplete?: (transaccion: TransaccionPendiente) => void;
}

export function PendingDetailModal({ open, transaccion, onClose, onEdit, onComplete }: PendingDetailModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(apiUrl(`/api/transacciones/${id}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitud eliminada",
        description: "La transacción pendiente se ha eliminado exitosamente.",
      });
      
      // Invalidar queries de pendientes
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      
      // Invalidar módulo general de transacciones (todas las páginas)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            typeof queryKey[0] === "string" &&
            queryKey[0] === "/api/transacciones";
        },
      });
      
      // Invalidar queries del socio destino
      if (transaccion.paraQuienTipo && transaccion.paraQuienId) {
        if (transaccion.paraQuienTipo === 'comprador') {
          queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", parseInt(transaccion.paraQuienId)] });
        }
        if (transaccion.paraQuienTipo === 'mina') {
          queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${transaccion.paraQuienId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${transaccion.paraQuienId}/all`] });
        }
        if (transaccion.paraQuienTipo === 'volquetero') {
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/volqueteros" &&
                queryKey[1] === parseInt(transaccion.paraQuienId) &&
                queryKey[2] === "transacciones";
            },
          });
        }
      }
      
      setShowDeleteConfirm(false);
      onClose();
    },
    onError: (error: any) => {
      console.error("Error deleting solicitud:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la solicitud. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (onEdit) {
      onEdit(transaccion);
      onClose();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(transaccion.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[450px] max-w-[90vw] max-h-[85vh] overflow-y-auto border-2 border-orange-300 rounded-xl shadow-xl">
          <DialogHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b-2 border-orange-200 -m-6 mb-0 p-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-orange-700">Detalle de Solicitud</DialogTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

        <div className="space-y-4 py-3 px-1">
          {/* Código de solicitud */}
          <div className="bg-gradient-to-r from-orange-100 to-amber-100 p-3 rounded-lg border-2 border-orange-200">
            <label className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 block">Código</label>
            <p className="text-sm font-mono bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1.5 rounded-full inline-block font-bold shadow-sm">
              {transaccion.codigo_solicitud || `TX-${transaccion.id}`}
            </p>
          </div>

          {/* Concepto */}
          <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Concepto</label>
            <p className="text-sm font-semibold text-gray-800">{transaccion.concepto}</p>
          </div>

          {/* Valor */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 rounded-lg border-2 border-orange-200">
            <label className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 block">Valor</label>
            <p className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              {formatCurrency(transaccion.valor)}
            </p>
          </div>

          {/* Fecha */}
          <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Fecha</label>
            <p className="text-sm text-gray-800">{formatDate(transaccion.fecha)}</p>
          </div>

          {/* Detalle de solicitud */}
          {transaccion.detalle_solicitud && (
            <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-300">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Detalle de la Solicitud
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2 bg-white hover:bg-blue-100 border-2 border-blue-300 text-blue-700 h-8"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-white p-3 rounded-lg border-2 border-blue-200">
                <p className="text-xs whitespace-pre-wrap text-gray-700 leading-relaxed">{transaccion.detalle_solicitud}</p>
              </div>
            </div>
          )}

          {/* Comentario */}
          {transaccion.comentario && (
            <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Comentario</label>
              <p className="text-sm text-gray-800">{transaccion.comentario}</p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="pt-3 border-t-2 border-orange-200 mt-4">
            <div className="flex items-center gap-2">
              {/* Botón Editar */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleEdit}
                className="flex-1 border-2 border-blue-300 hover:bg-blue-100 hover:border-blue-400"
                title="Editar solicitud"
              >
                <Edit className="h-4 w-4 text-blue-600" />
              </Button>
              
              {/* Botón Eliminar */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 border-2 border-red-300 hover:bg-red-100 hover:border-red-400"
                title="Eliminar solicitud"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
              
              {/* Botón Completar */}
              <Button
                className="flex-[2] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md border-2 border-orange-600"
                onClick={() => {
                  if (onComplete) {
                    onComplete(transaccion);
                  } else {
                    onClose();
                  }
                }}
              >
                Completar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de confirmación de eliminación */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent className="border-2 border-red-300">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente la transacción pendiente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

