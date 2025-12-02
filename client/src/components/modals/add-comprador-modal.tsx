import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertCompradorSchema } from "@shared/schema";
import type { InsertComprador } from "@shared/schema";

interface AddCompradorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddCompradorModal({ open, onOpenChange }: AddCompradorModalProps) {
  const { toast } = useToast();

  const form = useForm<InsertComprador>({
    resolver: zodResolver(insertCompradorSchema),
    defaultValues: {
      nombre: "",
      saldo: "0",
    },
  });

  const createCompradorMutation = useMutation({
    mutationFn: async (data: InsertComprador) => {
      const response = await apiRequest("POST", "/api/compradores", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      toast({
        title: "Comprador agregado",
        description: "El comprador ha sido agregado exitosamente.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo agregar el comprador. " + error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertComprador) => {
    createCompradorMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agregar Nuevo Comprador
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Comprador</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Cemex S.A." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createCompradorMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createCompradorMutation.isPending}
              >
                {createCompradorMutation.isPending ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}