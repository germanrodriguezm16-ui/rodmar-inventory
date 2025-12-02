import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Mountain } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertMinaSchema } from "@shared/schema";
import type { InsertMina } from "@shared/schema";

interface AddMinaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddMinaModal({ open, onOpenChange }: AddMinaModalProps) {
  const { toast } = useToast();

  const form = useForm<InsertMina>({
    resolver: zodResolver(insertMinaSchema),
    defaultValues: {
      nombre: "",
      saldo: "0",
    },
  });

  const createMinaMutation = useMutation({
    mutationFn: async (data: InsertMina) => {
      const response = await apiRequest("POST", "/api/minas", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      toast({
        title: "Mina agregada",
        description: "La mina ha sido agregada exitosamente.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo agregar la mina. " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertMina) => {
    createMinaMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mountain className="h-5 w-5" />
            Agregar Nueva Mina
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Mina</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nombre de la mina" />
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
                disabled={createMinaMutation.isPending}
              >
                {createMinaMutation.isPending ? "Agregando..." : "Agregar Mina"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}