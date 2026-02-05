import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mina } from "@shared/schema";

const formSchema = z.object({
  precioCompraTonDefault: z.string().min(1, "El precio es requerido"),
});

interface PreciosMinaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mina?: Mina | null;
}

const formatNumber = (value: string): string => {
  const normalized = String(value ?? "").trim();
  // Si viene de Postgres NUMERIC(10,2) típicamente llega como "150000.00" -> no debe multiplicar x100
  const withoutDbDecimals = /^\d+\.\d{2}$/.test(normalized) ? normalized.split(".")[0] : normalized;
  const numbers = withoutDbDecimals.replace(/[^\d]/g, "");
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const getNumericValue = (formattedValue: string): string => {
  const normalized = String(formattedValue ?? "").trim();
  const withoutDbDecimals = /^\d+\.\d{2}$/.test(normalized) ? normalized.split(".")[0] : normalized;
  return withoutDbDecimals.replace(/[^\d]/g, "");
};

export default function PreciosMinaModal({ open, onOpenChange, mina }: PreciosMinaModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      precioCompraTonDefault: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    const current = mina?.precioCompraTonDefault ?? "0";
    const formatted = formatNumber(String(current));
    setLocalValue(formatted);
    form.reset({ precioCompraTonDefault: formatted });
  }, [open, mina, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!mina) throw new Error("Mina no válida");
      const payload = {
        precioCompraTonDefault: getNumericValue(data.precioCompraTonDefault || "0"),
      };
      const response = await apiRequest("PATCH", `/api/minas/${mina.id}/precios`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${mina?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      toast({
        title: "Precios actualizados",
        description: "El precio por defecto de la mina fue actualizado.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron actualizar los precios.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Precios de la mina</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="precioCompraTonDefault"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio de compra por tonelada</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={localValue}
                      onChange={(e) => {
                        const formatted = formatNumber(e.target.value);
                        setLocalValue(formatted);
                        field.onChange(formatted);
                      }}
                      placeholder="Ej: 150000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
