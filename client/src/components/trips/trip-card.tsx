import { Trip, Mina, Comprador } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TripCardProps {
  trip: Trip;
  showExtended?: boolean;
  minas: Mina[];
  compradores: Comprador[];
}

export function TripCard({ trip, showExtended = false, minas, compradores }: TripCardProps) {
  const mina = minas.find(m => m.id === trip.minaId);
  const comprador = compradores.find(c => c.id === trip.compradorId);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completado":
        return <Badge className="bg-[hsl(122,39%,49%)]/10 text-[hsl(122,39%,49%)] border-0">Completado</Badge>;
      case "pendiente":
        return <Badge className="bg-[hsl(45,100%,51%)]/10 text-[hsl(45,100%,51%)] border-0">Pendiente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(parseFloat(value));
  };

  return (
    <Card className="hover:shadow-sm transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              trip.status === 'completado' 
                ? 'bg-[hsl(207,90%,54%)]/10' 
                : 'bg-[hsl(45,100%,51%)]/10'
            }`}>
              <svg className={`w-5 h-5 ${
                trip.status === 'completado' 
                  ? 'text-[hsl(207,90%,54%)]' 
                  : 'text-[hsl(45,100%,51%)]'
              }`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-secondary-custom">{trip.id}</h3>
              <p className="text-sm text-gray-500 capitalize">{trip.status}</p>
            </div>
          </div>
          {getStatusBadge(trip.status)}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">F. Cargue</p>
            <p className="font-medium">
              {format(new Date(trip.fechaCargue), "dd/MM/yyyy", { locale: es })}
            </p>
          </div>
          <div>
            <p className="text-gray-500">F. Descargue</p>
            <p className="font-medium">
              {trip.fechaDescargue 
                ? format(new Date(trip.fechaDescargue), "dd/MM/yyyy", { locale: es })
                : <span className="text-gray-400">Pendiente</span>
              }
            </p>
          </div>
          <div>
            <p className="text-gray-500">Conductor</p>
            <p className="font-medium">{trip.conductor}</p>
          </div>
          <div>
            <p className="text-gray-500">Placa</p>
            <p className="font-medium">{trip.placa}</p>
          </div>
          <div>
            <p className="text-gray-500">Mina</p>
            <p className="font-medium">{mina?.nombre || "N/A"}</p>
          </div>
          <div>
            <p className="text-gray-500">Comprador</p>
            <p className="font-medium">
              {comprador?.nombre || <span className="text-gray-400">Por asignar</span>}
            </p>
          </div>
          {trip.peso && (
            <div>
              <p className="text-gray-500">Peso (Ton.)</p>
              <p className="font-medium">{trip.peso}</p>
            </div>
          )}
          {trip.ganancia && (
            <div>
              <p className="text-gray-500">Ganancia</p>
              <p className="font-medium text-[hsl(122,39%,49%)]">
                {formatCurrency(trip.ganancia)}
              </p>
            </div>
          )}
        </div>

        {/* Extended View */}
        {showExtended && trip.status === 'completado' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {trip.ventaTon && (
                <div>
                  <p className="text-gray-500">VUT</p>
                  <p className="font-medium">{formatCurrency(trip.ventaTon)}</p>
                </div>
              )}
              {trip.precioCompraTon && (
                <div>
                  <p className="text-gray-500">CUT</p>
                  <p className="font-medium">{formatCurrency(trip.precioCompraTon)}</p>
                </div>
              )}
              {trip.fleteTon && (
                <div>
                  <p className="text-gray-500">FUT</p>
                  <p className="font-medium">{formatCurrency(trip.fleteTon)}</p>
                </div>
              )}
              {trip.totalVenta && (
                <div>
                  <p className="text-gray-500">Total Venta</p>
                  <p className="font-medium">{formatCurrency(trip.totalVenta)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
