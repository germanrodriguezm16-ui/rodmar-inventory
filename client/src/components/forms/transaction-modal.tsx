import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mina, Comprador, Volquetero } from "@shared/schema";

const formSchema = z.object({
  deQuienTipo: z.string().min(1, "Debe seleccionar de quién es la transacción"),
  deQuienId: z.string().min(1, "Debe especificar de quién"),
  paraQuienTipo: z.string().min(1, "Debe seleccionar para quién es la transacción"),
  paraQuienId: z.string().min(1, "Debe especificar para quién"),
  concepto: z.string().min(1, "El concepto es requerido"),
  valor: z.string().min(1, "El valor es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  formaPago: z.string().min(1, "La forma de pago es requerida"),
  voucher: z.string().optional(),
  comentario: z.string().optional(),
});

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TransactionModal({ open, onClose }: TransactionModalProps) {
  const { toast } = useToast();
  
  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas?mode=use"],
  });

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores?mode=use"],
  });

  const { data: volqueteros = [] } = useQuery<Volquetero[]>({
    queryKey: ["/api/volqueteros?mode=use"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deQuienTipo: "",
      deQuienId: "",
      paraQuienTipo: "",
      paraQuienId: "",
      concepto: "",
      valor: "",
      fecha: (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })(),
      formaPago: "",
      voucher: "",
      comentario: "",
    },
  });

  const watchedTipoSocio = form.watch("tipoSocio");
  const watchedSocioId = form.watch("socioId");

  const getSociosOptions = () => {
    switch (watchedTipoSocio) {
      case "mina":
        return minas.map(mina => ({ id: mina.id.toString(), nombre: mina.nombre }));
      case "comprador":
        return compradores.map(comprador => ({ id: comprador.id.toString(), nombre: comprador.nombre }));
      case "volquetero":
        return volqueteros.map(volquetero => ({ id: volquetero.id.toString(), nombre: volquetero.nombre }));
      default:
        return [];
    }
  };

  const getConceptosOptions = () => {
    switch (watchedTipoSocio) {
      case "mina":
        return [
          { value: "Pago", label: "Pago" },
          { value: "Adelanto", label: "Adelanto" },
          { value: "Saldo a Favor", label: "Saldo a Favor" }
        ];
      case "comprador":
        return [
          { value: "Abono", label: "Abono" },
          { value: "Préstamo", label: "Préstamo" }
        ];
      case "volquetero":
        return [
          { value: "Pago", label: "Pago" },
          { value: "Préstamo", label: "Préstamo" },
          { value: "Saldo a favor", label: "Saldo a favor" }
        ];
      default:
        return [];
    }
  };

  const createTransactionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const transactionData = {
        tipoSocio: data.tipoSocio,
        socioId: data.tipoSocio === "volquetero" ? data.socioId : parseInt(data.socioId), // Keep string for volqueteros
        concepto: data.concepto,
        valor: data.valor,
        fecha: new Date(data.fecha + 'T00:00:00').toISOString(),
        formaPago: data.formaPago,
        // Only include voucher and comentario if they have actual values
        ...(data.voucher && data.voucher.trim() && { voucher: data.voucher.trim() }),
        ...(data.comentario && data.comentario.trim() && { comentario: data.comentario.trim() }),
      };
      
      const response = await apiRequest("POST", "/api/transacciones", transactionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] }); // Refresh volqueteros list
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] }); // Refresh minas list
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] }); // Refresh compradores list
      // Invalidate specific socio transactions
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] && 
                 typeof query.queryKey[0] === 'string' && 
                 query.queryKey[0].includes('/api/transacciones/socio/');
        }
      });
      form.reset();
      onClose();
      toast({
        title: "Transacción registrada",
        description: "La transacción ha sido registrada exitosamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo registrar la transacción.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTransactionMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Registrar Transacción</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipoSocio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Socio</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("socioId", ""); // Reset socio selection
                    form.setValue("concepto", ""); // Reset concepto selection
                  }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mina">Mina</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="volquetero">Volquetero</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedTipoSocio && (
              <FormField
                control={form.control}
                name="socioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedTipoSocio === "mina" ? "Mina" : 
                       watchedTipoSocio === "comprador" ? "Comprador" : "Nombre del Volquetero"}
                    </FormLabel>
                    {watchedTipoSocio === "volquetero" ? (
                      <FormControl>
                        <Input 
                          placeholder="Escribir nombre del volquetero" 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            form.setValue("concepto", ""); // Reset concepto when changing volquetero name
                          }}
                        />
                      </FormControl>
                    ) : (
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("concepto", ""); // Reset concepto when changing socio
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getSociosOptions().map((socio) => (
                            <SelectItem key={socio.id} value={socio.id}>
                              {socio.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {watchedTipoSocio && (watchedTipoSocio !== "volquetero" ? watchedSocioId : watchedSocioId && watchedSocioId.trim()) && (
              <FormField
                control={form.control}
                name="concepto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Concepto</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar concepto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getConceptosOptions().map((concepto) => (
                          <SelectItem key={concepto.value} value={concepto.value}>
                            {concepto.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input type="text" inputMode="numeric" placeholder="0" className="pl-8" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
            
            <FormField
              control={form.control}
              name="formaPago"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pago</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar forma de pago" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="consignacion">Consignación</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="voucher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voucher (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Número de voucher o referencia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="comentario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Comentarios adicionales sobre la transacción" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex space-x-3 pt-4">
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
                disabled={createTransactionMutation.isPending}
              >
                {createTransactionMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
