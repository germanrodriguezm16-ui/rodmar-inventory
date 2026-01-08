import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { updateRodmarCuentaNombreSchema } from "@shared/schema";

const editCuentaSchema = updateRodmarCuentaNombreSchema;

type EditCuentaFormData = {
  nombre: string;
};

interface EditRodmarCuentaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuenta: any | null;
}

export default function EditRodmarCuentaModal({ open, onOpenChange, cuenta }: EditRodmarCuentaModalProps) {
  const { toast } = useToast();

  const form = useForm<EditCuentaFormData>({
    resolver: zodResolver(editCuentaSchema),
    defaultValues: {
      nombre: cuenta?.nombre || cuenta?.cuenta || "",
    },
  });

  // Reset form when cuenta changes
  useEffect(() => {
    if (cuenta) {
      form.reset({
        nombre: cuenta.nombre || cuenta.cuenta || "",
      });
    }
  }, [cuenta, form]);

  const updateCuentaMutation = useMutation({
    mutationFn: async (data: EditCuentaFormData) => {
      if (!cuenta) throw new Error("No hay cuenta para editar");
      const cuentaId = cuenta.id;
      if (!cuentaId) throw new Error("ID de cuenta no válido");
      return apiRequest("PATCH", `/api/rodmar-cuentas/${cuentaId}/nombre`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-cuentas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances/rodmar"] });
      toast({
        title: "Cuenta actualizada",
        description: "El nombre de la cuenta ha sido actualizado exitosamente.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la cuenta",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditCuentaFormData) => {
    updateCuentaMutation.mutate(data);
  };

  if (!cuenta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Cuenta RodMar
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
                  {cuenta.codigo && (
                    <p className="text-xs text-muted-foreground">
                      Código: {cuenta.codigo} (no se puede cambiar)
                    </p>
                  )}
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
                disabled={updateCuentaMutation.isPending}
              >
                {updateCuentaMutation.isPending ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

