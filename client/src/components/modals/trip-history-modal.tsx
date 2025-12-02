import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Calendar, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ViajeWithDetails, Mina } from "@shared/schema";
import TripEditModal from "./trip-edit-modal";

interface TripHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mina: Mina;
}

export default function TripHistoryModal({ open, onOpenChange, mina }: TripHistoryModalProps) {
  const [selectedTrip, setSelectedTrip] = useState<ViajeWithDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: viajes = [], isLoading, error } = useQuery<ViajeWithDetails[]>({
    queryKey: ["/api/viajes/mina", mina.id],
    enabled: open,
  });

  const handleEditTrip = (trip: ViajeWithDetails) => {
    setSelectedTrip(trip);
    setShowEditModal(true);
  };

  const getStatusBadge = (estado: string) => {
    return estado === "completado" ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Completado
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Pendiente
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Historial de Viajes - {mina.nombre}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando viajes...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">Error cargando viajes: {error.message}</div>
            </div>
          ) : viajes.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay viajes registrados para esta mina</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Total de viajes: {viajes.length}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>F. CARGUE</TableHead>
                      <TableHead>F. DESCARGUE</TableHead>
                      <TableHead>CONDUCTOR</TableHead>
                      <TableHead>TIPO DE CARRO</TableHead>
                      <TableHead>PLACA</TableHead>
                      <TableHead>PESO</TableHead>
                      <TableHead>CUT</TableHead>
                      <TableHead>COMPRA</TableHead>
                      <TableHead>RECIBO</TableHead>
                      <TableHead>ESTADO</TableHead>
                      <TableHead className="text-center">ACCIONES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viajes.map((viaje) => (
                      <TableRow key={viaje.id}>
                        <TableCell className="font-medium">{viaje.id}</TableCell>
                        <TableCell>{formatDate(viaje.fechaCargue)}</TableCell>
                        <TableCell>
                          {viaje.fechaDescargue ? formatDate(viaje.fechaDescargue) : "-"}
                        </TableCell>
                        <TableCell>{viaje.conductor}</TableCell>
                        <TableCell className="capitalize">{viaje.tipoCarro}</TableCell>
                        <TableCell className="font-mono">{viaje.placa}</TableCell>
                        <TableCell>
                          {viaje.peso ? `${viaje.peso} Ton` : "-"}
                        </TableCell>
                        <TableCell>
                          {viaje.cut ? formatCurrency(viaje.cut) : "-"}
                        </TableCell>
                        <TableCell>
                          {viaje.totalCompra ? formatCurrency(viaje.totalCompra) : "-"}
                        </TableCell>
                        <TableCell>{viaje.recibo || "-"}</TableCell>
                        <TableCell>{getStatusBadge(viaje.estado)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTrip(viaje)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedTrip && (
        <TripEditModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          trip={selectedTrip}
        />
      )}
    </>
  );
}