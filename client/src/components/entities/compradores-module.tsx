import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Handshake } from "lucide-react";

const compradorSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
});

type CompradorFormData = z.infer<typeof compradorSchema>;

export function CompradoresModule() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { data: compradores = [], isLoading } = useQuery({
    queryKey: ["/api/compradores"],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CompradorFormData>({
    resolver: zodResolver(compradorSchema),
    defaultValues: {
      nombre: "",
    }
  });

  const createCompradorMutation = useMutation({
    mutationFn: async (data: CompradorFormData) => {
      const response = await apiRequest("POST", "/api/compradores", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      toast({
        title: "Comprador creado",
        description: "El comprador se ha creado exitosamente",
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

  const onSubmit = (data: CompradorFormData) => {
    createCompradorMutation.mutate(data);
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
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Gestión de Compradores</h2>
        
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Comprador</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre del Comprador</Label>
                <Input
                  id="nombre"
                  {...form.register("nombre")}
                  placeholder="Ingrese el nombre del comprador"
                />
                {form.formState.errors.nombre && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.nombre.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCompradorMutation.isPending}
                >
                  {createCompradorMutation.isPending ? "Creando..." : "Crear Comprador"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {compradores.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Handshake className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay compradores registrados</p>
              <p className="text-sm text-muted-foreground">
                Haz clic en el botón + para agregar el primer comprador
              </p>
            </CardContent>
          </Card>
        ) : (
          compradores.map((comprador: any) => (
            <Card key={comprador.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{comprador.nombre}</h3>
                    <p className="text-sm text-muted-foreground">ID: {comprador.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className={`font-semibold ${
                      parseFloat(comprador.saldo) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(comprador.saldo)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}