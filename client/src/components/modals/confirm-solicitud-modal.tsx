import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ConfirmSolicitudModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  socioDestino?: string;
  valor?: string;
}

export function ConfirmSolicitudModal({ 
  open, 
  onClose, 
  onConfirm,
  socioDestino,
  valor 
}: ConfirmSolicitudModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Confirmar Solicitud</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <DialogDescription className="py-4">
          <div className="space-y-2">
            <p>¿Confirmas crear esta solicitud de transacción pendiente?</p>
            {socioDestino && (
              <p className="font-medium">Destino: {socioDestino}</p>
            )}
            {valor && (
              <p className="font-medium">Valor: ${parseInt(valor).toLocaleString('es-CO')}</p>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Esta transacción quedará como pendiente y no afectará los balances hasta que se complete.
            </p>
          </div>
        </DialogDescription>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

