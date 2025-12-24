import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Plus, FileText, CheckCircle2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface GestionarTransaccionesModalProps {
  open: boolean;
  onClose: () => void;
  onCrear: () => void;
  onSolicitar: () => void;
  onCompletar: () => void;
}

export function GestionarTransaccionesModal({ 
  open, 
  onClose, 
  onCrear, 
  onSolicitar, 
  onCompletar 
}: GestionarTransaccionesModalProps) {
  const { has } = usePermissions();
  
  // Verificar permisos para cada acción
  const canCreate = has("action.TRANSACCIONES.create");
  const canSolicitar = has("action.TRANSACCIONES.solicitar");
  const canCompletar = has("action.TRANSACCIONES.completePending");
  
  // Si no tiene ningún permiso, no mostrar el modal
  if (!canCreate && !canSolicitar && !canCompletar) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] max-w-[90vw] border-2 border-blue-300 rounded-xl shadow-xl">
        <DialogHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 -m-6 mb-4 p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-blue-700 text-lg">
              <FileText className="h-5 w-5" />
              Gestionar Transacciones
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-3 px-1 py-2">
          {/* Botón Crear - Solo si tiene permiso */}
          {canCreate && (
            <Button
              onClick={() => {
                onCrear();
                onClose();
              }}
              className="w-full h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-md border-2 border-blue-700 flex items-center justify-center gap-3"
            >
              <Plus className="h-5 w-5" />
              <span>Crear</span>
            </Button>
          )}

          {/* Botón Solicitar - Solo si tiene permiso */}
          {canSolicitar && (
            <Button
              onClick={() => {
                onSolicitar();
                onClose();
              }}
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md border-2 border-orange-600 flex items-center justify-center gap-3"
            >
              <FileText className="h-5 w-5" />
              <span>Solicitar</span>
            </Button>
          )}

          {/* Botón Completar - Solo si tiene permiso */}
          {canCompletar && (
            <Button
              onClick={() => {
                onCompletar();
                onClose();
              }}
              className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-md border-2 border-green-700 flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Completar</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

