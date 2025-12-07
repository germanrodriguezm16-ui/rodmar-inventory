import { useState } from "react";
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

export function SolicitarTransaccionModal({ open, onClose }: SolicitarTransaccionModalProps) {
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
      paraQuienTipo: "",
      paraQuienId: "",
      valor: "",
      comentario: "",
      detalle_solicitud: "",
    },
  });

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

  const createSolicitudMutation = useMutation({
    mutationFn: async (data: z.infer<typeof solicitarSchema>) => {
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
    onSuccess: (result) => {
      toast({
        title: "Solicitud creada",
        description: "La solicitud de transacción pendiente se ha creado exitosamente.",
      });
      
      // Invalidar queries de pendientes
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      
      // Invalidar queries del socio destino
      if (result.paraQuienTipo === 'comprador' && result.paraQuienId) {
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", parseInt(result.paraQuienId)] });
      }
      if (result.paraQuienTipo === 'mina' && result.paraQuienId) {
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/mina", parseInt(result.paraQuienId)] });
      }
      if (result.paraQuienTipo === 'volquetero' && result.paraQuienId) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) &&
              queryKey.length > 0 &&
              typeof queryKey[0] === "string" &&
              queryKey[0] === "/api/transacciones/volquetero" &&
              queryKey[1] === result.paraQuienId;
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200 -m-6 mb-4 p-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <FileText className="h-5 w-5" />
              Solicitar Transacción Pendiente
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Para quién */}
            <FormField
              control={form.control}
              name="paraQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Para quién</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("paraQuienId", "");
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white">
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
                    <FormLabel className="text-sm font-semibold">Cuenta RodMar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
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
                  <FormLabel className="text-sm font-semibold">Valor</FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      placeholder="0" 
                      value={formatNumber(field.value)}
                      onChange={(e) => {
                        const formattedValue = formatNumber(e.target.value);
                        const numericValue = getNumericValue(formattedValue);
                        field.onChange(numericValue);
                      }}
                      className="bg-white"
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
                  <FormLabel className="text-sm font-semibold">Comentarios (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Comentarios adicionales..." 
                      className="resize-none bg-white" 
                      rows={3}
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
                  <FormLabel className="text-sm font-semibold">Datos de la cuenta</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Pega aquí la información del WhatsApp (cuenta, banco, valor, titular, etc.)&#10;Ejemplo:&#10;Banco: Bancolombia&#10;Cuenta: 1234567890&#10;Titular: Juan Pérez&#10;Valor: $3.200.000" 
                      className="resize-none bg-blue-50 border-blue-200 min-h-[150px]" 
                      rows={6}
                      {...field} 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Esta información será visible cuando completes la transacción para facilitar la transferencia.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4 border-t border-orange-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createSolicitudMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createSolicitudMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md"
              >
                {createSolicitudMutation.isPending ? "Creando solicitud..." : "Crear Solicitud"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

