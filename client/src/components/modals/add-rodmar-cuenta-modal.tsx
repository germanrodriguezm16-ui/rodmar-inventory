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
import { z } from "zod";

interface AddRodmarCuentaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddRodmarCuentaModal({ open, onOpenChange }: AddRodmarCuentaModalProps) {
  const { toast } = useToast();

  const form = useForm<{ nombre: string }>({
    resolver: zodResolver(z.object({ nombre: z.string().min(1, "El nombre es requerido") })),
    defaultValues: {
      nombre: "",
    },
  });

  const createCuentaMutation = useMutation({
    mutationFn: async (data: { nombre: string }) => {
      const response = await apiRequest("POST", "/api/rodmar-cuentas", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-cuentas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances/rodmar"] });
      toast({
        title: "Cuenta agregada",
        description: "La cuenta RodMar ha sido agregada exitosamente.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar la cuenta. " + (error.response?.json?.() || ""),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: { nombre: string }) => {
    // El código se auto-genera en el backend desde el nombre
    createCuentaMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Agregar Nueva Cuenta RodMar
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Cuenta</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ej: Cuenta Principal, Banco ABC, etc." />
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
                disabled={createCuentaMutation.isPending}
              >
                {createCuentaMutation.isPending ? "Agregando..." : "Agregar Cuenta"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

