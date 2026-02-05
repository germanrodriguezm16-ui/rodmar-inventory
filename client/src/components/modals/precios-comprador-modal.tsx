import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Comprador } from "@shared/schema";

const formSchema = z.object({
  ventaTonDefault: z.string().min(1, "El precio es requerido"),
  fleteTonDefaultSencillo: z.string().min(1, "El flete (sencillo) es requerido"),
  otgDefaultSencillo: z.string().min(1, "El OTG (sencillo) es requerido"),
  fleteTonDefaultDobleTroque: z.string().min(1, "El flete (doble troque) es requerido"),
  otgDefaultDobleTroque: z.string().min(1, "El OTG (doble troque) es requerido"),
  quienPagaFleteDefault: z.enum(["comprador", "tu"]),
});

interface PreciosCompradorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprador?: Comprador | null;
}

const formatNumber = (value: string): string => {
  const normalized = String(value ?? "").trim();
  // Si viene de Postgres NUMERIC(10,2) típicamente llega como "80000.00" -> no debe multiplicar x100
  const withoutDbDecimals = /^\d+\.\d{2}$/.test(normalized) ? normalized.split(".")[0] : normalized;
  const numbers = withoutDbDecimals.replace(/[^\d]/g, "");
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const getNumericValue = (formattedValue: string): string => {
  const normalized = String(formattedValue ?? "").trim();
  const withoutDbDecimals = /^\d+\.\d{2}$/.test(normalized) ? normalized.split(".")[0] : normalized;
  return withoutDbDecimals.replace(/[^\d]/g, "");
};

export default function PreciosCompradorModal({
  open,
  onOpenChange,
  comprador,
}: PreciosCompradorModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localVenta, setLocalVenta] = useState("");
  const [localFleteSencillo, setLocalFleteSencillo] = useState("");
  const [localOtgSencillo, setLocalOtgSencillo] = useState("");
  const [localFleteDoble, setLocalFleteDoble] = useState("");
  const [localOtgDoble, setLocalOtgDoble] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ventaTonDefault: "",
      fleteTonDefaultSencillo: "",
      otgDefaultSencillo: "",
      fleteTonDefaultDobleTroque: "",
      otgDefaultDobleTroque: "",
      quienPagaFleteDefault: "comprador",
    },
  });

  useEffect(() => {
    if (!open) return;
    const venta = formatNumber(String(comprador?.ventaTonDefault ?? "0"));
    const fleteS = formatNumber(String(comprador?.fleteTonDefaultSencillo ?? "0"));
    const otgS = formatNumber(String(comprador?.otgDefaultSencillo ?? "0"));
    const fleteD = formatNumber(String(comprador?.fleteTonDefaultDobleTroque ?? "0"));
    const otgD = formatNumber(String(comprador?.otgDefaultDobleTroque ?? "0"));
    const quienPaga = (comprador?.quienPagaFleteDefault === "tu" ? "tu" : "comprador") as
      | "comprador"
      | "tu";

    setLocalVenta(venta);
    setLocalFleteSencillo(fleteS);
    setLocalOtgSencillo(otgS);
    setLocalFleteDoble(fleteD);
    setLocalOtgDoble(otgD);

    form.reset({
      ventaTonDefault: venta,
      fleteTonDefaultSencillo: fleteS,
      otgDefaultSencillo: otgS,
      fleteTonDefaultDobleTroque: fleteD,
      otgDefaultDobleTroque: otgD,
      quienPagaFleteDefault: quienPaga,
    });
  }, [open, comprador, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!comprador) throw new Error("Comprador no válido");
      const payload = {
        ventaTonDefault: getNumericValue(data.ventaTonDefault || "0"),
        fleteTonDefaultSencillo: getNumericValue(data.fleteTonDefaultSencillo || "0"),
        otgDefaultSencillo: getNumericValue(data.otgDefaultSencillo || "0"),
        fleteTonDefaultDobleTroque: getNumericValue(data.fleteTonDefaultDobleTroque || "0"),
        otgDefaultDobleTroque: getNumericValue(data.otgDefaultDobleTroque || "0"),
        quienPagaFleteDefault: data.quienPagaFleteDefault,
      };
      const response = await apiRequest("PATCH", `/api/compradores/${comprador.id}/precios`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/compradores/${comprador?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      toast({
        title: "Precios actualizados",
        description: "Los defaults del comprador fueron actualizados.",
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
          <DialogTitle>Precios del comprador</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="ventaTonDefault"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio de venta por tonelada</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={localVenta}
                      onChange={(e) => {
                        const formatted = formatNumber(e.target.value);
                        setLocalVenta(formatted);
                        field.onChange(formatted);
                      }}
                      placeholder="Ej: 180000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quienPagaFleteDefault"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Quién paga el flete? (default)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="tu">Tú / RodMar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border p-3 space-y-3">
              <div className="font-medium">Flete + OTG (Sencillo)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="fleteTonDefaultSencillo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flete por tonelada</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={localFleteSencillo}
                          onChange={(e) => {
                            const formatted = formatNumber(e.target.value);
                            setLocalFleteSencillo(formatted);
                            field.onChange(formatted);
                          }}
                          placeholder="Ej: 60000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="otgDefaultSencillo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OTG</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={localOtgSencillo}
                          onChange={(e) => {
                            const formatted = formatNumber(e.target.value);
                            setLocalOtgSencillo(formatted);
                            field.onChange(formatted);
                          }}
                          placeholder="Ej: 5000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="font-medium">Flete + OTG (Doble Troque)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="fleteTonDefaultDobleTroque"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flete por tonelada</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={localFleteDoble}
                          onChange={(e) => {
                            const formatted = formatNumber(e.target.value);
                            setLocalFleteDoble(formatted);
                            field.onChange(formatted);
                          }}
                          placeholder="Ej: 70000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="otgDefaultDobleTroque"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OTG</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={localOtgDoble}
                          onChange={(e) => {
                            const formatted = formatNumber(e.target.value);
                            setLocalOtgDoble(formatted);
                            field.onChange(formatted);
                          }}
                          placeholder="Ej: 5000"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
