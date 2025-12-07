import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X, FileText } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Mina, Comprador, Volquetero } from "@shared/schema";

const solicitarSchema = z.object({
  paraQuienTipo: z.string().min(1, "Debe seleccionar para quién es la transacción"),
  paraQuienId: z.string().min(1, "Debe especificar para quién"),
  valor: z.string().min(1, "El valor es requerido"),
  comentario: z.string().optional(),
  detalle_solicitud: z.string().min(1, "Debe ingresar los datos de la cuenta"),
});

interface SolicitarTransaccionModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: {
    id?: number;
    paraQuienTipo: string;
    paraQuienId: string;
    valor: string;
    comentario?: string;
    detalle_solicitud: string;
  };
}

// Opciones para RodMar
const rodmarOptions = [
  { value: "bemovil", label: "Bemovil" },
  { value: "corresponsal", label: "Corresponsal" },
  { value: "efectivo", label: "Efectivo" },
  { value: "cuentas-german", label: "Cuentas German" },
  { value: "cuentas-jhon", label: "Cuentas Jhon" },
  { value: "otras", label: "Otras" },
];

// Función para formatear números con separadores de miles
const formatNumber = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Función para obtener el valor numérico sin formato
const getNumericValue = (formattedValue: string): string => {
  return formattedValue.replace(/\./g, '');
};

// Función para normalizar el valor inicial (puede venir como número, string con formato, etc.)
const normalizeInitialValue = (value: string | number | undefined): string => {
  if (!value && value !== 0) return '';
  
  // Convertir a string si es número
  let stringValue: string;
  if (typeof value === 'number') {
    // Si es número, convertir a string sin decimales (redondear si es necesario)
    // Usar Math.floor en lugar de Math.round para evitar redondeos no deseados
    stringValue = Math.floor(Math.abs(value)).toString();
  } else {
    stringValue = String(value).trim();
  }
  
  // Si está vacío después de trim, retornar vacío
  if (!stringValue) return '';
  
  // Remover cualquier formato (puntos, comas, espacios, punto decimal y decimales)
  // Primero, si tiene punto decimal, tomar solo la parte entera (antes del punto)
  if (stringValue.includes('.')) {
    stringValue = stringValue.split('.')[0];
  }
  
  // Remover cualquier otro carácter no numérico (puntos de miles, comas, espacios, etc.)
  const numericOnly = stringValue.replace(/[^\d]/g, '');
  
  // Retornar solo dígitos (sin ceros a la izquierda innecesarios, pero mantener el valor)
  return numericOnly;
};

// Función para obtener la fecha local colombiana en formato YYYY-MM-DD
const getTodayLocalDate = () => {
  const today = new Date();
  // Ajustar a zona horaria de Colombia (UTC-5)
  const colombiaOffset = -5 * 60; // -5 horas en minutos
  const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
  const colombiaTime = new Date(utc + (colombiaOffset * 60000));
  
  const year = colombiaTime.getFullYear();
  const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
  const day = String(colombiaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function SolicitarTransaccionModal({ open, onClose, initialData }: SolicitarTransaccionModalProps) {
  const { toast } = useToast();

  // Fetch entities
  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
    enabled: open,
  });

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
    enabled: open,
  });

  const { data: volqueteros = [] } = useQuery<Volquetero[]>({
    queryKey: ["/api/volqueteros"],
    enabled: open,
  });

  const form = useForm<z.infer<typeof solicitarSchema>>({
    resolver: zodResolver(solicitarSchema),
    defaultValues: {
      paraQuienTipo: initialData?.paraQuienTipo || "",
      paraQuienId: initialData?.paraQuienId || "",
      valor: normalizeInitialValue(initialData?.valor),
      comentario: initialData?.comentario || "",
      detalle_solicitud: initialData?.detalle_solicitud || "",
    },
  });

  // Resetear el formulario cuando cambian los datos iniciales
  useEffect(() => {
    if (!open) return;
    
    if (initialData) {
      const normalizedValor = normalizeInitialValue(initialData.valor);
      form.reset({
        paraQuienTipo: initialData.paraQuienTipo || "",
        paraQuienId: initialData.paraQuienId || "",
        valor: normalizedValor,
        comentario: initialData.comentario || "",
        detalle_solicitud: initialData.detalle_solicitud || "",
      });
    } else {
      form.reset({
        paraQuienTipo: "",
        paraQuienId: "",
        valor: "",
        comentario: "",
        detalle_solicitud: "",
      });
    }
  }, [initialData?.id, initialData?.valor, open]); // Solo resetear cuando cambian datos clave

  const watchedParaQuienTipo = form.watch("paraQuienTipo");

  // Get options based on selected tipo
  const getEntityOptions = (tipo: string) => {
    switch (tipo) {
      case "mina":
        return minas.map(mina => ({ value: mina.id.toString(), label: mina.nombre }));
      case "comprador":
        return compradores.map(comprador => ({ value: comprador.id.toString(), label: comprador.nombre }));
      case "volquetero":
        return volqueteros.map(volquetero => ({ value: volquetero.id.toString(), label: volquetero.nombre }));
      case "rodmar":
        return rodmarOptions;
      case "banco":
        return [{ value: "banco", label: "Banco" }];
      case "lcdm":
        return [{ value: "lcdm", label: "La Casa del Motero" }];
      case "postobon":
        return [{ value: "postobon", label: "Postobón" }];
      default:
        return [];
    }
  };

  // Auto-assign IDs for special entities
  if (watchedParaQuienTipo === "banco" && form.getValues("paraQuienId") !== "banco") {
    form.setValue("paraQuienId", "banco");
  }
  if (watchedParaQuienTipo === "lcdm" && form.getValues("paraQuienId") !== "lcdm") {
    form.setValue("paraQuienId", "lcdm");
  }
  if (watchedParaQuienTipo === "postobon" && form.getValues("paraQuienId") !== "postobon") {
    form.setValue("paraQuienId", "postobon");
  }

  // Función para generar el concepto (similar al backend)
  const generateConcepto = (data: z.infer<typeof solicitarSchema>) => {
    const tipoCapitalizado = data.paraQuienTipo.charAt(0).toUpperCase() + data.paraQuienTipo.slice(1);
    let nombreDestino = "Desconocido";
    
    switch (data.paraQuienTipo) {
      case "mina":
        const mina = minas.find(m => m.id.toString() === data.paraQuienId);
        nombreDestino = mina?.nombre || data.paraQuienId;
        break;
      case "comprador":
        const comprador = compradores.find(c => c.id.toString() === data.paraQuienId);
        nombreDestino = comprador?.nombre || data.paraQuienId;
        break;
      case "volquetero":
        const volquetero = volqueteros.find(v => v.id.toString() === data.paraQuienId);
        nombreDestino = volquetero?.nombre || data.paraQuienId;
        break;
      case "rodmar":
        const rodmarOption = rodmarOptions.find(o => o.value === data.paraQuienId);
        nombreDestino = rodmarOption?.label || data.paraQuienId;
        break;
      case "banco":
        nombreDestino = "Banco";
        break;
      case "lcdm":
        nombreDestino = "La Casa del Motero";
        break;
      case "postobon":
        nombreDestino = "Postobón";
        break;
      default:
        nombreDestino = data.paraQuienId;
    }
    
    return `Solicitud de pago a ${tipoCapitalizado} (${nombreDestino})`;
  };

  const createSolicitudMutation = useMutation({
    mutationFn: async (data: z.infer<typeof solicitarSchema>) => {
      // Si hay initialData con ID, es una edición - usar PATCH para actualizar
      if (initialData?.id) {
        const concepto = generateConcepto(data);
        
        const response = await fetch(apiUrl(`/api/transacciones/${initialData.id}`), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paraQuienTipo: data.paraQuienTipo,
            paraQuienId: data.paraQuienId,
            concepto: concepto,
            valor: getNumericValue(data.valor),
            fecha: getTodayLocalDate(),
            formaPago: "pendiente", // Mantener como pendiente
            comentario: data.comentario || undefined,
            detalle_solicitud: data.detalle_solicitud,
            estado: "pendiente", // Mantener como pendiente
          }),
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }

        return response.json();
      }

      // Si no hay ID, crear nueva solicitud
      const response = await fetch(apiUrl("/api/transacciones/solicitar"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paraQuienTipo: data.paraQuienTipo,
          paraQuienId: data.paraQuienId,
          valor: getNumericValue(data.valor),
          fecha: getTodayLocalDate(),
          comentario: data.comentario || undefined,
          detalle_solicitud: data.detalle_solicitud,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (result, variables) => {
      toast({
        title: initialData?.id ? "Solicitud actualizada" : "Solicitud creada",
        description: initialData?.id 
          ? "La solicitud de transacción pendiente se ha actualizado exitosamente."
          : "La solicitud de transacción pendiente se ha creado exitosamente.",
      });
      
      // Invalidar y refetch queries de pendientes
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      
      // Invalidar y refetch módulo general de transacciones (todas las páginas)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            typeof queryKey[0] === "string" &&
            queryKey[0] === "/api/transacciones";
        },
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            typeof queryKey[0] === "string" &&
            queryKey[0] === "/api/transacciones";
        },
      });
      
      // Si es una edición, invalidar también las queries del destino anterior
      if (initialData?.id && initialData.paraQuienTipo && initialData.paraQuienId) {
        // Solo invalidar el destino anterior si cambió el destino
        const nuevoParaQuienTipo = result?.paraQuienTipo || variables.paraQuienTipo;
        const nuevoParaQuienId = result?.paraQuienId || variables.paraQuienId;
        
        if (initialData.paraQuienTipo !== nuevoParaQuienTipo || initialData.paraQuienId !== nuevoParaQuienId) {
          if (initialData.paraQuienTipo === 'comprador') {
            const compradorId = typeof initialData.paraQuienId === 'string' ? parseInt(initialData.paraQuienId) : initialData.paraQuienId;
            queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
            queryClient.refetchQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
          }
          if (initialData.paraQuienTipo === 'mina') {
            const minaIdStr = String(initialData.paraQuienId);
            queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}/all`] });
            queryClient.refetchQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}`] });
            queryClient.refetchQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}/all`] });
          }
          if (initialData.paraQuienTipo === 'volquetero') {
            const volqueteroId = typeof initialData.paraQuienId === 'string' ? parseInt(initialData.paraQuienId) : initialData.paraQuienId;
            queryClient.invalidateQueries({
              predicate: (query) => {
                const queryKey = query.queryKey;
                return Array.isArray(queryKey) &&
                  queryKey.length > 0 &&
                  typeof queryKey[0] === "string" &&
                  queryKey[0] === "/api/volqueteros" &&
                  queryKey[1] === volqueteroId &&
                  queryKey[2] === "transacciones";
              },
            });
            queryClient.refetchQueries({
              predicate: (query) => {
                const queryKey = query.queryKey;
                return Array.isArray(queryKey) &&
                  queryKey.length > 0 &&
                  typeof queryKey[0] === "string" &&
                  queryKey[0] === "/api/volqueteros" &&
                  queryKey[1] === volqueteroId &&
                  queryKey[2] === "transacciones";
              },
            });
          }
        }
      }
      
      // Invalidar y refetch queries del socio destino (nuevo o actualizado)
      const paraQuienTipo = result?.paraQuienTipo || variables.paraQuienTipo;
      const paraQuienId = result?.paraQuienId || variables.paraQuienId;
      
      if (paraQuienTipo === 'comprador' && paraQuienId) {
        const compradorId = typeof paraQuienId === 'string' ? parseInt(paraQuienId) : paraQuienId;
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
        queryClient.refetchQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
      }
      if (paraQuienTipo === 'mina' && paraQuienId) {
        const minaIdStr = String(paraQuienId);
        queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}/all`] });
        queryClient.refetchQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}`] });
        queryClient.refetchQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}/all`] });
      }
      if (paraQuienTipo === 'volquetero' && paraQuienId) {
        const volqueteroId = typeof paraQuienId === 'string' ? parseInt(paraQuienId) : paraQuienId;
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/volqueteros" &&
              queryKey[1] === volqueteroId &&
              queryKey[2] === "transacciones";
          },
        });
        queryClient.refetchQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/volqueteros" &&
              queryKey[1] === volqueteroId &&
              queryKey[2] === "transacciones";
          },
        });
      }
      
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      console.error("Error creating solicitud:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la solicitud. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof solicitarSchema>) => {
    createSolicitudMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] max-w-[90vw] max-h-[85vh] overflow-y-auto border-2 border-orange-300 rounded-xl shadow-xl">
        <DialogHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b-2 border-orange-200 -m-6 mb-4 p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-orange-700 text-lg">
              <FileText className="h-5 w-5" />
              {initialData?.id ? "Editar Solicitud Pendiente" : "Solicitar Transacción Pendiente"}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
            {/* Para quién */}
            <FormField
              control={form.control}
              name="paraQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Para quién</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("paraQuienId", "");
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-2 border-gray-200 h-10">
                        <SelectValue placeholder="Seleccionar destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mina">Mina</SelectItem>
                      <SelectItem value="volquetero">Volquetero</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="rodmar">RodMar</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                      <SelectItem value="lcdm">LCDM</SelectItem>
                      <SelectItem value="postobon">Postobón</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Para quién específico - RodMar */}
            {watchedParaQuienTipo === "rodmar" && (
              <FormField
                control={form.control}
                name="paraQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-700">Cuenta RodMar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-2 border-gray-200 h-10">
                          <SelectValue placeholder="Seleccionar cuenta..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rodmarOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Para quién específico - Otras entidades con búsqueda */}
            {watchedParaQuienTipo && watchedParaQuienTipo !== "rodmar" && watchedParaQuienTipo !== "banco" && watchedParaQuienTipo !== "lcdm" && watchedParaQuienTipo !== "postobon" && (
              <FormField
                control={form.control}
                name="paraQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      {watchedParaQuienTipo === "comprador" ? "Comprador" :
                       watchedParaQuienTipo === "volquetero" ? "Volquetero" : "Mina"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getEntityOptions(watchedParaQuienTipo)}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder={`Buscar ${watchedParaQuienTipo === "comprador" ? "comprador" : watchedParaQuienTipo === "volquetero" ? "volquetero" : "mina"}...`}
                        emptyMessage="No se encontraron resultados"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Valor */}
            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Valor</FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      inputMode="numeric"
                      placeholder="0" 
                      value={formatNumber(field.value)}
                      onChange={(e) => {
                        const formattedValue = formatNumber(e.target.value);
                        const numericValue = getNumericValue(formattedValue);
                        field.onChange(numericValue);
                      }}
                      className="bg-white border-2 border-gray-200 h-10"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comentarios */}
            <FormField
              control={form.control}
              name="comentario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Comentarios (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Comentarios adicionales..." 
                      className="resize-none bg-white border-2 border-gray-200" 
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datos de la cuenta */}
            <FormField
              control={form.control}
              name="detalle_solicitud"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Datos de la cuenta</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Pega aquí la información del WhatsApp (cuenta, banco, valor, titular, etc.)&#10;Ejemplo:&#10;Banco: Bancolombia&#10;Cuenta: 1234567890&#10;Titular: Juan Pérez&#10;Valor: $3.200.000" 
                      className="resize-none bg-blue-50 border-2 border-blue-300 min-h-[120px]" 
                      rows={5}
                      {...field} 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta información será visible cuando completes la transacción para facilitar la transferencia.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-3 border-t-2 border-orange-200 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createSolicitudMutation.isPending}
                className="border-2"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createSolicitudMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md border-2 border-orange-600"
              >
                {createSolicitudMutation.isPending 
                  ? (initialData?.id ? "Actualizando..." : "Creando...") 
                  : (initialData?.id ? "Actualizar Solicitud" : "Crear Solicitud")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

