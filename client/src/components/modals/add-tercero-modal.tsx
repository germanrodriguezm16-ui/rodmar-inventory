import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertTerceroSchema } from "@shared/schema";
import type { InsertTercero } from "@shared/schema";

interface AddTerceroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddTerceroModal({ open, onOpenChange }: AddTerceroModalProps) {
  const { toast } = useToast();

  const form = useForm<InsertTercero>({
    resolver: zodResolver(insertTerceroSchema),
    defaultValues: {
      nombre: "",
      saldo: "0",
    },
  });

  const createTerceroMutation = useMutation({
    mutationFn: async (data: InsertTercero) => {
      const response = await apiRequest("POST", "/api/terceros", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
      toast({
        title: "Tercero agregado",
        description: "El tercero ha sido agregado exitosamente.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo agregar el tercero. " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTercero) => {
    createTerceroMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Agregar Nuevo Tercero
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Tercero</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ej: Tarjeta de Crédito, Préstamo, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createTerceroMutation.isPending}
              >
                {createTerceroMutation.isPending ? "Agregando..." : "Agregar Tercero"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
