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
import { z } from "zod";
import type { Tercero } from "@shared/schema";

const editTerceroSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
});

type EditTerceroFormData = z.infer<typeof editTerceroSchema>;

interface EditTerceroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tercero: Tercero | null;
}

export default function EditTerceroModal({ open, onOpenChange, tercero }: EditTerceroModalProps) {
  const { toast } = useToast();

  const form = useForm<EditTerceroFormData>({
    resolver: zodResolver(editTerceroSchema),
    defaultValues: {
      nombre: tercero?.nombre || "",
    },
  });

  // Reset form when tercero changes
  useEffect(() => {
    if (tercero) {
      form.reset({
        nombre: tercero.nombre || "",
      });
    }
  }, [tercero, form]);

  const updateTerceroMutation = useMutation({
    mutationFn: async (data: EditTerceroFormData) => {
      if (!tercero) throw new Error("No hay tercero para editar");
      return apiRequest("PATCH", `/api/terceros/${tercero.id}/nombre`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terceros"] });
      toast({
        title: "Tercero actualizado",
        description: "El nombre del tercero ha sido actualizado exitosamente.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el tercero",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditTerceroFormData) => {
    updateTerceroMutation.mutate(data);
  };

  if (!tercero) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Tercero
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
                disabled={updateTerceroMutation.isPending}
              >
                {updateTerceroMutation.isPending ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

