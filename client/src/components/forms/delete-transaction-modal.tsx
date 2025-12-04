import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { formatCurrency } from "@/lib/calculations";
import type { TransaccionWithSocio } from "@shared/schema";

interface DeleteTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransaccionWithSocio | null;
}

export default function DeleteTransactionModal({ isOpen, onClose, transaction }: DeleteTransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionToDelete: TransaccionWithSocio) => {
      console.log("=== Deleting transaction:", transactionToDelete.id);
      
      const response = await fetch(apiUrl(`/api/transacciones/${transactionToDelete.id}`), {
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
      console.log("=== Transaction deleted successfully");
      toast({
        title: "Transacción eliminada",
        description: "La transacción se eliminó correctamente",
        duration: 2000,
      });

      // INVALIDACIÓN SELECTIVA - Solo entidades afectadas por la transacción eliminada
      console.log("=== INVALIDACIÓN SELECTIVA POST-ELIMINACIÓN ===");
      
      // Siempre invalidar transacciones
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      
      // Invalidar queries específicas de AMBOS socios (origen y destino)
      // Esto asegura que las tarjetas y balances globales se actualicen
      const sociosAfectados = new Set<string>();
      
      if (transaction?.deQuienTipo && transaction?.deQuienId) {
        const key = `${transaction.deQuienTipo}:${transaction.deQuienId}`;
        sociosAfectados.add(key);
        
        // Invalidar queries de transacciones del socio origen
        queryClient.invalidateQueries({
          queryKey: ['transacciones', transaction.deQuienTipo, transaction.deQuienId]
        });
        queryClient.invalidateQueries({
          queryKey: ['balance-real', transaction.deQuienTipo, transaction.deQuienId]
        });
        
        // Invalidar queries de tarjetas (tanto individual como lista)
        queryClient.invalidateQueries({
          queryKey: ['tarjeta', transaction.deQuienTipo, transaction.deQuienId]
        });
        queryClient.invalidateQueries({
          queryKey: ['tarjetas', transaction.deQuienTipo]
        });
        
        // Invalidar balance global del módulo
        if (['mina', 'comprador', 'volquetero'].includes(transaction.deQuienTipo)) {
          queryClient.invalidateQueries({
            queryKey: ['balance-global', transaction.deQuienTipo]
          });
        }
      }
      
      if (transaction?.paraQuienTipo && transaction?.paraQuienId) {
        const key = `${transaction.paraQuienTipo}:${transaction.paraQuienId}`;
        if (!sociosAfectados.has(key)) {
          // Invalidar queries de transacciones del socio destino
          queryClient.invalidateQueries({
            queryKey: ['transacciones', transaction.paraQuienTipo, transaction.paraQuienId]
          });
          queryClient.invalidateQueries({
            queryKey: ['balance-real', transaction.paraQuienTipo, transaction.paraQuienId]
          });
          
          // Invalidar queries de tarjetas (tanto individual como lista)
          queryClient.invalidateQueries({
            queryKey: ['tarjeta', transaction.paraQuienTipo, transaction.paraQuienId]
          });
          queryClient.invalidateQueries({
            queryKey: ['tarjetas', transaction.paraQuienTipo]
          });
          
          // Invalidar balance global del módulo
          if (['mina', 'comprador', 'volquetero'].includes(transaction.paraQuienTipo)) {
            queryClient.invalidateQueries({
              queryKey: ['balance-global', transaction.paraQuienTipo]
            });
          }
        }
      }
      
      // Invalidar solo las entidades que estaban involucradas en la transacción eliminada
      // CRÍTICO: Invalidar listados completos para actualizar tarjetas
      if (transaction?.deQuienTipo === 'mina' || transaction?.paraQuienTipo === 'mina') {
        queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
        queryClient.refetchQueries({ queryKey: ["/api/minas"] }); // Refetch listado para actualizar tarjetas
        // Invalidar queries específicas de minas
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length > 0) {
              const firstKey = queryKey[0] as string;
              // Invalidar queries como ["/api/transacciones/socio/mina/${minaId}"] y ["/api/transacciones/socio/mina/${minaId}/all"]
              return firstKey?.startsWith("/api/transacciones/socio/mina/");
            }
            return false;
          }
        });
      }
      if (transaction?.deQuienTipo === 'comprador' || transaction?.paraQuienTipo === 'comprador') {
        queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
        queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] }); // Refetch inmediato
        queryClient.refetchQueries({ queryKey: ["/api/compradores"] }); // Refetch listado para actualizar tarjetas
        // Invalidar queries específicas de compradores
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length >= 2) {
              const firstKey = queryKey[0] as string;
              const secondKey = queryKey[1];
              // Invalidar queries como ["/api/transacciones/comprador", compradorId] y ["/api/transacciones/comprador", compradorId, "includeHidden"]
              return firstKey === "/api/transacciones/comprador" && 
                     (typeof secondKey === 'number' || typeof secondKey === 'string');
            }
            return false;
          }
        });
      }
      if (transaction?.deQuienTipo === 'volquetero' || transaction?.paraQuienTipo === 'volquetero') {
        queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
        queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] }); // Refetch inmediato
        queryClient.refetchQueries({ queryKey: ["/api/volqueteros"] }); // Refetch listado para actualizar tarjetas
        // Invalidar queries específicas de volqueteros
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) && 
                   queryKey.length === 3 && 
                   queryKey[0] === "/api/volqueteros" && 
                   queryKey[2] === "transacciones";
          }
        });
        // También invalidar queries como ["/api/transacciones/socio/volquetero", volqueteroId, "all"]
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length >= 2) {
              const firstKey = queryKey[0] as string;
              return firstKey === "/api/transacciones/socio/volquetero";
            }
            return false;
          }
        });
      }
      
      // Solo invalidar viajes si había relación específica (no necesario en la mayoría de casos)
      // queryClient.invalidateQueries({ queryKey: ["/api/viajes"] }); // Comentado para optimización
      
      // Invalidar queries específicas para LCDM/Postobón
      if (transaction?.deQuienTipo === 'lcdm' || transaction?.paraQuienTipo === 'lcdm') {
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        // Invalidar queries de transacciones LCDM (con paginación)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/transacciones/lcdm";
          },
        });
        // Invalidar queries de transacciones para asegurar actualización del balance
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      }
      if (transaction?.deQuienTipo === 'postobon' || transaction?.paraQuienTipo === 'postobon') {
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        // Invalidar queries de transacciones Postobón (con paginación)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/transacciones/postobon";
          },
        });
        // Invalidar queries de transacciones para asegurar actualización del balance
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      }
      
      // Invalidar queries específicas para cuentas RodMar (Bemovil, Corresponsal, Efectivo, etc.)
      const rodmarAccountIds = ['bemovil', 'corresponsal', 'efectivo', 'cuentas-german', 'cuentas-jhon', 'otros'];
      const hasRodmarAccount = 
        (transaction?.deQuienTipo === 'rodmar' && rodmarAccountIds.includes(transaction?.deQuienId || '')) ||
        (transaction?.paraQuienTipo === 'rodmar' && rodmarAccountIds.includes(transaction?.paraQuienId || ''));
      
      if (hasRodmarAccount) {
        // Invalidar queries de cuentas RodMar
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        
        // Invalidar queries específicas de transacciones por cuenta
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length >= 2) {
              const firstKey = queryKey[0] as string;
              // Invalidar queries como ["/api/transacciones/cuenta/Bemovil"], ["/api/transacciones/cuenta/Corresponsal"], etc.
              return firstKey?.startsWith("/api/transacciones/cuenta/");
            }
            return false;
          }
        });
        
        // Invalidar queries de transacciones para asegurar actualización del balance
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      }
      
      // Invalidate specific socio queries - manejo seguro para ambos formatos
      if (transaction) {
        // Formato clásico con tipoSocio/socioId
        if (transaction.tipoSocio && transaction.socioId) {
          queryClient.invalidateQueries({ 
            queryKey: ["/api/transacciones", "socio", transaction.tipoSocio, transaction.socioId] 
          });
        }
      }

      onClose();
    },
    onError: (error: any) => {
      console.error("=== Error deleting transaction:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la transacción",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    if (!transaction) {
      console.error("=== No transaction available for deletion");
      toast({
        title: "Error",
        description: "No se pudo identificar la transacción a eliminar",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    deleteTransactionMutation.mutate(transaction);
  };

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  if (!transaction) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmDelete ? "⚠️ Confirmar Eliminación" : "¿Eliminar Transacción?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {confirmDelete 
                  ? "ATENCIÓN: Esta acción eliminará permanentemente la transacción. ¿Estás completamente seguro?" 
                  : "Esta acción no se puede deshacer. La transacción será eliminada permanentemente."
                }
              </p>
              
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Socio:</span>
                  <span>{transaction.socioNombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Concepto:</span>
                  <span>{transaction.concepto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Valor:</span>
                  <span className={`font-semibold ${
                    parseFloat(transaction.valor) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(transaction.valor)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Fecha:</span>
                  <span>{new Date(transaction.fecha).toLocaleDateString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Forma de Pago:</span>
                  <span>{transaction.formaPago}</span>
                </div>
                {transaction.comentario && (
                  <div className="flex justify-between">
                    <span className="font-medium">Comentario:</span>
                    <span className="text-sm text-muted-foreground max-w-[200px] text-right">
                      {transaction.comentario}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
            Cancelar
          </AlertDialogCancel>
          <Button
            onClick={handleDeleteClick}
            disabled={deleteTransactionMutation.isPending}
            className={confirmDelete 
              ? "bg-red-600 text-white hover:bg-red-700 font-bold" 
              : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }
          >
            {deleteTransactionMutation.isPending 
              ? "Eliminando..." 
              : confirmDelete 
                ? "SÍ, ELIMINAR DEFINITIVAMENTE" 
                : "Eliminar Transacción"
            }
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}