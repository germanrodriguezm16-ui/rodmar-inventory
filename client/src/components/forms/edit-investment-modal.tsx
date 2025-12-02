import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Banknote, X } from "lucide-react";

const inversionUpdateSchema = z.object({
  origen: z.string().min(1, "Origen es requerido"),
  origenDetalle: z.string().optional(),
  destino: z.string().min(1, "Destino es requerido"),
  destinoDetalle: z.string().optional(),
  valor: z.string().min(1, "Valor es requerido"),
  fecha: z.string().min(1, "Fecha es requerida"),
  concepto: z.string().min(1, "Concepto es requerido"),
  observaciones: z.string().optional(),
  voucher: z.string().optional(),
});

type InversionUpdateData = z.infer<typeof inversionUpdateSchema>;

interface EditInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  inversion: any;
}

export function EditInvestmentModal({ isOpen, onClose, inversion }: EditInvestmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrigen, setSelectedOrigen] = useState(inversion?.origen || "");
  const [selectedDestino, setSelectedDestino] = useState(inversion?.destino || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InversionUpdateData>({
    resolver: zodResolver(inversionUpdateSchema),
    defaultValues: {
      origen: inversion?.origen || "",
      origenDetalle: inversion?.origenDetalle || "",
      destino: inversion?.destino || "",
      destinoDetalle: inversion?.destinoDetalle || "",
      valor: inversion?.valor || "",
      fecha: inversion?.fecha ? inversion.fecha.split('T')[0] : "",
      concepto: inversion?.concepto || "",
      observaciones: inversion?.observaciones || "",
      voucher: inversion?.voucher || "",
    },
  });

  const origenOptions = [
    { value: "rodmar", label: "RodMar" },
    { value: "postobon", label: "Postobón" },
    { value: "banco", label: "Banco" },
    { value: "otros", label: "Otros" },
  ];

  const destinoOptions = [
    { value: "rodmar", label: "RodMar" },
    { value: "postobon", label: "Postobón" },
    { value: "banco", label: "Banco" },
    { value: "otros", label: "Otros" },
  ];

  const rodmarSubcuentas = [
    { value: "bemovil", label: "Bemovil" },
    { value: "corresponsal", label: "Corresponsal" },
    { value: "efectivo", label: "Efectivo" },
    { value: "cuentas-german", label: "Cuentas German" },
    { value: "cuentas-jhon", label: "Cuentas Jhon" },
    { value: "otros", label: "Otros" },
  ];

  const postobonSubcuentas = [
    { value: "santa-rosa", label: "Santa Rosa" },
    { value: "cimitarra", label: "Cimitarra" },
  ];

  const updateInversionMutation = useMutation({
    mutationFn: async (data: InversionUpdateData) => {
      await apiRequest("PATCH", `/api/inversiones/${inversion.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Inversión actualizada",
        description: "La inversión se ha actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/inversiones/cuenta/${inversion.origen === 'rodmar' ? inversion.origenDetalle : inversion.origen}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/inversiones/cuenta/${inversion.destino === 'rodmar' ? inversion.destinoDetalle : inversion.destino}`] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la inversión",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InversionUpdateData) => {
    setIsSubmitting(true);
    try {
      await updateInversionMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!inversion) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
              <DialogTitle className="text-sm sm:text-base truncate">
                Editar Inversión
              </DialogTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {/* Origen */}
          <div className="space-y-1">
            <Label htmlFor="origen" className="text-xs font-medium">Origen</Label>
            <Select
              value={form.watch("origen")}
              onValueChange={(value) => {
                form.setValue("origen", value);
                setSelectedOrigen(value);
                form.setValue("origenDetalle", "");
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seleccionar origen" />
              </SelectTrigger>
              <SelectContent>
                {origenOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcuentas Origen RodMar */}
          {selectedOrigen === "rodmar" && (
            <div className="space-y-1">
              <Label htmlFor="origenDetalle" className="text-xs font-medium">Cuenta RodMar</Label>
              <Select
                value={form.watch("origenDetalle") || ""}
                onValueChange={(value) => form.setValue("origenDetalle", value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {rodmarSubcuentas.map((subcuenta) => (
                    <SelectItem key={subcuenta.value} value={subcuenta.value}>
                      {subcuenta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subcuentas Origen Postobón */}
          {selectedOrigen === "postobon" && (
            <div className="space-y-1">
              <Label htmlFor="origenDetalle" className="text-xs font-medium">Cuenta Postobón</Label>
              <Select
                value={form.watch("origenDetalle") || ""}
                onValueChange={(value) => form.setValue("origenDetalle", value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {postobonSubcuentas.map((subcuenta) => (
                    <SelectItem key={subcuenta.value} value={subcuenta.value}>
                      {subcuenta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Valor y Fecha en fila */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="valor" className="text-xs font-medium">Valor</Label>
              <Input
                {...form.register("valor")}
                type="number"
                placeholder="0"
                step="0.01"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fecha" className="text-xs font-medium">Fecha</Label>
              <Input
                {...form.register("fecha")}
                type="date"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Destino */}
          <div className="space-y-1">
            <Label htmlFor="destino" className="text-xs font-medium">Destino</Label>
            <Select
              value={form.watch("destino")}
              onValueChange={(value) => {
                form.setValue("destino", value);
                setSelectedDestino(value);
                if (value !== "postobon") {
                  form.setValue("destinoDetalle", "");
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seleccionar destino" />
              </SelectTrigger>
              <SelectContent>
                {destinoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcuentas Destino RodMar */}
          {selectedDestino === "rodmar" && (
            <div className="space-y-1">
              <Label htmlFor="destinoDetalle" className="text-xs font-medium">Cuenta RodMar</Label>
              <Select
                value={form.watch("destinoDetalle") || ""}
                onValueChange={(value) => form.setValue("destinoDetalle", value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {rodmarSubcuentas.map((subcuenta) => (
                    <SelectItem key={subcuenta.value} value={subcuenta.value}>
                      {subcuenta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subcuentas Destino Postobón */}
          {selectedDestino === "postobon" && (
            <div className="space-y-1">
              <Label htmlFor="destinoDetalle" className="text-xs font-medium">Cuenta Postobón</Label>
              <Select
                value={form.watch("destinoDetalle") || ""}
                onValueChange={(value) => form.setValue("destinoDetalle", value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {postobonSubcuentas.map((subcuenta) => (
                    <SelectItem key={subcuenta.value} value={subcuenta.value}>
                      {subcuenta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Concepto */}
          <div className="space-y-1">
            <Label htmlFor="concepto" className="text-xs font-medium">Concepto</Label>
            <Input
              {...form.register("concepto")}
              placeholder="Descripción de la inversión"
              className="h-8 text-sm"
            />
          </div>

          {/* Observaciones y Voucher en pestañas colapsibles */}
          <div className="space-y-2">
            <details className="group">
              <summary className="flex cursor-pointer items-center text-xs font-medium text-gray-600 hover:text-gray-800">
                <span>Opcionales (Observaciones, Voucher)</span>
                <X className="ml-2 h-3 w-3 rotate-45 transition-transform group-open:rotate-0" />
              </summary>
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="observaciones" className="text-xs">Observaciones</Label>
                  <Textarea
                    {...form.register("observaciones")}
                    placeholder="Observaciones adicionales"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="voucher" className="text-xs">Voucher</Label>
                  <Textarea
                    {...form.register("voucher")}
                    placeholder="Adjuntar voucher o comprobante"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 modal-buttons-container">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="h-8 text-sm"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || updateInversionMutation.isPending}
              className="h-8 text-sm bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isSubmitting ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}