import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import type { Volquetero } from "@shared/schema";

export default function Volqueteros() {
  const { data: volqueteros = [], isLoading } = useQuery<Volquetero[]>({
    queryKey: ["/api/volqueteros"],
  });

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
        <div className="text-muted-foreground">Cargando volqueteros...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Volqueteros</h2>
      </div>

      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Los volqueteros se crean automáticamente al registrar transacciones.
        </p>
      </div>

      {volqueteros.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No hay volqueteros registrados
        </div>
      ) : (
        <div className="space-y-3">
          {volqueteros.map((volquetero) => (
            <Card key={volquetero.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Users className="text-primary w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{volquetero.nombre}</h3>
                      <p className="text-sm text-muted-foreground">
                        Placa: {volquetero.placa}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className={`font-semibold ${
                      parseFloat(volquetero.saldo) >= 0 ? "text-success" : "text-error"
                    }`}>
                      {formatCurrency(volquetero.saldo)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-2">
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
