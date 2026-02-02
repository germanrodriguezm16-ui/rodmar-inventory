import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReceiptImageUpload } from "@/components/ui/receipt-image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { invalidateTripRelatedQueries } from "@/lib/invalidate-trip-queries";
import { formatCurrency } from "@/lib/utils";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import type { ViajeWithDetails, Mina, Comprador, updateViajeSchema } from "@shared/schema";

interface VolqueteroConPlacas {
  id: number;
  nombre: string;
  saldo: string;
  viajesCount: number;
  placas: Array<{
    placa: string;
    tipoCarro: string;
    viajesCount: number;
  }>;
}

const editTripSchema = z.object({
  fechaCargue: z.string(),
  fechaDescargue: z.string().optional(),
  conductor: z.string().min(1, "El conductor es requerido"),
  placa: z.string().min(1, "La placa es requerida"),
  tipoCarro: z.string().min(1, "El tipo de carro es requerido"),
  minaId: z.coerce.number({ required_error: "La mina es requerida" }),
  compradorId: z.coerce.number({ required_error: "El comprador es requerido" }),
  peso: z.coerce.number().min(0.1, "El peso debe ser mayor a 0"),
  precioCompraTon: z.coerce.number().min(0, "El precio de compra debe ser mayor a 0"),
  ventaTon: z.coerce.number().min(0, "El precio de venta debe ser mayor a 0"),
  fleteTon: z.coerce.number().min(0, "El flete debe ser mayor a 0"),
  otrosGastosFlete: z.coerce.number().optional(),
  quienPagaFlete: z.string({
    required_error: "Debe seleccionar quién paga el flete",
  }),
  observaciones: z.string().optional(),
  recibo: z.string().optional(),
});

type EditTripFormData = z.infer<typeof editTripSchema>;

interface EditTripModalProps {
  viaje: ViajeWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditTripModal({ viaje, isOpen, onClose }: EditTripModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userClearedReceipt, setUserClearedReceipt] = useState(false);
  
  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredVolqueteros, setFilteredVolqueteros] = useState<VolqueteroConPlacas[]>([]);
  const [filteredPlacas, setFilteredPlacas] = useState<Array<{
    conductor: string;
    placa: string;
    tipoCarro: string;
    viajesCount: number;
  }>>([]);

  console.log("=== EditTripModal render - isOpen:", isOpen, "viaje:", viaje?.id, "timestamp:", Date.now());

  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
  });

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
  });

  const { data: volqueteros = [] } = useQuery<VolqueteroConPlacas[]>({
    queryKey: ["/api/volqueteros"],
    enabled: isOpen, // Only run query when modal is open
  });

  // Helper function to safely format dates
  const formatDateForInput = (dateValue: any): string => {
    if (!dateValue) return "";
    try {
      if (typeof dateValue === 'string') {
        // If it's already a string, check if it's an ISO date
        if (dateValue.includes('T')) {
          return dateValue.split('T')[0];
        }
        // If it's a YYYY-MM-DD format, return as is
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateValue;
        }
        // Try to parse it as a date
        return new Date(dateValue).toISOString().split('T')[0];
      }
      // If it's a Date object
      return new Date(dateValue).toISOString().split('T')[0];
    } catch (error) {
      console.warn("Error formatting date:", dateValue, error);
      return "";
    }
  };

  // Helper function to safely convert to number
  const toNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const form = useForm<EditTripFormData>({
    resolver: zodResolver(editTripSchema),
    defaultValues: {
      fechaCargue: formatDateForInput(viaje?.fechaCargue),
      fechaDescargue: formatDateForInput(viaje?.fechaDescargue),
      conductor: viaje?.conductor || "",
      placa: viaje?.placa || "",
      tipoCarro: viaje?.tipoCarro || "Sencillo",
      minaId: viaje?.minaId || undefined,
      compradorId: viaje?.compradorId || undefined,
      peso: toNumber(viaje?.peso),
      precioCompraTon: toNumber(viaje?.precioCompraTon),
      ventaTon: toNumber(viaje?.ventaTon),
      fleteTon: toNumber(viaje?.fleteTon),
      otrosGastosFlete: toNumber(viaje?.otrosGastosFlete),
      quienPagaFlete: viaje?.quienPagaFlete || "comprador",
      observaciones: viaje?.observaciones || "",
      recibo: viaje?.recibo || "",
    },
  });

  // Reset form when viaje changes
  React.useEffect(() => {
    if (viaje && isOpen) {
      console.log("=== EditTripModal - Loading viaje data:", JSON.stringify(viaje, null, 2));
      console.log("=== EditTripModal - fechaCargue value:", viaje.fechaCargue, "Type:", typeof viaje.fechaCargue);
      console.log("=== EditTripModal - fechaDescargue value:", viaje.fechaDescargue, "Type:", typeof viaje.fechaDescargue);
      console.log("=== EditTripModal - quienPagaFlete value:", JSON.stringify(viaje.quienPagaFlete));
      console.log("=== EditTripModal - Observaciones value:", viaje.observaciones);
      console.log("=== EditTripModal - Recibo value:", viaje.recibo, "Type:", typeof viaje.recibo);
      
      // Debug formatted dates
      console.log("=== Formatted fechaCargue:", formatDateForInput(viaje?.fechaCargue));
      console.log("=== Formatted fechaDescargue:", formatDateForInput(viaje?.fechaDescargue));
      
      if (viaje.id === "TRP007") {
        console.log("=== SPECIAL DEBUG FOR TRP007 ===");
        console.log("TRP007 full viaje object:", JSON.stringify(viaje, null, 2));
        console.log("TRP007 recibo field specifically:", viaje.recibo);
        console.log("TRP007 recibo length:", viaje.recibo ? viaje.recibo.length : "null/undefined");
      }
      
      if (viaje.id === "A2") {
        console.log("=== SPECIAL DEBUG FOR A2 ===");
        console.log("A2 full viaje object:", JSON.stringify(viaje, null, 2));
        console.log("A2 fechaCargue specifically:", viaje.fechaCargue);
        console.log("A2 fechaDescargue specifically:", viaje.fechaDescargue);
        console.log("A2 formatted fechaCargue:", formatDateForInput(viaje?.fechaCargue));
        console.log("A2 formatted fechaDescargue:", formatDateForInput(viaje?.fechaDescargue));
      }
      
      const formData = {
        fechaCargue: viaje.fechaCargue ? new Date(viaje.fechaCargue).toISOString().split('T')[0] : "",
        fechaDescargue: viaje.fechaDescargue ? new Date(viaje.fechaDescargue).toISOString().split('T')[0] : "",
        conductor: viaje.conductor || "",
        placa: viaje.placa || "",
        tipoCarro: viaje.tipoCarro || "Sencillo",
        minaId: viaje.minaId || 1,
        compradorId: viaje.compradorId || 1,
        peso: parseFloat(viaje.peso || "0"),
        precioCompraTon: parseFloat(viaje.precioCompraTon || "0"),
        ventaTon: parseFloat(viaje.ventaTon || "0"),
        fleteTon: parseFloat(viaje.fleteTon || "0"),
        otrosGastosFlete: parseFloat(viaje.otrosGastosFlete || "0"),
        quienPagaFlete: viaje.quienPagaFlete === "tu" || viaje.quienPagaFlete === "RodMar" ? "tu" : "comprador", // Mapear "RodMar" de BD a "tu" en formulario
        observaciones: viaje.observaciones || "",
        recibo: viaje.recibo || "",
      };
      
      console.log("=== EditTripModal - Form data to load:", formData);
      form.reset(formData);
      
      form.reset(formData);
      setUserClearedReceipt(false);
    }
  }, [viaje, isOpen, form]);

  // Reset autocomplete state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowSuggestions(false);
      setFilteredVolqueteros([]);
      setFilteredPlacas([]);
    }
  }, [isOpen]);

  // Filter volqueteros and their placas based on conductor input
  const handleConductorChange = (value: string) => {
    form.setValue("conductor", value);
    
    if (value.length > 0) {
      // Filter conductors by name
      const filteredConductors = volqueteros.filter(volquetero =>
        volquetero.nombre.toLowerCase().includes(value.toLowerCase())
      );
      
      // Create flat list of all placas that match the search
      const allMatchingPlacas: Array<{
        conductor: string;
        placa: string;
        tipoCarro: string;
        viajesCount: number;
      }> = [];
      
      filteredConductors.forEach(conductor => {
        conductor.placas.forEach(placaInfo => {
          allMatchingPlacas.push({
            conductor: conductor.nombre,
            placa: placaInfo.placa,
            tipoCarro: placaInfo.tipoCarro,
            viajesCount: placaInfo.viajesCount
          });
        });
      });
      
      setFilteredVolqueteros(filteredConductors);
      setFilteredPlacas(allMatchingPlacas);
      setShowSuggestions(allMatchingPlacas.length > 0);
    } else {
      setFilteredVolqueteros([]);
      setFilteredPlacas([]);
      setShowSuggestions(false);
    }
  };

  // Handle placa selection - fills both conductor and placa fields
  const handlePlacaSelect = (placaInfo: {
    conductor: string;
    placa: string;
    tipoCarro: string;
    viajesCount: number;
  }) => {
    form.setValue("conductor", placaInfo.conductor);
    form.setValue("placa", placaInfo.placa);
    
    // Force update tipoCarro using the form's trigger to ensure proper re-render
    form.setValue("tipoCarro", placaInfo.tipoCarro);
    form.trigger("tipoCarro");
    
    setShowSuggestions(false);
    setFilteredVolqueteros([]);
    setFilteredPlacas([]);
  };

  const mutation = useMutation({
    mutationFn: async (data: EditTripFormData) => {
      if (!viaje) throw new Error("No hay viaje para editar");
      
      console.log("=== EditTripModal - Sending data:", data);
      
      const response = await apiRequest("PATCH", `/api/viajes/${viaje.id}`, data);
      if (!response.ok) {
        const errorData = await response.text();
        
        // Handle specific error for imported trips
        if (errorData.includes("not found") && errorData.includes("imported trip")) {
          throw new Error(`Este viaje importado de Excel ya no está disponible. El servidor se reinició y los datos importados se perdieron. Por favor, reimporta el archivo Excel para recuperar los datos.`);
        }
        
        throw new Error(`Error ${response.status}: ${errorData}`);
      }
      return response.json();
    },
    onSuccess: async (updatedViaje) => {
      // Preparar información del cambio para invalidar queries específicas
      const tripChangeInfo: TripChangeInfo = {
        oldMinaId: viaje?.minaId || null,
        oldCompradorId: viaje?.compradorId || null,
        oldConductor: viaje?.conductor || null,
        newMinaId: updatedViaje?.minaId || null,
        newCompradorId: updatedViaje?.compradorId || null,
        newConductor: updatedViaje?.conductor || null,
      };
      
      // Usar función optimizada para invalidar todas las queries relacionadas
      invalidateTripRelatedQueries(queryClient, tripChangeInfo);
      
      onClose();
      toast({
        title: "Viaje actualizado",
        description: "Los datos del viaje han sido actualizados exitosamente en todos los módulos.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el viaje",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditTripFormData) => {
    // Calcular valores automáticamente antes de enviar
    const calculatedTotalVenta = data.peso * data.ventaTon;
    const calculatedTotalCompra = data.peso * data.precioCompraTon;
    const calculatedTotalFleteBase = data.peso * data.fleteTon;
    const calculatedOtrosGastosFlete = data.otrosGastosFlete || 0;
    const calculatedTotalFlete = calculatedTotalFleteBase + calculatedOtrosGastosFlete;
    
    // Lógica del valor a consignar según quien paga el flete
    // Manejar tanto valores de importación Excel como formulario manual
    const esCompradorPagaFlete = data.quienPagaFlete === "comprador" || data.quienPagaFlete === "El comprador";
    const calculatedValorConsignar = esCompradorPagaFlete
      ? calculatedTotalVenta - calculatedTotalFlete  // El comprador paga flete
      : calculatedTotalVenta;                         // Tú pagas flete
      
    const calculatedGanancia = calculatedTotalVenta - calculatedTotalCompra - calculatedTotalFlete;
    
    // Enviar datos con valores calculados incluidos y mapear quienPagaFlete al formato del servidor
    const dataWithCalculations = {
      ...data,
      quienPagaFlete: data.quienPagaFlete === "tu" ? "RodMar" : "El comprador", // Mapear al formato del servidor
      totalVenta: calculatedTotalVenta.toString(),
      totalCompra: calculatedTotalCompra.toString(),
      totalFlete: calculatedTotalFlete.toString(),
      valorConsignar: calculatedValorConsignar.toString(),
      ganancia: calculatedGanancia.toString(),
      vut: ((calculatedTotalVenta / data.peso) || 0).toString(),
      cut: ((calculatedTotalCompra / data.peso) || 0).toString(),
      fut: ((calculatedTotalFlete / data.peso) || 0).toString(),
    };

    // QUIRÚRGICO: no re-escribir fechas si no cambiaron.
    // Si enviamos "YYYY-MM-DD" de nuevo, el backend lo convierte a Date y puede alterar el timestamp
    // (por UTC/local), cambiando el orden dentro del mismo día.
    const originalFechaCargue = formatDateForInput(viaje?.fechaCargue);
    if (dataWithCalculations.fechaCargue === originalFechaCargue) {
      delete (dataWithCalculations as any).fechaCargue;
    }

    const originalFechaDescargue = formatDateForInput(viaje?.fechaDescargue);
    const submittedFechaDescargue = (dataWithCalculations as any).fechaDescargue;
    if (!submittedFechaDescargue || submittedFechaDescargue === originalFechaDescargue) {
      delete (dataWithCalculations as any).fechaDescargue;
    }

    // OPTIMIZACIÓN + SEGURIDAD DE DATOS:
    // El listado de viajes ya no trae el recibo (base64) para reducir payload.
    // Si el viaje tiene recibo guardado pero el formulario llega sin recibo (porque no se cargó),
    // NO debemos enviar recibo="" ya que borraría el recibo en el servidor.
    const viajeTieneRecibo = Boolean((viaje as any)?.tieneRecibo) || Boolean(viaje?.recibo);
    if (viajeTieneRecibo && !userClearedReceipt && !dataWithCalculations.recibo) {
      delete (dataWithCalculations as any).recibo;
    }
    
    console.log("=== EditTripModal - Sending calculated data:", dataWithCalculations);
    mutation.mutate(dataWithCalculations);
  };

  const watchedValues = form.watch();
  const calculations = {
    totalVenta: (watchedValues.peso || 0) * (watchedValues.ventaTon || 0),
    totalCompra: (watchedValues.peso || 0) * (watchedValues.precioCompraTon || 0),
    totalFleteBase: (watchedValues.peso || 0) * (watchedValues.fleteTon || 0),
    otrosGastosFlete: watchedValues.otrosGastosFlete || 0,
    totalFlete: 0,
    valorConsignar: 0,
    ganancia: 0,
  };
  
  calculations.totalFlete = calculations.totalFleteBase + calculations.otrosGastosFlete;
  
  // Lógica del valor a consignar según quien paga el flete
  // LÓGICA CORREGIDA: Manejar tanto valores de importación Excel como formulario manual
  // Excel: "comprador" / "tu" 
  // Manual: "El comprador" / "Tú"
  const esCompradorPagaFlete = watchedValues.quienPagaFlete === "comprador" || watchedValues.quienPagaFlete === "El comprador";
  const valorConsignar = esCompradorPagaFlete
    ? calculations.totalVenta - calculations.totalFlete  // El comprador paga flete
    : calculations.totalVenta;                           // Tú pagas flete
    
  calculations.valorConsignar = valorConsignar;
  calculations.ganancia = calculations.totalVenta - calculations.totalCompra - calculations.totalFlete;

  if (!viaje) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-trip-description">
        <DialogHeader>
          <DialogTitle>Editar Viaje {viaje?.id}</DialogTitle>
        </DialogHeader>
        <div id="edit-trip-description" className="sr-only">
          Formulario para editar los datos del viaje incluyendo fechas, conductor, peso y precios.
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Información de Cargue */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Información de Cargue</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fechaCargue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Cargue</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      {field.value && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDateWithDaySpanish(field.value)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conductor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conductor</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="Nombre del conductor" 
                            value={field.value}
                            onChange={(e) => handleConductorChange(e.target.value)}
                            onFocus={() => {
                              if (field.value.length > 0 && filteredPlacas.length > 0) {
                                setShowSuggestions(true);
                              }
                            }}
                            onBlur={() => {
                              // Delay hiding suggestions to allow clicking
                              setTimeout(() => setShowSuggestions(false), 200);
                            }}
                          />
                          
                          {/* Dropdown with suggestions */}
                          {showSuggestions && filteredPlacas.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {filteredPlacas.map((placaInfo, index) => (
                                <button
                                  key={`${placaInfo.conductor}-${placaInfo.placa}`}
                                  type="button"
                                  onClick={() => handlePlacaSelect(placaInfo)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{placaInfo.conductor}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {placaInfo.placa} • {placaInfo.tipoCarro}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {placaInfo.viajesCount} viajes
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
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
                        <Input 
                          placeholder="ABC123" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Sencillo">Sencillo</SelectItem>
                          <SelectItem value="Doble Troque">Doble Troque</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mina</FormLabel>
                      <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar mina" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {minas.map((mina) => (
                            <SelectItem key={mina.id} value={mina.id.toString()}>
                              {mina.nombre}
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
                  name="precioCompraTon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Compra/Ton</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Información de Descargue */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Información de Descargue</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fechaDescargue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Descargue</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      {field.value && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDateWithDaySpanish(field.value)}
                        </p>
                      )}
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
                      <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
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
              </div>

              <FormField
                control={form.control}
                name="peso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso (toneladas)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Precios */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Precios</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ventaTon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venta/Ton</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                      <FormLabel>Flete/Ton</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="otrosGastosFlete"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Otros Gastos de Flete</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                    <FormLabel>¿Quién paga el flete?</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar quién paga" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tu">RodMar</SelectItem>
                        <SelectItem value="comprador">El comprador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recibo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recibo (Opcional)</FormLabel>
                    <FormControl>
                      <ReceiptImageUpload
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Número de recibo"
                        tripId={viaje?.id}
                        hasRemoteImage={Boolean((viaje as any)?.tieneRecibo) && !field.value}
                        onUserCleared={() => setUserClearedReceipt(true)}
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
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Observaciones adicionales..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cálculos en Tiempo Real */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">Cálculos Automáticos</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Venta:</span>
                  <div className="font-semibold text-green-600">{formatCurrency(calculations.totalVenta)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Compra:</span>
                  <div className="font-semibold text-red-600">{formatCurrency(calculations.totalCompra)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Flete:</span>
                  <div className="font-semibold text-blue-600">{formatCurrency(calculations.totalFlete)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor a Consignar:</span>
                  <div className="font-semibold text-purple-600">{formatCurrency(calculations.valorConsignar)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Ganancia:</span>
                  <div className={`font-semibold ${calculations.ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(calculations.ganancia)}
                  </div>
                </div>
              </div>
              
              {/* Notas explicativas */}
              {watchedValues.quienPagaFlete === "tu" && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-blue-50 rounded">
                  <strong>Nota:</strong> RodMar paga el flete. El valor a consignar es igual al total de venta.
                </div>
              )}
              {watchedValues.quienPagaFlete === "comprador" && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-orange-50 rounded">
                  <strong>Nota:</strong> El comprador paga el flete. Se registrará una transacción negativa adicional para el comprador.
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="modal-buttons-container flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}