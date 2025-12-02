import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Calendar, User, Mountain, Handshake, Weight, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ViajeWithDetails } from "@shared/schema";

interface SimpleTripCardProps {
  viaje: ViajeWithDetails;
  showExtended?: boolean;
  onClick?: () => void;
}

export default function SimpleTripCard({ viaje, showExtended = false, onClick }: SimpleTripCardProps) {
  const formatCurrency = (amount: string | null) => {
    if (!amount) return "N/A";
    const num = parseFloat(amount);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(num);
  };

  const getStatusBadge = () => {
    if (viaje.estado === "completado") {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          Completado
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          Pendiente
        </Badge>
      );
    }
  };

  const getStatusIcon = () => {
    if (viaje.estado === "completado") {
      return "text-success";
    } else {
      return "text-warning";
    }
  };

  const handleClick = () => {
    console.log("SimpleTripCard clicked:", viaje.id);
    console.log("SimpleTripCard onClick function:", onClick);
    if (onClick) {
      console.log("SimpleTripCard calling onClick");
      onClick();
    } else {
      console.log("SimpleTripCard: No onClick function provided");
    }
  };

  return (
    <Card 
      className="hover:shadow-sm transition-shadow cursor-pointer" 
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center`}>
              <Truck className={`w-5 h-5 ${getStatusIcon()}`} />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{viaje.id}</h3>
              <p className="text-sm text-muted-foreground">{viaje.estado}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Fecha Cargue</p>
              <p className="font-medium">
                {format(new Date(viaje.fechaCargue), "dd/MM/yyyy", { locale: es })}
              </p>
            </div>
          </div>

          {viaje.fechaDescargue && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Fecha Descargue</p>
                <p className="font-medium">
                  {format(new Date(viaje.fechaDescargue), "dd/MM/yyyy", { locale: es })}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Conductor</p>
              <p className="font-medium">{viaje.conductor}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Placa</p>
              <p className="font-medium">{viaje.placa}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Mountain className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Mina</p>
              <p className="font-medium">{viaje.mina?.nombre || "N/A"}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Handshake className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Comprador</p>
              <p className="font-medium">{viaje.comprador?.nombre || "N/A"}</p>
            </div>
          </div>

          {viaje.peso && (
            <div className="flex items-center space-x-2">
              <Weight className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Peso</p>
                <p className="font-medium">{viaje.peso} ton</p>
              </div>
            </div>
          )}

          {viaje.ventaTon && viaje.peso && (
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Total Venta</p>
                <p className="font-medium text-green-600">
                  {formatCurrency((viaje.peso * viaje.ventaTon).toString())}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}