import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Mountain, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mina } from "@shared/schema";

export default function Minas() {
  const [newMinaName, setNewMinaName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const { data: minas = [], isLoading } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
  });

  const createMinaMutation = useMutation({
    mutationFn: async (nombre: string) => {
      const response = await apiRequest("POST", "/api/minas", { nombre });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      setNewMinaName("");
      setShowCreateDialog(false);
      toast({
        title: "Mina creada",
        description: "La mina ha sido creada exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la mina.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMinaName.trim()) {
      createMinaMutation.mutate(newMinaName.trim());
    }
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando minas...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Minas</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Mina</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Nombre de la mina"
                value={newMinaName}
                onChange={(e) => setNewMinaName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMinaMutation.isPending}
                >
                  {createMinaMutation.isPending ? "Creando..." : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {minas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No hay minas registradas
        </div>
      ) : (
        <div className="space-y-3">
          {minas.map((mina) => (
            <Card key={mina.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Mountain className="text-primary w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{mina.nombre}</h3>
                      <p className="text-sm text-muted-foreground">
                        Mina activa
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className={`font-semibold ${
                      parseFloat(mina.saldo) >= 0 ? "text-success" : "text-error"
                    }`}>
                      {formatCurrency(mina.saldo)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Viajes
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Transacciones
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
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
