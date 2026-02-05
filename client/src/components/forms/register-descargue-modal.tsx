import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptImageUpload } from "@/components/ui/receipt-image-upload";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateTripRelatedQueries, type TripChangeInfo } from "@/lib/invalidate-trip-queries";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { calculateTripFinancials } from "@/lib/calculations";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import type { ViajeWithDetails, Comprador } from "@shared/schema";

const formSchema = z.object({
  viajeId: z.string().min(1, "Debe seleccionar un viaje pendiente"),
  fechaDescargue: z.string().min(1, "La fecha de descargue es requerida"),
  compradorId: z.string().min(1, "El comprador es requerido"),
  peso: z.string().min(1, "El peso es requerido"),
  ventaTon: z.string().min(1, "El precio de venta es requerido"),
  fleteTon: z.string().min(1, "El precio del flete es requerido"),
  otrosGastosFlete: z.string().optional(),
  quienPagaFlete: z.enum(["tu", "comprador"], {
    required_error: "Debe seleccionar quién paga el flete",
  }),
  recibo: z.string().optional(),
  observaciones: z.string().optional(),
});

interface RegisterDescargueModalProps {
  open: boolean;
  onClose: () => void;
}

// Función para formatear números con separadores de miles
const formatNumber = (value: string): string => {
  const normalized = String(value ?? '').trim();
  // Si viene de Postgres NUMERIC(10,2) típicamente llega como "80000.00" -> no debe multiplicar x100
  const withoutDbDecimals = /^\d+\.\d{2}$/.test(normalized) ? normalized.split('.')[0] : normalized;
  const numbers = withoutDbDecimals.replace(/[^\d]/g, '');
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Función para obtener el valor numérico sin formato
const getNumericValue = (formattedValue: string): string => {
  const normalized = String(formattedValue ?? '').trim();
  const withoutDbDecimals = /^\d+\.\d{2}$/.test(normalized) ? normalized.split('.')[0] : normalized;
  return withoutDbDecimals.replace(/[^\d]/g, '');
};

export default function RegisterDescargueModal({ open, onClose }: RegisterDescargueModalProps) {
  const { toast } = useToast();
  const { has } = usePermissions();
  const canViewCalculos = has("action.VIAJES.descargue.calculos.view");
  const [formKey, setFormKey] = useState(0);
  
  const { data: viajesPendientes = [], isLoading: loadingViajes } = useQuery<ViajeWithDetails[]>({
    queryKey: ["/api/viajes/pendientes"],
    refetchInterval: open ? 5000 : false, // Only refresh when modal is open
    enabled: open, // Only run query when modal is open
  });
  
  console.log("RegisterDescargueModal - viajes pendientes:", viajesPendientes);

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
    enabled: open, // Only run query when modal is open
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      viajeId: "",
      fechaDescargue: (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })(),
      compradorId: "",
      peso: "",
      ventaTon: "",
      fleteTon: "",
      otrosGastosFlete: "",
      quienPagaFlete: "comprador",
      recibo: "",
      observaciones: "",
    },
  });

  // Reset form when modal closes and force rerender
  useEffect(() => {
    if (!open) {
      form.reset();
      setFormKey(prev => prev + 1);
    }
  }, [open, form]);

  // Watch form values for real-time calculations
  const watchedValues = form.watch();
  const selectedViaje = viajesPendientes.find(v => v.id === watchedValues.viajeId);

  useEffect(() => {
    if (!watchedValues.compradorId) return;
    const selectedComprador = compradores.find(
      (c) => c.id.toString() === watchedValues.compradorId,
    );
    if (!selectedComprador) return;
    const defaultValue = selectedComprador.ventaTonDefault ?? "0";
    form.setValue("ventaTon", getNumericValue(String(defaultValue)), { shouldDirty: false });
  }, [watchedValues.compradorId, compradores, form]);

  useEffect(() => {
    if (!watchedValues.compradorId) return;
    const selectedComprador = compradores.find(
      (c) => c.id.toString() === watchedValues.compradorId,
    );
    if (!selectedComprador) return;

    const currentDefault = (selectedComprador.quienPagaFleteDefault === "tu" ? "tu" : "comprador") as
      | "tu"
      | "comprador";

    // No pisar si el usuario ya tocó el campo
    const quienDirty = form.getFieldState("quienPagaFlete").isDirty;
    if (!quienDirty) {
      form.setValue("quienPagaFlete", currentDefault, { shouldDirty: false });
    }
  }, [watchedValues.compradorId, compradores, form]);

  useEffect(() => {
    if (!selectedViaje) return;
    if (!watchedValues.compradorId) return;

    const selectedComprador = compradores.find(
      (c) => c.id.toString() === watchedValues.compradorId,
    );
    if (!selectedComprador) return;

    const tipoCarro = (selectedViaje.tipoCarro || "").toLowerCase();
    const isDobleTroque = tipoCarro.includes("doble");

    const fleteDefault = isDobleTroque
      ? (selectedComprador.fleteTonDefaultDobleTroque ?? "0")
      : (selectedComprador.fleteTonDefaultSencillo ?? "0");
    const otgDefault = isDobleTroque
      ? (selectedComprador.otgDefaultDobleTroque ?? "0")
      : (selectedComprador.otgDefaultSencillo ?? "0");

    // No pisar si el usuario ya tocó los campos
    const fleteDirty = form.getFieldState("fleteTon").isDirty;
    const otgDirty = form.getFieldState("otrosGastosFlete").isDirty;

    if (!fleteDirty) {
      form.setValue("fleteTon", getNumericValue(String(fleteDefault)), { shouldDirty: false });
    }
    if (!otgDirty) {
      form.setValue("otrosGastosFlete", getNumericValue(String(otgDefault)), { shouldDirty: false });
    }
  }, [selectedViaje?.id, selectedViaje?.tipoCarro, watchedValues.compradorId, compradores, form]);

  const calculations = selectedViaje && watchedValues.peso && watchedValues.ventaTon && watchedValues.fleteTon 
    ? calculateTripFinancials({
        peso: parseFloat(watchedValues.peso),
        precioCompraTon: parseFloat(selectedViaje.precioCompraTon),
        ventaTon: parseFloat(watchedValues.ventaTon),
        fleteTon: parseFloat(watchedValues.fleteTon),
        otrosGastosFlete: parseFloat(watchedValues.otrosGastosFlete || "0"),
      })
    : null;

  // Calcular valor a consignar basado en quién paga el flete
  const valorConsignar = calculations ? 
    (watchedValues.quienPagaFlete === "tu" ? calculations.totalVenta : calculations.valorConsignar)
    : 0;

  const updateViajeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!calculations) throw new Error("No se pudieron calcular los valores");
      

      const updateData = {
        fechaDescargue: new Date(data.fechaDescargue + 'T00:00:00').toISOString(),
        compradorId: data.compradorId,
        peso: data.peso,
        ventaTon: data.ventaTon,
        fleteTon: data.fleteTon,
        otrosGastosFlete: data.otrosGastosFlete || "0",
        recibo: data.recibo || "",
        observaciones: data.observaciones || "",
        totalVenta: calculations.totalVenta.toString(),
        totalCompra: calculations.totalCompra.toString(),
        totalFlete: calculations.totalFlete.toString(),
        valorConsignar: (data.quienPagaFlete === "tu" ? calculations.totalVenta : calculations.valorConsignar).toString(),
        ganancia: calculations.ganancia.toString(),
        vut: calculations.vut.toString(),
        cut: calculations.cut.toString(),
        fut: calculations.fut.toString(),
        quienPagaFlete: data.quienPagaFlete,
        estado: "completado",
      };
      
      const response = await apiRequest("PATCH", `/api/viajes/${data.viajeId}`, updateData);
      return response.json();
    },
    onSuccess: async (updatedViaje, variables) => {
      // Obtener información del viaje antes del cambio (si está disponible)
      const tripChangeInfo: TripChangeInfo = {
        oldMinaId: selectedViaje?.minaId || null,
        oldCompradorId: selectedViaje?.compradorId || null,
        oldConductor: selectedViaje?.conductor || null,
        newMinaId: updatedViaje?.minaId || null,
        newCompradorId: updatedViaje?.compradorId || null,
        newConductor: updatedViaje?.conductor || null,
      };
      
      // Actualizar defaults si el usuario cambió precios en el modal:
      // - Venta por tonelada (si aplica)
      // - Flete/OTG por comprador + tipo de carro (Sencillo / Doble Troque)
      const selectedComprador = compradores.find(
        (c) => c.id.toString() === variables.compradorId,
      );
      if (selectedComprador) {
        const patch: Record<string, string> = {};

        const usedVenta = getNumericValue(String(variables.ventaTon || "0"));
        const currentVenta = getNumericValue(String(selectedComprador.ventaTonDefault ?? "0"));
        if (usedVenta !== currentVenta) {
          patch.ventaTonDefault = usedVenta;
        }

        const tipoCarro = (selectedViaje?.tipoCarro || "").toLowerCase();
        const isDobleTroque = tipoCarro.includes("doble");
        const usedFlete = getNumericValue(String(variables.fleteTon || "0"));
        const usedOtg = getNumericValue(String(variables.otrosGastosFlete || "0"));

        const currentFlete = getNumericValue(
          String(
            isDobleTroque
              ? (selectedComprador.fleteTonDefaultDobleTroque ?? "0")
              : (selectedComprador.fleteTonDefaultSencillo ?? "0"),
          ),
        );
        const currentOtg = getNumericValue(
          String(
            isDobleTroque
              ? (selectedComprador.otgDefaultDobleTroque ?? "0")
              : (selectedComprador.otgDefaultSencillo ?? "0"),
          ),
        );

        if (usedFlete !== currentFlete) {
          patch[isDobleTroque ? "fleteTonDefaultDobleTroque" : "fleteTonDefaultSencillo"] = usedFlete;
        }
        if (usedOtg !== currentOtg) {
          patch[isDobleTroque ? "otgDefaultDobleTroque" : "otgDefaultSencillo"] = usedOtg;
        }

        const usedQuien = variables.quienPagaFlete;
        const currentQuien = (selectedComprador.quienPagaFleteDefault === "tu" ? "tu" : "comprador") as
          | "tu"
          | "comprador";
        if (usedQuien !== currentQuien) {
          patch.quienPagaFleteDefault = usedQuien;
        }

        if (Object.keys(patch).length > 0) {
          try {
            await apiRequest("PATCH", `/api/compradores/${selectedComprador.id}/precios`, patch);
            queryClient.invalidateQueries({ queryKey: [`/api/compradores/${selectedComprador.id}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
          } catch (error) {
            console.warn("No se pudo actualizar defaults del comprador:", error);
          }
        }
      }

      // Usar función optimizada para invalidar todas las queries relacionadas
      invalidateTripRelatedQueries(queryClient, tripChangeInfo);
      
      form.reset();
      onClose();
      toast({
        title: "Descargue registrado",
        description: "El viaje se ha completado exitosamente y todas las transacciones relacionadas se han actualizado.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo registrar el descargue.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    try {
      updateViajeMutation.mutate(data);
    } catch (error) {
      console.log('Submit error suppressed:', error);
      toast({
        title: "Error en el formulario",
        description: "Ha ocurrido un error al procesar el formulario.",
        variant: "destructive",
      });
    }
  };

  if (!open) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-md flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Registrar Descargue</DialogTitle>
                <p className="text-xs text-muted-foreground">Completar información del viaje</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form key={formKey} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-3">
            {/* Selección de Viaje - Una fila */}
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-200 dark:border-emerald-800">
              <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">🚛 Viaje:</h3>
              <FormField
                control={form.control}
                name="viajeId"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar viaje pendiente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingViajes ? (
                          <SelectItem value="loading" disabled>
                            Cargando viajes...
                          </SelectItem>
                        ) : viajesPendientes.length === 0 ? (
                          <SelectItem value="no-viajes" disabled>
                            No hay viajes pendientes
                          </SelectItem>
                        ) : (
                          viajesPendientes.map((viaje) => (
                            <SelectItem key={viaje.id} value={viaje.id}>
                              {viaje.id} - {viaje.conductor} ({viaje.placa}) - {viaje.mina?.nombre || 'Sin mina'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Información de Descargue - Layout compacto */}
            <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 pb-2 border-b border-blue-200 dark:border-blue-700">📦 Descargue</h3>
              
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="fechaDescargue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-8 text-xs" {...field} />
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
                      <FormLabel className="text-xs">Comprador</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Seleccionar" />
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
                      <FormLabel className="text-xs">Peso (Ton)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="25.5" className="h-8 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {/* Precios - Layout compacto */}
            <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300 pb-2 border-b border-amber-200 dark:border-amber-700">💰 Precios</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="ventaTon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Venta/Ton ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          inputMode="numeric"
                          placeholder="0" 
                          className="h-8 text-xs" 
                          value={formatNumber(field.value)}
                          onChange={(e) => {
                            const formattedValue = formatNumber(e.target.value);
                            const numericValue = getNumericValue(formattedValue);
                            field.onChange(numericValue);
                          }}
                        />
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
                      <FormLabel className="text-xs">Flete/Ton ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          inputMode="numeric"
                          placeholder="0" 
                          className="h-8 text-xs" 
                          value={formatNumber(field.value)}
                          onChange={(e) => {
                            const formattedValue = formatNumber(e.target.value);
                            const numericValue = getNumericValue(formattedValue);
                            field.onChange(numericValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="otrosGastosFlete"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Otros Gastos ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          inputMode="numeric"
                          placeholder="0" 
                          className="h-8 text-xs" 
                          value={formatNumber(field.value || '')}
                          onChange={(e) => {
                            const formattedValue = formatNumber(e.target.value);
                            const numericValue = getNumericValue(formattedValue);
                            field.onChange(numericValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="quienPagaFlete"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">¿Quién Paga?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tu">RodMar</SelectItem>
                          <SelectItem value="comprador">Comprador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {/* Adicionales - Layout compacto */}
            <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 pb-2 border-b border-purple-200 dark:border-purple-700">📋 Adicionales</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="recibo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Recibo</FormLabel>
                      <FormControl>
                        <ReceiptImageUpload
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Número de recibo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="observaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Observaciones</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notas adicionales..." 
                          className="text-xs min-h-[60px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {calculations && canViewCalculos && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium">Cálculos Automáticos:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Venta:</span>
                    <p className="font-medium text-success">{formatCurrency(calculations.totalVenta)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Compra:</span>
                    <p className="font-medium text-error">{formatCurrency(calculations.totalCompra)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Flete:</span>
                    <p className="font-medium text-warning">{formatCurrency(calculations.totalFlete)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor a Consignar:</span>
                    <p className="font-medium text-primary">{formatCurrency(valorConsignar)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ganancia:</span>
                    <p className="font-medium text-primary">{formatCurrency(calculations.ganancia)}</p>
                  </div>
                </div>
                {watchedValues.quienPagaFlete === "tu" && (
                  <div className="text-xs text-muted-foreground mt-2 p-2 bg-blue-50 rounded">
                    <strong>Nota:</strong> RodMar paga el flete. El valor a consignar es igual al total de venta.
                  </div>
                )}
                {watchedValues.quienPagaFlete === "comprador" && (
                  <div className="text-xs text-muted-foreground mt-2 p-2 bg-orange-50 rounded">
                    <strong>Nota:</strong> El comprador paga el flete. Se registrará una transacción negativa para el comprador.
                  </div>
                )}
              </div>
            )}
            
            <div className="modal-buttons-container flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={updateViajeMutation.isPending || !calculations}
              >
                {updateViajeMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
