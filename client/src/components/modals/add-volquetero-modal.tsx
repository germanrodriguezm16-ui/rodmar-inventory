import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Truck, Loader2 } from "lucide-react";
import type { InsertVolquetero } from "@shared/schema";
import { insertVolqueteroSchema } from "@shared/schema";

interface AddVolqueteroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddVolqueteroModal({ open, onOpenChange }: AddVolqueteroModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertVolquetero>({
    resolver: zodResolver(insertVolqueteroSchema),
    defaultValues: {
      nombre: "",
      placa: "",
    },
  });

  const createVolqueteroMutation = useMutation({
    mutationFn: async (data: InsertVolquetero) => {
      const response = await apiRequest("POST", "/api/volqueteros", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || "No se pudo crear el volquetero");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros/resumen"] });
      toast({
        title: "Volquetero agregado",
        description: "El volquetero ha sido agregado exitosamente.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo agregar el volquetero. " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVolquetero) => {
    createVolqueteroMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Agregar Nuevo Volquetero
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Conductor</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nombre del conductor" />
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
                  <FormLabel>Placa del Vehículo</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="ABC123" 
                      className="uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Esta es la placa inicial. Las placas adicionales se agregarán automáticamente cuando se registren viajes.
                  </p>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createVolqueteroMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createVolqueteroMutation.isPending}
              >
                {createVolqueteroMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  "Agregar Volquetero"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

