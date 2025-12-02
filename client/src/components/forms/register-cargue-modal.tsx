import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X, ChevronDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
// import { useOptimalMobileForm } from "@/hooks/useOptimalMobileForm";

import type { Mina, Volquetero } from "@shared/schema";

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

const formSchema = z.object({
  fechaCargue: z.string().min(1, "La fecha es requerida"),
  conductor: z.string().min(1, "El conductor es requerido"),
  tipoCarro: z.string().min(1, "El tipo de carro es requerido"),
  placa: z.string().min(1, "La placa es requerida"),
  minaId: z.string().min(1, "La mina es requerida"),
  precioCompraTon: z.string().min(1, "El precio de compra es requerido"),
});

interface RegisterCargueModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RegisterCargueModal({ open, onClose }: RegisterCargueModalProps) {
  const { toast } = useToast();
  const [formKey, setFormKey] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Hook súper optimizado para formularios móviles
  // const mobileForm = useOptimalMobileForm();

  const [filteredVolqueteros, setFilteredVolqueteros] = useState<VolqueteroConPlacas[]>([]);
  const [filteredPlacas, setFilteredPlacas] = useState<Array<{
    conductor: string;
    placa: string;
    tipoCarro: string;
    viajesCount: number;
  }>>([]);
  
  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
    enabled: open, // Only run query when modal is open
  });

  const { data: volqueteros = [] } = useQuery<VolqueteroConPlacas[]>({
    queryKey: ["/api/volqueteros"],
    enabled: open, // Only run query when modal is open
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fechaCargue: (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })(),
      conductor: "",
      tipoCarro: "",
      placa: "",
      minaId: "",
      precioCompraTon: "",
    },
  });

  // Reset form when modal closes and force rerender
  useEffect(() => {
    if (!open) {
      form.reset();
      setFormKey(prev => prev + 1);
      setShowSuggestions(false);
      setFilteredVolqueteros([]);
      setFilteredPlacas([]);
    }
  }, [open, form]);

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

  const createViajeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const viajeData = {
        fechaCargue: new Date(data.fechaCargue + 'T00:00:00'),
        conductor: data.conductor,
        tipoCarro: data.tipoCarro,
        placa: data.placa,
        minaId: parseInt(data.minaId),
        precioCompraTon: data.precioCompraTon,
        estado: "pendiente",
      };
      
      const response = await apiRequest("POST", "/api/viajes", viajeData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidar TODAS las queries de viajes (incluyendo paginadas)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/viajes");
        }
      });
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      form.reset();
      onClose();
      toast({
        title: "Cargue registrado",
        description: "El viaje ha sido creado y está pendiente de descargue.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo registrar el cargue.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    try {
      createViajeMutation.mutate(data);
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

  // Clases CSS simplificadas
  const modalClasses = "sm:max-w-2xl max-h-[85vh] overflow-y-auto";
  const dynamicStyle = {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className={modalClasses}
        style={dynamicStyle}
      >
        <div className="space-y-4">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">Registrar Cargue</DialogTitle>
                <p className="text-sm text-muted-foreground">Información del viaje y vehículo</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form key={formKey} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* Información General */}
            <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 pb-2 border-b border-green-200 dark:border-green-700">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="font-medium text-green-700 dark:text-green-300">📅 Información General</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fechaCargue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Fecha de Cargue</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-9" />
                      </FormControl>
                      {field.value && (
                        <p className="text-xs text-muted-foreground mt-1">
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
                      <FormLabel className="text-sm font-medium">Conductor</FormLabel>
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
                            className="h-9" 
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
              </div>
            </div>

            {/* Información del Vehículo */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-200 dark:border-blue-700">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-medium text-blue-700 dark:text-blue-300">🚛 Información del Vehículo</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipoCarro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Tipo de Carro</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9">
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
                  name="placa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Placa</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC-123" {...field} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Información Comercial */}
            <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 pb-2 border-b border-orange-200 dark:border-orange-700">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <h3 className="font-medium text-orange-700 dark:text-orange-300">💼 Información Comercial</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Mina</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
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
                      <FormLabel className="text-sm font-medium">Precio de Compra/Ton</FormLabel>
                      <FormControl>
                        <Input placeholder="50,000" {...field} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="modal-buttons-container flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 h-10" disabled={createViajeMutation.isPending}>
                {createViajeMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </div>
                ) : (
                  "Registrar Cargue"
                )}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}