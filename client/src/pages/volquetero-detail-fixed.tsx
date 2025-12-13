import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Truck, Eye, EyeOff, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TripCard from "@/components/trip-card";
import BottomNavigation from "@/components/bottom-navigation";
import { formatCurrency } from "@/lib/utils";
// Formateo de fechas se maneja directamente en el componente
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";

import type { ViajeWithDetails, TransaccionWithSocio, VolqueteroConPlacas } from "@/lib/types";

interface VolqueteroTransaccion {
  id: string;
  concepto: string;
  valor: string;
  fecha: Date;
  formaPago: string;
  voucher: string | null;
  comentario: string | null;
  deQuienTipo: string;
  deQuienId: string;
  paraQuienTipo: string;
  paraQuienId: string;
  tipo: "Viaje" | "Manual";
  esViajeCompleto: boolean;
}

export default function VolqueteroDetail() {
  const { id } = useParams();
  
  // Todos los hooks deben declararse sin condiciones
  const [activeTab, setActiveTab] = useState("viajes");
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransaccionWithSocio | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransaccionWithSocio | null>(null);

  // Función auxiliar para crear fechas locales (evita problemas de zona horaria UTC)
  const createLocalDate = (dateString: string, isEndOfDay?: boolean): Date => {
    const timeString = isEndOfDay ? 'T23:59:59' : 'T00:00:00';
    return new Date(dateString + timeString);
  };

  const { data: volqueteros = [] } = useQuery({
    queryKey: ["/api/volqueteros"],
  });

  const { data: viajes = [] } = useQuery({
    queryKey: ["/api/viajes"],
  });

  // Procesar datos
  const volquetero = (volqueteros as VolqueteroConPlacas[]).find(v => 
    v.nombre === decodeURIComponent(id || "") || 
    v.placas.some(p => p.placa === decodeURIComponent(id || ""))
  );

  const volqueteroIdActual = volquetero?.id || 0;

  const { data: transaccionesData = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"],
    queryFn: async () => {
      const { apiUrl } = await import('@/lib/api');
      const { getAuthToken } = await import('@/hooks/useAuth');
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/volqueteros/${volqueteroIdActual}/transacciones`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    enabled: volqueteroIdActual > 0,
  });

  // Procesar transacciones
  const transaccionesFormateadas: VolqueteroTransaccion[] = useMemo(() => {
    if (!volquetero) return [];
    
    const transaccionesManuales = (transaccionesData as TransaccionWithSocio[])
      .filter(t => t.tipoSocio === 'volquetero' && t.socioId === volqueteroIdActual)
      .map(t => {
        let valorFinal = parseFloat(t.valor);
        if (t.paraQuienTipo === 'volquetero') {
          valorFinal = -Math.abs(valorFinal);
        }
        
        return {
          id: t.id.toString(),
          concepto: t.concepto,
          valor: valorFinal.toString(),
          fecha: new Date(t.fecha || Date.now()),
          formaPago: t.formaPago || "",
          voucher: t.voucher,
          comentario: t.comentario,
          deQuienTipo: t.deQuienTipo || "",
          deQuienId: t.deQuienId || "",
          paraQuienTipo: t.paraQuienTipo || "",
          paraQuienId: t.paraQuienId || "",
          tipo: "Manual" as const,
          esViajeCompleto: false
        };
      });

    const viajesCompletados = (viajes as ViajeWithDetails[])
      .filter(v => v.conductor === volquetero.nombre && v.estado === "completado" && v.fechaDescargue)
      .map(v => {
        const fechaViaje = v.fechaDescargue!;
        let valorFinal = parseFloat(v.totalFlete || "0");
        if (v.quienPagaFlete === "comprador") {
          valorFinal = 0;
        }
        
        return {
          id: `viaje-${v.id}`,
          concepto: `Viaje ${v.id}`,
          valor: valorFinal.toString(),
          fecha: fechaViaje,
          formaPago: "",
          voucher: null,
          comentario: v.quienPagaFlete === "comprador" ? "Flete pagado por comprador" : null,
          deQuienTipo: "viaje",
          deQuienId: v.id,
          paraQuienTipo: "volquetero",
          paraQuienId: volqueteroIdActual.toString(),
          tipo: "Viaje" as const,
          esViajeCompleto: true
        };
      });

    return [...transaccionesManuales, ...viajesCompletados]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [transaccionesData, viajes, volquetero, volqueteroIdActual]);

  // Early return después de todos los hooks
  if (!volquetero) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Volquetero no encontrado</p>
              <Link href="/volqueteros">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Volqueteros
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Filtrar viajes del volquetero específico
  const viajesVolquetero = (viajes as ViajeWithDetails[]).filter((viaje) => {
    return viaje.conductor === volquetero.nombre;
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-card shadow-sm border-b">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/volqueteros">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{volquetero.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                {volquetero.placas.length} vehículo{volquetero.placas.length !== 1 ? 's' : ''} • {volquetero.viajesCount || 0} viajes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="viajes" className="text-xs">
              Viajes ({viajesVolquetero.length})
            </TabsTrigger>
            <TabsTrigger value="transacciones" className="text-xs">
              Transacciones ({transaccionesFormateadas.length})
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-xs">
              Balance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="viajes" className="space-y-4">
            {viajesVolquetero.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay viajes registrados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {viajesVolquetero.map((viaje) => (
                  <TripCard 
                    key={viaje.id} 
                    viaje={viaje}
                    showIndividualToggle={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transacciones" className="space-y-4">
            {transaccionesFormateadas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No hay transacciones registradas</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm overflow-hidden">
                  <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-b font-medium text-sm">
                    <div>FECHA</div>
                    <div>CONCEPTO</div>
                    <div className="text-right">VALOR</div>
                  </div>
                  {transaccionesFormateadas.map((transaccion) => (
                    <div key={transaccion.id} className="grid grid-cols-3 gap-4 p-3 border-b last:border-b-0 even:bg-gray-50 dark:even:bg-gray-800/50">
                      <div className="text-sm">
                        {(() => {
                          const fecha = transaccion.fecha;
                          if (typeof fecha === 'string') {
                            const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                            const [year, month, day] = dateStr.split('-');
                            return `${day}/${month}/${year?.slice(-2) || ''}`;
                          } else if (fecha instanceof Date) {
                            const year = fecha.getFullYear();
                            const month = String(fecha.getMonth() + 1).padStart(2, '0');
                            const day = String(fecha.getDate()).padStart(2, '0');
                            return `${day}/${month}/${year.toString().slice(-2)}`;
                          }
                          return "Sin fecha";
                        })()}
                      </div>
                      <div className="text-sm">{transaccion.concepto}</div>
                      <div className={`text-sm text-right font-medium ${
                        (() => {
                          // Nueva lógica unificada: basada en el destino de la transacción
                          // ROJO/NEGATIVO: destino mina, comprador, volquetero
                          // VERDE/POSITIVO: destino RodMar, Banco
                          
                          if (transaccion.tipo === "Manual") {
                            // Para transacciones manuales, verificar el destino
                            if (transaccion.paraQuienTipo) {
                              const isToPartner = transaccion.paraQuienTipo === 'mina' || 
                                                transaccion.paraQuienTipo === 'comprador' || 
                                                transaccion.paraQuienTipo === 'volquetero';
                              const isToRodMarOrBank = transaccion.paraQuienTipo === 'rodmar' || 
                                                     transaccion.paraQuienTipo === 'banco';
                              
                              if (isToPartner) {
                                return "text-red-600 dark:text-red-400"; // ROJO para destino socios
                              } else if (isToRodMarOrBank) {
                                return "text-green-600 dark:text-green-400"; // VERDE para destino RodMar/Banco
                              }
                            }
                          }
                          
                          // Para transacciones de viajes (sin paraQuienTipo), son positivas (verde)
                          if (transaccion.tipo === "Viaje") {
                            return "text-green-600 dark:text-green-400";
                          }
                          
                          // Fallback
                          return "text-gray-600 dark:text-gray-400";
                        })()
                      }`}>
                        {(() => {
                          // Nueva lógica para signos: negativo para destino socios, positivo para RodMar/Banco
                          if (transaccion.tipo === "Manual") {
                            if (transaccion.paraQuienTipo) {
                              const isToPartner = transaccion.paraQuienTipo === 'mina' || 
                                                transaccion.paraQuienTipo === 'comprador' || 
                                                transaccion.paraQuienTipo === 'volquetero';
                              
                              if (isToPartner) {
                                return '-' + formatCurrency(Math.abs(parseFloat(transaccion.valor))); // Negativo para destino socios
                              } else {
                                return '+' + formatCurrency(Math.abs(parseFloat(transaccion.valor))); // Positivo para destino RodMar/Banco
                              }
                            }
                          }
                          
                          // Para transacciones de viajes (sin paraQuienTipo), son positivas
                          if (transaccion.tipo === "Viaje") {
                            return '+' + formatCurrency(Math.abs(parseFloat(transaccion.valor)));
                          }
                          
                          // Fallback
                          return formatCurrency(parseFloat(transaccion.valor));
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="balance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Balance General</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Ingresos</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(transaccionesFormateadas
                        .filter(t => parseFloat(t.valor) > 0)
                        .reduce((sum, t) => sum + parseFloat(t.valor), 0)
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Egresos</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(Math.abs(transaccionesFormateadas
                        .filter(t => parseFloat(t.valor) < 0)
                        .reduce((sum, t) => sum + parseFloat(t.valor), 0)
                      ))}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t text-center">
                  <p className="text-sm text-muted-foreground">Balance Neto</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(transaccionesFormateadas.reduce((sum, t) => sum + parseFloat(t.valor), 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>



      {/* Modals */}
      <NewTransactionModal
        open={showNewTransactionModal}
        onOpenChange={setShowNewTransactionModal}
        defaultValues={{
          tipoSocio: "volquetero" as const,
          socioId: volqueteroIdActual,
          socioNombre: volquetero.nombre,
        }}
      />

      <EditTransactionModal
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        transaction={editingTransaction}
      />

      <DeleteTransactionModal
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        transaction={deletingTransaction}
      />

      {/* Navegación inferior */}
      <BottomNavigation />
    </div>
  );
}