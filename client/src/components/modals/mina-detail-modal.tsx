import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mountain, Truck, Receipt, DollarSign, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calculateMinaBalance } from "@/lib/calculations";
import type { ViajeWithDetails, Mina, TransaccionWithSocio } from "@shared/schema";
import TripEditModal from "./trip-edit-modal";

interface MinaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mina: Mina;
}

export default function MinaDetailModal({ open, onOpenChange, mina }: MinaDetailModalProps) {
  const [selectedTrip, setSelectedTrip] = useState<ViajeWithDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  console.log("MinaDetailModal render:", { open, minaName: mina.nombre });

  const { data: viajes = [], isLoading: loadingViajes } = useQuery<ViajeWithDetails[]>({
    queryKey: ["/api/viajes/mina", mina.id],
    enabled: open,
  });

  const { data: transacciones = [], isLoading: loadingTransacciones } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones/socio", "mina", mina.id],
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

  // Calculate balance
  const balanceData = calculateMinaBalance(viajes, transacciones);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mountain className="h-5 w-5" />
              {mina.nombre} - Detalles
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="viajes" className="w-full">
            <TabsList className="rodmar-tabs grid w-full grid-cols-3 gap-1 p-1">
              <TabsTrigger value="viajes" className="flex items-center gap-2 text-sm px-3 py-2">
                <Truck className="h-4 w-4" />
                Viajes
              </TabsTrigger>
              <TabsTrigger value="transacciones" className="flex items-center gap-2 text-sm px-3 py-2">
                <Receipt className="h-4 w-4" />
                Transacciones
              </TabsTrigger>
              <TabsTrigger value="balance" className="flex items-center gap-2 text-sm px-3 py-2">
                <DollarSign className="h-4 w-4" />
                Balance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="viajes" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Historial de Viajes</h3>
                <div className="text-sm text-muted-foreground">
                  Total: {viajes.length} viajes
                </div>
              </div>

              {loadingViajes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Cargando viajes...</div>
                </div>
              ) : viajes.length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay viajes registrados para esta mina</p>
                </div>
              ) : (
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
              )}
            </TabsContent>

            <TabsContent value="transacciones" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Transacciones de la Mina</h3>
                <div className="text-sm text-muted-foreground">
                  Total: {transacciones.length} transacciones
                </div>
              </div>

              {loadingTransacciones ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Cargando transacciones...</div>
                </div>
              ) : transacciones.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay transacciones registradas para esta mina</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>FECHA</TableHead>
                        <TableHead>CONCEPTO</TableHead>
                        <TableHead>VALOR</TableHead>
                        <TableHead>OBSERVACIONES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transacciones.map((transaccion) => (
                        <TableRow key={transaccion.id}>
                          <TableCell>{formatDate(transaccion.fecha)}</TableCell>
                          <TableCell>{transaccion.concepto}</TableCell>
                          <TableCell className={`font-semibold ${
                            // Si es transacción hacia la mina (paraQuienTipo === 'mina'), mostrar en rojo
                            transaccion.paraQuienTipo === 'mina'
                              ? "text-red-600"
                              : parseFloat(transaccion.valor) >= 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {/* Mostrar signo negativo para transacciones hacia la mina */}
                            {transaccion.paraQuienTipo === 'mina' ? '-' : ''}
                            {formatCurrency(transaccion.valor)}
                          </TableCell>
                          <TableCell>{transaccion.observaciones || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="balance" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Balance de la Mina</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Compras (Viajes)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(balanceData.totalCompras)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {balanceData.totalViajes} viajes completados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Transacciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(balanceData.totalTransacciones)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {balanceData.countTransacciones} transacciones
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Saldo Final
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      balanceData.saldoFinal >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(balanceData.saldoFinal)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Compras - Transacciones
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalle del Cálculo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Total valor de compras en viajes:</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(balanceData.totalCompras)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Total transacciones registradas:</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(balanceData.totalTransacciones)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t-2 border-gray-200">
                    <span className="font-semibold">Saldo final de la mina:</span>
                    <span className={`text-xl font-bold ${
                      balanceData.saldoFinal >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(balanceData.saldoFinal)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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