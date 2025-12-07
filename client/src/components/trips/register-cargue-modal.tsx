import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useMinas, useCompradores } from "@/hooks/use-entities";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

const cargueSchema = z.object({
  fechaCargue: z.string().min(1, "Fecha es requerida"),
  conductor: z.string().min(1, "Conductor es requerido"),
  tipoCarro: z.string().min(1, "Tipo de carro es requerido"),
  placa: z.string().min(1, "Placa es requerida"),
  minaId: z.string().min(1, "Mina es requerida"),
  compradorId: z.string().min(1, "Comprador es requerido"),
  precioCompraTon: z.string().min(1, "Precio es requerido"),
});

type CargueFormData = z.infer<typeof cargueSchema>;

interface RegisterCargueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterCargueModal({ open, onOpenChange }: RegisterCargueModalProps) {
  const { data: minas = [] } = useMinas();
  const { data: compradores = [] } = useCompradores();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CargueFormData>({
    resolver: zodResolver(cargueSchema),
    defaultValues: {
      fechaCargue: (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })(),
      conductor: "",
      tipoCarro: "",
      placa: "",
      minaId: "",
      precioCompraTon: "",
    }
  });

  const createTripMutation = useMutation({
    mutationFn: async (data: CargueFormData) => {
      const response = await apiRequest("POST", "/api/viajes", {
        fechaCargue: new Date(data.fechaCargue + "T12:00:00"),
        conductor: data.conductor,
        tipoCarro: data.tipoCarro,
        placa: data.placa,
        minaId: parseInt(data.minaId),
        compradorId: parseInt(data.compradorId),
        precioCompraTon: data.precioCompraTon,
        estado: "pendiente"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/viajes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/pendientes"] });
      toast({
        title: "Cargue registrado",
        description: "El viaje se ha creado exitosamente",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo registrar el cargue. Verifica los datos.",
        variant: "destructive",
      });
      console.error("Error creating viaje:", error);
    }
  });

  const onSubmit = (data: CargueFormData) => {
    createTripMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-secondary-custom">
              Registrar Cargue
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="fechaCargue">Fecha</Label>
            <Input
              id="fechaCargue"
              type="date"
              {...form.register("fechaCargue")}
              className="mt-1"
            />
            {form.formState.errors.fechaCargue && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.fechaCargue.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="conductor">Conductor</Label>
            <Input
              id="conductor"
              placeholder="Nombre del conductor"
              {...form.register("conductor")}
              className="mt-1"
            />
            {form.formState.errors.conductor && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.conductor.message}
              </p>
            )}
          </div>
          
          <div>
            <Label>Tipo de Carro</Label>
            <Select onValueChange={(value) => form.setValue("tipoCarro", value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volqueta">Volqueta</SelectItem>
                <SelectItem value="tractomula">Tractomula</SelectItem>
                <SelectItem value="camion">Camión</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.tipoCarro && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.tipoCarro.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="placa">Placa</Label>
            <Input
              id="placa"
              placeholder="ABC-123"
              {...form.register("placa")}
              className="mt-1"
            />
            {form.formState.errors.placa && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.placa.message}
              </p>
            )}
          </div>
          
          <div>
            <Label>Mina</Label>
            <Select onValueChange={(value) => form.setValue("minaId", value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar mina" />
              </SelectTrigger>
              <SelectContent>
                {minas.map(mina => (
                  <SelectItem key={mina.id} value={mina.id.toString()}>
                    {mina.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.minaId && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.minaId.message}
              </p>
            )}
          </div>

          <div>
            <Label>Comprador</Label>
            <Select onValueChange={(value) => form.setValue("compradorId", value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar comprador" />
              </SelectTrigger>
              <SelectContent>
                {compradores.map(comprador => (
                  <SelectItem key={comprador.id} value={comprador.id.toString()}>
                    {comprador.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.compradorId && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.compradorId.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="precioCompraTon">Precio Compra x Ton.</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="precioCompraTon"
                type="text"
                inputMode="numeric"
                placeholder="0"
                {...form.register("precioCompraTon")}
                className="pl-8"
              />
            </div>
            {form.formState.errors.precioCompraTon && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.precioCompraTon.message}
              </p>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 btn-primary"
              disabled={createTripMutation.isPending}
            >
              {createTripMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
