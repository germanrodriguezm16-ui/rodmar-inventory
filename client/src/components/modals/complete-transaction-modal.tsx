import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ReceiptImageUpload } from "@/components/ui/receipt-image-upload";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X, CheckCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { TransactionReceiptModal } from "@/components/modals/transaction-receipt-modal";
import { getSocioNombre } from "@/lib/getSocioNombre";
import type { Mina, Comprador, Volquetero, Tercero } from "@shared/schema";

const completeSchema = z.object({
  deQuienTipo: z.string().min(1, "Debe seleccionar el origen"),
  deQuienId: z.string().min(1, "Debe especificar el origen"),
  fecha: z.string().min(1, "La fecha es requerida"),
  formaPago: z.string().min(1, "La forma de pago es requerida"),
  voucher: z.string().optional(),
});

interface CompleteTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transaccionId: number;
  paraQuienTipo?: string;
  paraQuienId?: string;
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

export function CompleteTransactionModal({ 
  open, 
  onClose, 
  transaccionId,
  paraQuienTipo,
  paraQuienId 
}: CompleteTransactionModalProps) {
  const { toast } = useToast();
  
  // Estado para modal de comprobante
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);

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

  const { data: terceros = [] } = useQuery<Tercero[]>({
    queryKey: ["/api/terceros"],
    enabled: open,
  });

  const form = useForm<z.infer<typeof completeSchema>>({
    resolver: zodResolver(completeSchema),
    defaultValues: {
      deQuienTipo: "",
      deQuienId: "",
      fecha: getTodayLocalDate(),
      formaPago: "",
      voucher: "",
    },
  });

  // Resetear el formulario cuando se abre el modal
  useEffect(() => {
    if (open) {
      form.reset({
        deQuienTipo: "",
        deQuienId: "",
        fecha: getTodayLocalDate(),
        formaPago: "",
        voucher: "",
      });
    }
  }, [open, form]);

  const watchedDeQuienTipo = form.watch("deQuienTipo");

  // Get options based on selected tipo
  const getEntityOptions = (tipo: string) => {
    switch (tipo) {
      case "mina":
        return minas.map(mina => ({ value: mina.id.toString(), label: mina.nombre }));
      case "comprador":
        return compradores.map(comprador => ({ value: comprador.id.toString(), label: comprador.nombre }));
      case "volquetero":
        return volqueteros.map(volquetero => ({ value: volquetero.id.toString(), label: volquetero.nombre }));
      case "tercero":
        return terceros.map(tercero => ({ value: tercero.id.toString(), label: tercero.nombre }));
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
  if (watchedDeQuienTipo === "banco" && form.getValues("deQuienId") !== "banco") {
    form.setValue("deQuienId", "banco");
  }
  if (watchedDeQuienTipo === "lcdm" && form.getValues("deQuienId") !== "lcdm") {
    form.setValue("deQuienId", "lcdm");
  }
  if (watchedDeQuienTipo === "postobon" && form.getValues("deQuienId") !== "postobon") {
    form.setValue("deQuienId", "postobon");
  }

  const completeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof completeSchema>) => {
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/transacciones/${transaccionId}/completar`), {
        method: "PUT",
        headers,
        body: JSON.stringify({
          deQuienTipo: data.deQuienTipo,
          deQuienId: data.deQuienId,
          formaPago: data.formaPago,
          fecha: data.fecha,
          voucher: data.voucher || undefined,
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
        title: "Transacción completada",
        description: "La transacción pendiente se ha completado exitosamente.",
      });
      
      // El resultado ya contiene la transacción completada
      setCompletedTransaction(result);
      setShowReceiptModal(true);
      
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      
      // Invalidar queries del socio destino
      if (paraQuienTipo && paraQuienId) {
        if (paraQuienTipo === 'comprador') {
          queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", parseInt(paraQuienId)] });
        }
        if (paraQuienTipo === 'mina') {
          queryClient.invalidateQueries({ queryKey: ["/api/transacciones/mina", parseInt(paraQuienId)] });
        }
        if (paraQuienTipo === 'volquetero') {
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/volquetero" &&
                queryKey[1] === paraQuienId;
            },
          });
        }
      }
      
      form.reset();
      // No cerrar el modal aquí, se cerrará cuando se cierre el modal de comprobante
    },
    onError: (error: any) => {
      console.error("Error completing transaction:", error);
      toast({
        title: "Error",
        description: "No se pudo completar la transacción. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof completeSchema>) => {
    completeMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] max-w-[90vw] max-h-[85vh] overflow-y-auto border-2 border-green-300 rounded-xl shadow-xl">
        <DialogHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200 -m-6 mb-4 p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-green-700 text-lg">
              <CheckCircle className="h-5 w-5" />
              Completar Transacción
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
            {/* Origen (De quién) */}
            <FormField
              control={form.control}
              name="deQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Origen (De quién)</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("deQuienId", "");
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-2 border-gray-200 h-10">
                        <SelectValue placeholder="Seleccionar origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rodmar">RodMar</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="volquetero">Volquetero</SelectItem>
                      <SelectItem value="mina">Mina</SelectItem>
                      <SelectItem value="tercero">Tercero</SelectItem>
                      <SelectItem value="lcdm">LCDM</SelectItem>
                      <SelectItem value="postobon">Postobón</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Origen específico - RodMar */}
            {watchedDeQuienTipo === "rodmar" && (
              <FormField
                control={form.control}
                name="deQuienId"
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

            {/* Origen específico - Otras entidades con búsqueda */}
            {watchedDeQuienTipo && watchedDeQuienTipo !== "rodmar" && watchedDeQuienTipo !== "banco" && watchedDeQuienTipo !== "lcdm" && watchedDeQuienTipo !== "postobon" && (
              <FormField
                control={form.control}
                name="deQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      {watchedDeQuienTipo === "comprador" ? "Comprador" :
                       watchedDeQuienTipo === "volquetero" ? "Volquetero" :
                       watchedDeQuienTipo === "tercero" ? "Tercero" : "Mina"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getEntityOptions(watchedDeQuienTipo)}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder={`Buscar ${watchedDeQuienTipo === "comprador" ? "comprador" : watchedDeQuienTipo === "volquetero" ? "volquetero" : watchedDeQuienTipo === "tercero" ? "tercero" : "mina"}...`}
                        emptyMessage="No se encontraron resultados"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Fecha */}
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Fecha</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      className="bg-white border-2 border-gray-200 h-10"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Forma de Pago */}
            <FormField
              control={form.control}
              name="formaPago"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Forma de Pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white border-2 border-gray-200 h-10">
                        <SelectValue placeholder="Seleccionar forma de pago" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Consignación">Consignación</SelectItem>
                      <SelectItem value="Otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Voucher */}
            <FormField
              control={form.control}
              name="voucher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Voucher (Opcional)</FormLabel>
                  <FormControl>
                    <ReceiptImageUpload
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Número de voucher o referencia"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-3 border-t-2 border-green-200 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={completeMutation.isPending}
                className="border-2"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={completeMutation.isPending}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-md border-2 border-green-600"
              >
                {completeMutation.isPending ? "Completando..." : "Completar Transacción"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      
      {completedTransaction && completedTransaction.paraQuienTipo && (
        <TransactionReceiptModal
          open={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setCompletedTransaction(null);
            onClose();
          }}
          transaction={completedTransaction}
          socioDestinoNombre={getSocioNombre(
            completedTransaction.paraQuienTipo,
            completedTransaction.paraQuienId,
            minas,
            compradores,
            volqueteros,
            terceros
          ) || 'Socio'}
          minas={minas}
          compradores={compradores}
          volqueteros={volqueteros}
        />
      )}
    </Dialog>
  );
}

