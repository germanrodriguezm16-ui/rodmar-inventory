import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface SolicitudDetailModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: (detalleSolicitud: string) => void;
}

export function SolicitudDetailModal({ open, onClose, onAccept }: SolicitudDetailModalProps) {
  const [detalleSolicitud, setDetalleSolicitud] = useState("");

  const handleAccept = () => {
    if (detalleSolicitud.trim()) {
      onAccept(detalleSolicitud.trim());
      setDetalleSolicitud(""); // Limpiar al aceptar
    }
  };

  const handleClose = () => {
    setDetalleSolicitud(""); // Limpiar al cerrar
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Información de la Solicitud</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="detalle-solicitud">
              Pega aquí la información del WhatsApp (cuenta, banco, valor, titular, etc.)
            </Label>
            <Textarea
              id="detalle-solicitud"
              placeholder="Ejemplo:&#10;Banco: Bancolombia&#10;Cuenta: 1234567890&#10;Titular: Juan Pérez&#10;Valor: $3.200.000"
              value={detalleSolicitud}
              onChange={(e) => setDetalleSolicitud(e.target.value)}
              className="resize-none min-h-[200px]"
              rows={8}
            />
            <p className="text-sm text-muted-foreground">
              Esta información será visible cuando completes la transacción para facilitar la transferencia.
            </p>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleAccept}
              disabled={!detalleSolicitud.trim()}
            >
              Aceptar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

