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
import { ReceiptImageUpload } from "@/components/ui/receipt-image-upload";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
// import { useOptimalMobileForm } from "@/hooks/useOptimalMobileForm";

import type { Mina, Comprador, Volquetero } from "@shared/schema";

const formSchema = z.object({
  deQuienTipo: z.string().min(1, "Debe seleccionar de quién es la transacción"),
  deQuienId: z.string().min(1, "Debe especificar de quién"),
  paraQuienTipo: z.string().min(1, "Debe seleccionar para quién es la transacción"),
  paraQuienId: z.string().min(1, "Debe especificar para quién"),
  postobonCuenta: z.string().optional(),
  valor: z.string().min(1, "El valor es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  formaPago: z.string().min(1, "La forma de pago es requerida"),
  voucher: z.string().optional(),
  comentario: z.string().optional(),
});

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  isTemporalMode?: boolean;
  minaActual?: { id: number; nombre: string; };
  compradorId?: number;
  onTemporalSubmit?: (transaccion: any) => void;
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
  // Remover todo excepto dígitos
  const numbers = value.replace(/\D/g, '');
  // Agregar separadores de miles
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Función para obtener el valor numérico sin formato
const getNumericValue = (formattedValue: string): string => {
  return formattedValue.replace(/\./g, '');
};

function NewTransactionModal({ 
  open, 
  onClose, 
  onSuccess, 
  isTemporalMode = false, 
  minaActual, 
  compradorId,
  onTemporalSubmit 
}: TransactionModalProps) {
  const { toast } = useToast();
  
  // Hook súper optimizado para formularios móviles
  // const mobileForm = useOptimalMobileForm();
  
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

  // Función para obtener la fecha local en formato YYYY-MM-DD
  const getTodayLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deQuienTipo: "",
      deQuienId: "",
      paraQuienTipo: "",
      paraQuienId: "",
      valor: "",
      fecha: getTodayLocalDate(),
      formaPago: "",
      voucher: "",
      comentario: "",
    },
  });

  // Watch field values for dynamic options
  const watchedDeQuienTipo = form.watch("deQuienTipo");
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

  // Función para obtener el nombre de la entidad
  const getEntityName = (tipo: string, id: string) => {
    switch (tipo) {
      case "mina":
        return minas.find(mina => mina.id.toString() === id)?.nombre || "Desconocida";
      case "comprador":
        return compradores.find(comprador => comprador.id.toString() === id)?.nombre || "Desconocido";
      case "volquetero":
        return volqueteros.find(volquetero => volquetero.id.toString() === id)?.nombre || "Desconocido";
      case "rodmar":
        return rodmarOptions.find(option => option.value === id)?.label || "Efectivo";
      case "banco":
        return "Banco";
      case "lcdm":
        return "La Casa del Motero";
      case "postobon":
        return "Postobón";
      default:
        return "Desconocido";
    }
  };

  // Función para generar el concepto automático
  const generateConcepto = (data: z.infer<typeof formSchema>) => {
    const deQuienNombre = getEntityName(data.deQuienTipo, data.deQuienId);
    const paraQuienNombre = getEntityName(data.paraQuienTipo, data.paraQuienId);
    
    // Capitalizar el primer carácter del tipo de socio
    const deQuienTipoCapitalizado = data.deQuienTipo.charAt(0).toUpperCase() + data.deQuienTipo.slice(1);
    const paraQuienTipoCapitalizado = data.paraQuienTipo.charAt(0).toUpperCase() + data.paraQuienTipo.slice(1);
    
    // Formar el concepto con el formato específico: "FormaPago de TipoOrigen (NombreOrigen) a TipoDestino (NombreDestino)"
    return `${data.formaPago} de ${deQuienTipoCapitalizado} (${deQuienNombre}) a ${paraQuienTipoCapitalizado} (${paraQuienNombre})`;
  };

  const createTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      console.log("=== Creating new transaction with data:", data);
      
      // Generar concepto automático con el formato específico
      const concepto = generateConcepto(data);
      
      // Agregar el concepto a los datos
      const dataWithConcepto = {
        ...data,
        concepto
      };

      // Si es modo temporal, no hacer request al servidor
      if (isTemporalMode) {
        return dataWithConcepto;
      }
      
      const response = await fetch(apiUrl("/api/transacciones"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataWithConcepto),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (result, data) => {
      if (isTemporalMode) {
        // Para transacciones temporales, usar callback personalizado
        const concepto = generateConcepto(data);
        const nuevaTransaccion = {
          id: `temp-${Date.now()}`,
          concepto,
          valor: data.valor,
          fecha: data.fecha,
          deQuienTipo: data.deQuienTipo,
          deQuienId: data.deQuienId,
          paraQuienTipo: data.paraQuienTipo,
          paraQuienId: data.paraQuienId,
          formaPago: data.formaPago,
          voucher: data.voucher,
          comentario: data.comentario,
          tipo: "Manual",
          isTemporal: true
        };
        
        if (onTemporalSubmit) {
          onTemporalSubmit(nuevaTransaccion);
        } else if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(nuevaTransaccion);
        }
      } else {
        // Para transacciones normales
        toast({
          title: "Transacción registrada",
          description: "La transacción se ha registrado exitosamente.",
        });
        
        // INVALIDACIÓN SELECTIVA - Solo entidades afectadas
        console.log("=== INVALIDACIÓN SELECTIVA POST-CREACIÓN ===");
        
        // Siempre invalidar transacciones
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
        
        // Invalidar solo las entidades específicas afectadas
        if (data.deQuienTipo === 'mina' || data.paraQuienTipo === 'mina') {
          queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
          queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
        }
        if (data.deQuienTipo === 'comprador' || data.paraQuienTipo === 'comprador') {
          queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
          queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] }); // Refetch inmediato
        }
        if (data.deQuienTipo === 'volquetero' || data.paraQuienTipo === 'volquetero') {
          queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
          queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
          queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] }); // Refetch inmediato
        }
        
        // Invalidar queries de LCDM/Postobón si están involucradas
        if (data.deQuienTipo === 'lcdm' || data.paraQuienTipo === 'lcdm') {
          queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/lcdm";
            },
          });
        }
        if (data.deQuienTipo === 'postobon' || data.paraQuienTipo === 'postobon') {
          queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/postobon";
            },
          });
        }
        
        // Invalidar queries de cuentas RodMar si están involucradas
        const rodmarAccountIds = ['bemovil', 'corresponsal', 'efectivo', 'cuentas-german', 'cuentas-jhon', 'otros'];
        const hasRodmarAccount = 
          (data.deQuienTipo === 'rodmar' && rodmarAccountIds.includes(data.deQuienId || '')) ||
          (data.paraQuienTipo === 'rodmar' && rodmarAccountIds.includes(data.paraQuienId || ''));
        
        if (hasRodmarAccount) {
          queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0].startsWith("/api/transacciones/cuenta/");
            },
          });
        }
        
        console.log("=== CACHE INVALIDADO CORRECTAMENTE ===");
      }
      
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      console.error("Error creating transaction:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar la transacción. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTransactionMutation.mutate(data);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isTemporalMode ? "Crear Transacción Temporal" : "Registrar Transacción"}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isTemporalMode && (
            <p className="text-sm text-orange-600 mt-1">
              Esta transacción es temporal y se eliminará al salir de la vista actual.
            </p>
          )}
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* ¿De quién? */}
            <FormField
              control={form.control}
              name="deQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿De quién?</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("deQuienId", ""); // Reset selection
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rodmar">RodMar</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="volquetero">Volquetero</SelectItem>
                      <SelectItem value="mina">Mina</SelectItem>
                      <SelectItem value="lcdm">LCDM</SelectItem>
                      <SelectItem value="postobon">Postobón</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-assign IDs for special entities */}
            {watchedDeQuienTipo === "banco" && (() => {
              if (form.getValues("deQuienId") !== "banco") {
                form.setValue("deQuienId", "banco");
              }
              return null;
            })()}
            
            {watchedDeQuienTipo === "lcdm" && (() => {
              if (form.getValues("deQuienId") !== "lcdm") {
                form.setValue("deQuienId", "lcdm");
              }
              return null;
            })()}
            
            {watchedDeQuienTipo === "postobon" && (() => {
              if (form.getValues("deQuienId") !== "postobon") {
                form.setValue("deQuienId", "postobon");
              }
              return null;
            })()}

            {/* Campo cuenta Postobón - aparece cuando Postobón está seleccionado como origen */}
            {watchedDeQuienTipo === "postobon" && (
              <FormField
                control={form.control}
                name="postobonCuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta Postobón</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="santa-rosa">Santa Rosa</SelectItem>
                        <SelectItem value="cimitarra">Cimitarra</SelectItem>
                        <SelectItem value="otras">Otras</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* De quién específico - RodMar */}
            {watchedDeQuienTipo === "rodmar" && (
              <FormField
                control={form.control}
                name="deQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta RodMar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cuenta..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getEntityOptions(watchedDeQuienTipo).map((option) => (
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

            {/* De quién específico - Otras entidades con búsqueda */}
            {watchedDeQuienTipo && watchedDeQuienTipo !== "rodmar" && watchedDeQuienTipo !== "banco" && watchedDeQuienTipo !== "lcdm" && watchedDeQuienTipo !== "postobon" && (
              <FormField
                control={form.control}
                name="deQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedDeQuienTipo === "comprador" ? "Comprador" :
                       watchedDeQuienTipo === "volquetero" ? "Volquetero" : "Mina"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getEntityOptions(watchedDeQuienTipo)}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder={`Buscar ${watchedDeQuienTipo === "comprador" ? "comprador" : watchedDeQuienTipo === "volquetero" ? "volquetero" : "mina"}...`}
                        emptyMessage="No se encontraron resultados"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ¿Para quién? */}
            <FormField
              control={form.control}
              name="paraQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Para quién?</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("paraQuienId", ""); // Reset selection
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
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

            {/* Auto-assign IDs for special entities as destination */}
            {watchedParaQuienTipo === "banco" && (() => {
              if (form.getValues("paraQuienId") !== "banco") {
                form.setValue("paraQuienId", "banco");
              }
              return null;
            })()}
            
            {watchedParaQuienTipo === "lcdm" && (() => {
              if (form.getValues("paraQuienId") !== "lcdm") {
                form.setValue("paraQuienId", "lcdm");
              }
              return null;
            })()}
            
            {watchedParaQuienTipo === "postobon" && (() => {
              if (form.getValues("paraQuienId") !== "postobon") {
                form.setValue("paraQuienId", "postobon");
              }
              return null;
            })()}

            {/* Campo cuenta Postobón - aparece cuando Postobón está seleccionado como destino */}
            {watchedParaQuienTipo === "postobon" && (
              <FormField
                control={form.control}
                name="postobonCuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta Postobón</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="santa-rosa">Santa Rosa</SelectItem>
                        <SelectItem value="cimitarra">Cimitarra</SelectItem>
                        <SelectItem value="otras">Otras</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Para quién específico - RodMar */}
            {watchedParaQuienTipo === "rodmar" && (
              <FormField
                control={form.control}
                name="paraQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta RodMar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                    <FormLabel>
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
                  <FormLabel>Valor</FormLabel>
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fecha */}
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                  <FormLabel>Forma de Pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
                  <FormLabel>Voucher (Opcional)</FormLabel>
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

            {/* Comentario */}
            <FormField
              control={form.control}
              name="comentario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Comentarios adicionales..." 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="modal-buttons-container flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createTransactionMutation.isPending}
              >
                {createTransactionMutation.isPending ? "Registrando..." : "Registrar Transacción"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Exportaciones
export { NewTransactionModal };
export default NewTransactionModal;