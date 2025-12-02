import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useMinas } from "@/hooks/use-entities";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mountain } from "lucide-react";

const minaSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
});

type MinaFormData = z.infer<typeof minaSchema>;

export function MinasModule() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { data: minas = [], isLoading } = useMinas();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<MinaFormData>({
    resolver: zodResolver(minaSchema),
    defaultValues: {
      nombre: "",
    }
  });

  const createMinaMutation = useMutation({
    mutationFn: async (data: MinaFormData) => {
      const response = await apiRequest("POST", "/api/minas", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      toast({
        title: "Mina creada",
        description: "La mina se ha creado exitosamente",
      });
      setShowAddModal(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: MinaFormData) => {
    createMinaMutation.mutate(data);
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-secondary-custom">Minas</h2>
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button size="icon" className="btn-primary">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Mina</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre de la Mina</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Mina El Dorado"
                  {...form.register("nombre")}
                  className="mt-1"
                />
                {form.formState.errors.nombre && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.nombre.message}
                  </p>
                )}
              </div>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={createMinaMutation.isPending}
                >
                  {createMinaMutation.isPending ? "Creando..." : "Crear Mina"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {minas.length === 0 ? (
        <div className="text-center py-8">
          <Mountain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No hay minas registradas</p>
          <Button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primera Mina
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {minas.map(mina => (
            <Card key={mina.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[hsl(207,90%,54%)]/10 rounded-lg flex items-center justify-center">
                      <Mountain className="w-5 h-5 text-[hsl(207,90%,54%)]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-secondary-custom">{mina.nombre}</h3>
                      <p className="text-sm text-gray-500">ID: {mina.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Saldo</p>
                    <p className={`font-semibold ${
                      parseFloat(mina.saldo!) >= 0 
                        ? 'text-[hsl(122,39%,49%)]' 
                        : 'text-[hsl(4,90%,58%)]'
                    }`}>
                      {formatCurrency(mina.saldo!)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <Button variant="outline" className="flex-1 text-sm">
                    Viajes
                  </Button>
                  <Button variant="outline" className="flex-1 text-sm">
                    Transacciones
                  </Button>
                  <Button variant="outline" className="flex-1 text-sm">
                    Balance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
