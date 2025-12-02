import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCompradores } from "@/hooks/use-entities";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { Trip } from "@shared/schema";

const descargueSchema = z.object({
  tripId: z.string().min(1, "Viaje es requerido"),
  fechaDescargue: z.string().min(1, "Fecha es requerida"),
  compradorId: z.string().min(1, "Comprador es requerido"),
  peso: z.string().min(1, "Peso es requerido"),
  ventaTon: z.string().min(1, "Venta por tonelada es requerida"),
  fleteTon: z.string().min(1, "Flete por tonelada es requerido"),
  recibo: z.string().optional(),
});

type DescargueFormData = z.infer<typeof descargueSchema>;

interface RegisterDescargueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterDescargueModal({ open, onOpenChange }: RegisterDescargueModalProps) {
  const { data: compradores = [] } = useCompradores();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingTrips = [] } = useQuery<Trip[]>({
    queryKey: ["/api/trips/pending"],
    enabled: open,
  });

  const form = useForm<DescargueFormData>({
    resolver: zodResolver(descargueSchema),
    defaultValues: {
      tripId: "",
      fechaDescargue: (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })(),
      compradorId: "",
      peso: "",
      ventaTon: "",
      fleteTon: "",
      recibo: "",
    }
  });

  const updateTripMutation = useMutation({
    mutationFn: async (data: DescargueFormData) => {
      const peso = parseFloat(data.peso);
      const ventaTon = parseFloat(data.ventaTon);
      const fleteTon = parseFloat(data.fleteTon);
      
      // Get trip to calculate based on precioCompraTon
      const trip = pendingTrips.find(t => t.id === data.tripId);
      const precioCompraTon = parseFloat(trip?.precioCompraTon || "0");
      
      // Financial calculations
      const totalVenta = peso * ventaTon;
      const totalFlete = peso * fleteTon;
      const totalCompra = peso * precioCompraTon;
      const valorConsignar = totalVenta - totalFlete;
      const ganancia = valorConsignar - totalCompra;

      const response = await apiRequest("PUT", `/api/trips/${data.tripId}`, {
        fechaDescargue: new Date(data.fechaDescargue + "T12:00:00"),
        compradorId: parseInt(data.compradorId),
        peso: data.peso,
        ventaTon: data.ventaTon,
        fleteTon: data.fleteTon,
        recibo: data.recibo,
        totalVenta: totalVenta.toString(),
        totalFlete: totalFlete.toString(),
        totalCompra: totalCompra.toString(),
        valorConsignar: valorConsignar.toString(),
        ganancia: ganancia.toString(),
        status: "completado"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/pending"] });
      toast({
        title: "Descargue registrado",
        description: "El viaje se ha completado exitosamente",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: DescargueFormData) => {
    updateTripMutation.mutate(data);
  };

  // Calculate totals for preview
  const selectedTrip = pendingTrips.find(t => t.id === form.watch("tripId"));
  const peso = parseFloat(form.watch("peso") || "0");
  const ventaTon = parseFloat(form.watch("ventaTon") || "0");
  const fleteTon = parseFloat(form.watch("fleteTon") || "0");
  const precioCompraTon = parseFloat(selectedTrip?.precioCompraTon || "0");

  const totalVenta = peso * ventaTon;
  const totalFlete = peso * fleteTon;
  const totalCompra = peso * precioCompraTon;
  const valorConsignar = totalVenta - totalFlete;
  const ganancia = valorConsignar - totalCompra;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-secondary-custom">
              Registrar Descargue
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
            <Label>Viaje Pendiente</Label>
            <Select onValueChange={(value) => form.setValue("tripId", value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar viaje" />
              </SelectTrigger>
              <SelectContent>
                {pendingTrips.map(trip => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.id} - {trip.conductor} ({trip.placa})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.tripId && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.tripId.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="fechaDescargue">Fecha Descargue</Label>
            <Input
              id="fechaDescargue"
              type="date"
              {...form.register("fechaDescargue")}
              className="mt-1"
            />
            {form.formState.errors.fechaDescargue && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.fechaDescargue.message}
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
            <Label htmlFor="peso">Peso (Toneladas)</Label>
            <Input
              id="peso"
              type="number"
              step="0.1"
              placeholder="0.0"
              {...form.register("peso")}
              className="mt-1"
            />
            {form.formState.errors.peso && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.peso.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="ventaTon">Venta x Ton.</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="ventaTon"
                type="number"
                placeholder="0"
                {...form.register("ventaTon")}
                className="pl-8"
              />
            </div>
            {form.formState.errors.ventaTon && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.ventaTon.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="fleteTon">Flete x Ton.</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="fleteTon"
                type="number"
                placeholder="0"
                {...form.register("fleteTon")}
                className="pl-8"
              />
            </div>
            {form.formState.errors.fleteTon && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.fleteTon.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="recibo">Recibo (Opcional)</Label>
            <Input
              id="recibo"
              placeholder="Número de recibo"
              {...form.register("recibo")}
              className="mt-1"
            />
          </div>

          {/* Calculation Preview */}
          {peso > 0 && ventaTon > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Cálculos automáticos:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Total Venta:</span>
                  <span className="ml-2 font-medium">{formatCurrency(totalVenta)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Flete:</span>
                  <span className="ml-2 font-medium">{formatCurrency(totalFlete)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Compra:</span>
                  <span className="ml-2 font-medium">{formatCurrency(totalCompra)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Valor a Consignar:</span>
                  <span className="ml-2 font-medium">{formatCurrency(valorConsignar)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Ganancia:</span>
                  <span className={`ml-2 font-medium ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(ganancia)}
                  </span>
                </div>
              </div>
            </div>
          )}

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
              disabled={updateTripMutation.isPending}
            >
              {updateTripMutation.isPending ? "Completando..." : "Completar Viaje"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
