import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Edit, Calculator } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateTripRelatedQueries, type TripChangeInfo } from "@/lib/invalidate-trip-queries";
import { useToast } from "@/hooks/use-toast";
import { calculateTripFinancials, formatCurrency } from "@/lib/calculations";
import type { ViajeWithDetails, Comprador } from "@shared/schema";

const editTripSchema = z.object({
  conductor: z.string().min(1, "Conductor requerido"),
  tipoCarro: z.string().min(1, "Tipo de carro requerido"),
  placa: z.string().min(1, "Placa requerida"),
  fechaCargue: z.string().min(1, "Fecha de cargue requerida"),
  fechaDescargue: z.string().optional(),
  precioCompraTon: z.string().min(1, "Precio compra requerido"),
  compradorId: z.string().optional(),
  peso: z.string().optional(),
  ventaTon: z.string().optional(),
  fleteTon: z.string().optional(),
  recibo: z.string().optional(),
});

type EditTripFormData = z.infer<typeof editTripSchema>;

interface TripEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: ViajeWithDetails;
}

export default function TripEditModal({ open, onOpenChange, trip }: TripEditModalProps) {
  const { toast } = useToast();

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
  });

  const form = useForm<EditTripFormData>({
    resolver: zodResolver(editTripSchema),
    defaultValues: {
      conductor: trip.conductor,
      tipoCarro: trip.tipoCarro,
      placa: trip.placa,
      fechaCargue: trip.fechaCargue ? new Date(trip.fechaCargue).toISOString().split('T')[0] : "",
      fechaDescargue: trip.fechaDescargue ? new Date(trip.fechaDescargue).toISOString().split('T')[0] : "",
      precioCompraTon: trip.precioCompraTon?.toString() || "",
      compradorId: trip.compradorId?.toString() || "",
      peso: trip.peso?.toString() || "",
      ventaTon: trip.ventaTon?.toString() || "",
      fleteTon: trip.fleteTon?.toString() || "",
      recibo: trip.recibo || "",
    },
  });

  // Watch form values for real-time calculations
  const watchedValues = form.watch();
  
  const calculations = watchedValues.peso && watchedValues.ventaTon && watchedValues.fleteTon && watchedValues.precioCompraTon
    ? calculateTripFinancials({
        peso: parseFloat(watchedValues.peso),
        precioCompraTon: parseFloat(watchedValues.precioCompraTon),
        ventaTon: parseFloat(watchedValues.ventaTon),
        fleteTon: parseFloat(watchedValues.fleteTon),
      })
    : null;

  const updateTripMutation = useMutation({
    mutationFn: async (data: EditTripFormData) => {
      const updateData: any = {
        conductor: data.conductor,
        tipoCarro: data.tipoCarro,
        placa: data.placa,
        fechaCargue: new Date(data.fechaCargue + 'T00:00:00').toISOString(),
        precioCompraTon: data.precioCompraTon,
      };

      // Add descargue data if present
      if (data.fechaDescargue) {
        updateData.fechaDescargue = new Date(data.fechaDescargue + 'T00:00:00').toISOString();
      }
      if (data.compradorId) {
        updateData.compradorId = data.compradorId;
      }
      if (data.peso && data.ventaTon && data.fleteTon && calculations) {
        updateData.peso = data.peso;
        updateData.ventaTon = data.ventaTon;
        updateData.fleteTon = data.fleteTon;
        updateData.recibo = data.recibo || "";
        updateData.totalVenta = calculations.totalVenta.toString();
        updateData.totalCompra = calculations.totalCompra.toString();
        updateData.totalFlete = calculations.totalFlete.toString();
        updateData.valorConsignar = calculations.valorConsignar.toString();
        updateData.ganancia = calculations.ganancia.toString();
        updateData.vut = calculations.vut.toString();
        updateData.cut = calculations.cut.toString();
        updateData.fut = calculations.fut.toString();
        updateData.estado = "completado";
      }

      const response = await apiRequest("PATCH", `/api/viajes/${trip.id}`, updateData);
      return response.json();
    },
    onSuccess: async (updatedViaje) => {
      // Preparar información del cambio para invalidar queries específicas
      const tripChangeInfo: TripChangeInfo = {
        oldMinaId: trip?.minaId || null,
        oldCompradorId: trip?.compradorId || null,
        oldConductor: trip?.conductor || null,
        newMinaId: updatedViaje?.minaId || null,
        newCompradorId: updatedViaje?.compradorId || null,
        newConductor: updatedViaje?.conductor || null,
      };
      
      // Usar función optimizada para invalidar todas las queries relacionadas
      invalidateTripRelatedQueries(queryClient, tripChangeInfo);
      
      toast({
        title: "Viaje actualizado",
        description: "Los datos del viaje han sido actualizados exitosamente en todos los módulos.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el viaje. " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditTripFormData) => {
    updateTripMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Viaje - {trip.id}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Datos del Cargue */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Datos del Cargue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="conductor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conductor</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nombre del conductor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipoCarro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Carro</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="volqueta">Volqueta</SelectItem>
                            <SelectItem value="turbo">Turbo</SelectItem>
                            <SelectItem value="minimula">Minimula</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="placa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABC123" className="uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fechaCargue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Cargue</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="precioCompraTon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Compra (por tonelada)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="140000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Datos del Descargue */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Datos del Descargue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fechaDescargue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Descargue</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="compradorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comprador</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar comprador" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {compradores.map((comprador) => (
                              <SelectItem key={comprador.id} value={comprador.id.toString()}>
                                {comprador.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="peso"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (Toneladas)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.1" placeholder="25.5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ventaTon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Venta (por tonelada)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="150000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fleteTon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flete (por tonelada)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="15000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recibo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recibo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Número de recibo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Cálculos Automáticos */}
            {calculations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Cálculos Automáticos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Total Venta</p>
                      <p className="font-semibold">{formatCurrency(calculations.totalVenta)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Total Compra</p>
                      <p className="font-semibold">{formatCurrency(calculations.totalCompra)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Total Flete</p>
                      <p className="font-semibold">{formatCurrency(calculations.totalFlete)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Ganancia</p>
                      <p className="font-semibold text-green-600">{formatCurrency(calculations.ganancia)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateTripMutation.isPending}
              >
                {updateTripMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}