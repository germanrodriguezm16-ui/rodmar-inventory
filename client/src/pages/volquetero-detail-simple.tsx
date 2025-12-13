import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Truck, Calendar, Filter, X, FileDown, Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import TripCard from "@/components/trip-card";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import { formatCurrency } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import { getAuthToken } from "@/hooks/useAuth";
// Formateo de fechas se maneja directamente en el componente
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  isAfter,
  isBefore,
  isEqual
} from "date-fns";

export default function VolqueteroDetail() {
  const { id } = useParams();
  
  const [activeTab, setActiveTab] = useState("viajes");
  
  // Estados para filtros de fecha en transacciones
  const [transaccionesFechaFilterType, setTransaccionesFechaFilterType] = useState<string>("todos");
  const [transaccionesFechaFilterValue, setTransaccionesFechaFilterValue] = useState<string>("");
  const [transaccionesFechaFilterValueEnd, setTransaccionesFechaFilterValueEnd] = useState<string>("");
  
  // Estados para modal de detalles de transacción
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);

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
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Encontrar volquetero
  const volquetero = (volqueteros as any[]).find((v: any) => 
    v.nombre === decodeURIComponent(id || "") || 
    v.placas.some((p: any) => p.placa === decodeURIComponent(id || ""))
  );

  const volqueteroIdActual = volquetero?.id || 0;

  const { data: transaccionesData = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"],
    queryFn: async () => {
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

  // Función para obtener rango de fechas según el tipo de filtro
  const getDateRange = (type: string, value?: string, valueEnd?: string) => {
    const now = new Date();
    
    switch (type) {
      case "exactamente":
        if (!value) return null;
        return { start: createLocalDate(value), end: createLocalDate(value, true) };
      
      case "entre":
        if (!value || !valueEnd) return null;
        return { 
          start: createLocalDate(value), 
          end: createLocalDate(valueEnd, true) 
        };
      
      case "despues_de":
        if (!value) return null;
        return { start: createLocalDate(value, true), end: null };
      
      case "antes_de":
        if (!value) return null;
        return { start: null, end: createLocalDate(value) };
      
      case "hoy":
        return { start: startOfDay(now), end: endOfDay(now) };
      
      case "ayer":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      
      case "esta_semana":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      
      case "semana_pasada":
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek), end: endOfWeek(lastWeek) };
      
      case "este_mes":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      
      case "mes_pasado":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      
      case "este_año":
        return { start: startOfYear(now), end: endOfYear(now) };
      
      case "año_pasado":
        const lastYear = subYears(now, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
      
      default:
        return null;
    }
  };

  // Función para filtrar transacciones por fecha usando comparación de strings
  const filterTransaccionesByDate = (transacciones: any[], filterType: string, filterValue?: string, filterValueEnd?: string) => {
    if (filterType === "todos") return transacciones;
    
    return transacciones.filter((transaccion: any) => {
      // Extraer solo la parte de fecha como string (YYYY-MM-DD) sin crear Date object
      const transactionDateString = typeof transaccion.fecha === 'string' && transaccion.fecha.includes('-') 
        ? transaccion.fecha.split('T')[0] 
        : transaccion.fecha;

      // Para filtros con valores específicos de fecha
      if (filterType === "exactamente" && filterValue) {
        return transactionDateString === filterValue;
      }

      if (filterType === "entre" && filterValue && filterValueEnd) {
        return transactionDateString >= filterValue && transactionDateString <= filterValueEnd;
      }

      if (filterType === "despues_de" && filterValue) {
        return transactionDateString > filterValue;
      }

      if (filterType === "antes_de" && filterValue) {
        return transactionDateString < filterValue;
      }

      // Para filtros preestablecidos usando comparación de strings de fechas
      const now = new Date();
      // Generar fecha local sin problemas UTC
      const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (filterType) {
        case "hoy": {
          return transactionDateString === todayString;
        }
        case "ayer": {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          return transactionDateString === yesterdayString;
        }
        case "esta_semana": {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const startWeekString = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
          return transactionDateString >= startWeekString && transactionDateString <= todayString;
        }
        case "semana_pasada": {
          const startOfLastWeek = new Date(today);
          startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
          const endOfLastWeek = new Date(startOfLastWeek);
          endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
          const startLastWeekString = `${startOfLastWeek.getFullYear()}-${String(startOfLastWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfLastWeek.getDate()).padStart(2, '0')}`;
          const endLastWeekString = `${endOfLastWeek.getFullYear()}-${String(endOfLastWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfLastWeek.getDate()).padStart(2, '0')}`;
          return transactionDateString >= startLastWeekString && transactionDateString <= endLastWeekString;
        }
        case "este_mes": {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const startMonthString = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
          return transactionDateString >= startMonthString && transactionDateString <= todayString;
        }
        case "mes_pasado": {
          const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          const startLastMonthString = `${startOfLastMonth.getFullYear()}-${String(startOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfLastMonth.getDate()).padStart(2, '0')}`;
          const endLastMonthString = `${endOfLastMonth.getFullYear()}-${String(endOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfLastMonth.getDate()).padStart(2, '0')}`;
          return transactionDateString >= startLastMonthString && transactionDateString <= endLastMonthString;
        }
        case "este_año": {
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          const startYearString = `${startOfYear.getFullYear()}-${String(startOfYear.getMonth() + 1).padStart(2, '0')}-${String(startOfYear.getDate()).padStart(2, '0')}`;
          return transactionDateString >= startYearString && transactionDateString <= todayString;
        }
        case "año_pasado": {
          const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
          const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
          const startLastYearString = `${startOfLastYear.getFullYear()}-${String(startOfLastYear.getMonth() + 1).padStart(2, '0')}-${String(startOfLastYear.getDate()).padStart(2, '0')}`;
          const endLastYearString = `${endOfLastYear.getFullYear()}-${String(endOfLastYear.getMonth() + 1).padStart(2, '0')}-${String(endOfLastYear.getDate()).padStart(2, '0')}`;
          return transactionDateString >= startLastYearString && transactionDateString <= endLastYearString;
        }
        default:
          return true;
      }
    });
  };

  // Función para obtener texto del filtro activo
  const getFilterText = (filterType: string, filterValue?: string, filterValueEnd?: string) => {
    switch (filterType) {
      case "exactamente": return filterValue ? `Exactamente: ${filterValue}` : "";
      case "entre": return filterValue && filterValueEnd ? `Entre: ${filterValue} y ${filterValueEnd}` : "";
      case "despues_de": return filterValue ? `Después de: ${filterValue}` : "";
      case "antes_de": return filterValue ? `Antes de: ${filterValue}` : "";
      case "hoy": return "Hoy";
      case "ayer": return "Ayer";
      case "esta_semana": return "Esta semana";
      case "semana_pasada": return "Semana pasada";
      case "este_mes": return "Este mes";
      case "mes_pasado": return "Mes pasado";
      case "este_año": return "Este año";
      case "año_pasado": return "Año pasado";
      default: return "";
    }
  };

  // Función para limpiar filtros
  const handleClearFilter = () => {
    setTransaccionesFechaFilterType("todos");
    setTransaccionesFechaFilterValue("");
    setTransaccionesFechaFilterValueEnd("");
  };

  // Procesar transacciones (manuales + dinámicas de viajes)
  const transaccionesCompletas = useMemo(() => {
    if (!volquetero) return [];
    
    // Transacciones manuales
    const transaccionesManuales = (transaccionesData as any[])
      .filter((t: any) => {
        // Incluir transacciones donde el volquetero es quien envía O quien recibe dinero
        return (t.deQuienTipo === 'volquetero' && t.deQuienId === volqueteroIdActual.toString()) ||
               (t.paraQuienTipo === 'volquetero' && t.paraQuienId === volqueteroIdActual.toString());
      })
      .map((t: any) => {
        // Mantener el valor original sin transformaciones
        const valorFinal = parseFloat(t.valor);
        
        return {
          id: t.id.toString(),
          concepto: t.concepto,
          valor: valorFinal,
          fecha: t.fecha,
          formaPago: t.formaPago || "",
          tipo: "Manual",
          deQuienTipo: t.deQuienTipo,
          deQuienId: t.deQuienId,
          paraQuienTipo: t.paraQuienTipo,
          paraQuienId: t.paraQuienId,
          voucher: t.voucher, // ¡Incluir el campo voucher!
          comentario: t.comentario
        };
      });

    // Transacciones dinámicas de viajes completados - Solo cuando RodMar paga el flete
    const viajesCompletados = (viajes as any[])
      .filter((v: any) => {
        return v.conductor === volquetero.nombre && 
               v.estado === "completado" && 
               v.fechaDescargue &&
               v.quienPagaFlete !== "comprador" && 
               v.quienPagaFlete !== "El comprador"; // Solo incluir si NO es el comprador quien paga
      })
      .map((v: any) => {
        const fechaViaje = v.fechaDescargue;
        const valorFinal = parseFloat(v.totalFlete || "0");
        
        return {
          id: `viaje-${v.id}`,
          concepto: `Viaje ${v.id} - Flete pagado por RodMar`,
          valor: valorFinal,
          fecha: fechaViaje,
          formaPago: "Flete RodMar",
          comentario: `Flete del viaje ${v.id} pagado por RodMar`,
          tipo: "Viaje"
        };
      });

    return [...transaccionesManuales, ...viajesCompletados]
      .sort((a: any, b: any) => {
        // Función auxiliar para extraer fecha como string YYYY-MM-DD
        const extractDateString = (transaction: any): string => {
          if (!transaction.fecha) return '1970-01-01';
          
          if (typeof transaction.fecha === 'string') {
            if (transaction.fecha.includes('T')) {
              // String ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
              return transaction.fecha.split('T')[0];
            }
            // String simple YYYY-MM-DD
            return transaction.fecha;
          }
          
          if (transaction.fecha instanceof Date) {
            // Objeto Date - usar toISOString para extraer fecha
            return transaction.fecha.toISOString().split('T')[0];
          }
          
          return '1970-01-01';
        };

        const fechaA = extractDateString(a);
        const fechaB = extractDateString(b);
        
        // Criterio primario: Fecha descendente (más recientes primero)
        if (fechaA !== fechaB) {
          return fechaB.localeCompare(fechaA);
        }
        
        // Criterio secundario: Transacciones con horaInterna (más precisas) primero
        const tieneHoraInternaA = a.horaInterna != null;
        const tieneHoraInternaB = b.horaInterna != null;
        
        if (tieneHoraInternaA && !tieneHoraInternaB) return -1;
        if (!tieneHoraInternaA && tieneHoraInternaB) return 1;
        
        // Criterio terciario: Para transacciones artificiales usar createdAt como fallback
        if (a.createdAt && b.createdAt) {
          const createdAtA = new Date(a.createdAt).getTime();
          const createdAtB = new Date(b.createdAt).getTime();
          return createdAtB - createdAtA;
        }
        
        return 0;
      });
  }, [transaccionesData, viajes, volquetero, volqueteroIdActual]);

  // Aplicar filtros de fecha a las transacciones
  const transaccionesFiltradas = useMemo(() => {
    return filterTransaccionesByDate(
      transaccionesCompletas, 
      transaccionesFechaFilterType, 
      transaccionesFechaFilterValue, 
      transaccionesFechaFilterValueEnd
    );
  }, [transaccionesCompletas, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd]);

  // Cálculos del balance resumido basado en transacciones filtradas - Nueva lógica unificada
  const balanceResumido = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    
    transaccionesFiltradas.forEach((t: any) => {
      if (t.tipo === "Manual") {
        // Lógica específica para volqueteros: LÓGICA INVERSA
        // Si el volquetero recibe dinero (paraQuienTipo: "volquetero") = egreso (rojo/negativo)
        if (t.paraQuienTipo === 'volquetero') {
          egresos += Math.abs(t.valor);
        }
        // Si el volquetero paga dinero (deQuienTipo: "volquetero") = ingreso (verde/positivo)
        if (t.deQuienTipo === 'volquetero') {
          ingresos += Math.abs(t.valor);
        }
      } else if (t.tipo === "Viaje") {
        // Transacciones de viajes son siempre ingresos (verde)
        ingresos += Math.abs(t.valor);
      }
    });
    
    const balance = ingresos - egresos;
    
    return { ingresos, egresos, balance };
  }, [transaccionesFiltradas, volqueteroIdActual]);

  // Early return si no hay volquetero
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
  const viajesVolquetero = (viajes as any[]).filter((viaje: any) => {
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
                {volquetero.placas?.length || 0} vehículo{(volquetero.placas?.length || 0) !== 1 ? 's' : ''} • {volquetero.viajesCount || 0} viajes
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
              Transacciones ({transaccionesCompletas.length})
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
                {viajesVolquetero.map((viaje: any) => (
                  <TripCard 
                    key={viaje.id} 
                    viaje={viaje}
                    context="volquetero"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transacciones" className="space-y-4">
            {/* Balance resumido */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Positivos: {formatCurrency(balanceResumido.ingresos)}
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  Negativos: {formatCurrency(balanceResumido.egresos)}
                </span>
                <span className={`font-bold ${
                  balanceResumido.balance >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  Balance: {formatCurrency(balanceResumido.balance)}
                </span>
              </div>
            </div>

            {/* Filtros de fecha */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtrar por fecha:</span>
                </div>
                
                <Select value={transaccionesFechaFilterType} onValueChange={setTransaccionesFechaFilterType}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="exactamente">Exactamente</SelectItem>
                    <SelectItem value="entre">Entre</SelectItem>
                    <SelectItem value="despues_de">Después de</SelectItem>
                    <SelectItem value="antes_de">Antes de</SelectItem>
                    <SelectItem value="hoy">Hoy</SelectItem>
                    <SelectItem value="ayer">Ayer</SelectItem>
                    <SelectItem value="esta_semana">Esta semana</SelectItem>
                    <SelectItem value="semana_pasada">Semana pasada</SelectItem>
                    <SelectItem value="este_mes">Este mes</SelectItem>
                    <SelectItem value="mes_pasado">Mes pasado</SelectItem>
                    <SelectItem value="este_año">Este año</SelectItem>
                    <SelectItem value="año_pasado">Año pasado</SelectItem>
                  </SelectContent>
                </Select>

                {(transaccionesFechaFilterType === "exactamente" || 
                  transaccionesFechaFilterType === "despues_de" || 
                  transaccionesFechaFilterType === "antes_de" ||
                  transaccionesFechaFilterType === "entre") && (
                  <Input
                    type="date"
                    value={transaccionesFechaFilterValue}
                    onChange={(e) => setTransaccionesFechaFilterValue(e.target.value)}
                    className="w-36 h-8"
                  />
                )}

                {transaccionesFechaFilterType === "entre" && (
                  <Input
                    type="date"
                    value={transaccionesFechaFilterValueEnd}
                    onChange={(e) => setTransaccionesFechaFilterValueEnd(e.target.value)}
                    className="w-36 h-8"
                    placeholder="Fecha final"
                  />
                )}

                {getFilterText(transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd) && (
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">
                      {getFilterText(transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilter}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de transacciones */}
            {transaccionesFiltradas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    {transaccionesCompletas.length === 0 
                      ? "No hay transacciones registradas" 
                      : "No hay transacciones que coincidan con los filtros aplicados"
                    }
                  </p>
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
                  {transaccionesFiltradas.map((transaccion: any) => (
                    <div 
                      key={transaccion.id} 
                      className="grid grid-cols-3 gap-4 p-3 border-b last:border-b-0 even:bg-gray-50 dark:even:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        setSelectedTransaction(transaccion);
                        setShowTransactionDetail(true);
                      }}
                    >
                      <div className="text-sm">
                        {(() => {
                          const fecha = transaccion.fecha;
                          if (typeof fecha === 'string') {
                            const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                            const [year, month, day] = dateStr.split('-');
                            return `${day}/${month}/${year?.slice(-2) || ''}`;
                          }
                          return '-';
                          return "Sin fecha";
                        })()}
                      </div>
                      <div className="text-sm">
                        {transaccion.concepto}
                        {transaccion.comentario && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {transaccion.comentario}
                          </div>
                        )}
                      </div>
                      <div className={`text-sm text-right font-medium ${
                        (() => {
                          // Lógica específica para volqueteros: LÓGICA INVERSA según especificación del usuario
                          // ROJO/NEGATIVO: cuando el volquetero RECIBE dinero (paraQuienTipo: "volquetero")
                          // VERDE/POSITIVO: cuando el volquetero PAGA dinero (deQuienTipo: "volquetero")
                          
                          if (transaccion.tipo === "Manual") {
                            // Si el volquetero recibe dinero
                            if (transaccion.paraQuienTipo === 'volquetero') {
                              return "text-red-600 dark:text-red-400"; // ROJO: volquetero recibe
                            }
                            // Si el volquetero paga dinero
                            if (transaccion.deQuienTipo === 'volquetero') {
                              return "text-green-600 dark:text-green-400"; // VERDE: volquetero paga
                            }
                          }
                          
                          // Para transacciones de viajes (son ingresos del volquetero)
                          if (transaccion.tipo === "Viaje") {
                            return "text-green-600 dark:text-green-400";
                          }
                          
                          // Fallback
                          return "text-gray-600 dark:text-gray-400";
                        })()
                      }`}>
                        {(() => {
                          // Lógica específica para volqueteros: LÓGICA INVERSA según especificación del usuario
                          // NEGATIVO: cuando el volquetero RECIBE dinero (paraQuienTipo: "volquetero")
                          // POSITIVO: cuando el volquetero PAGA dinero (deQuienTipo: "volquetero")
                          
                          if (transaccion.tipo === "Manual") {
                            // Si el volquetero recibe dinero
                            if (transaccion.paraQuienTipo === 'volquetero') {
                              return '-' + formatCurrency(Math.abs(transaccion.valor)); // NEGATIVO: volquetero recibe
                            }
                            // Si el volquetero paga dinero
                            if (transaccion.deQuienTipo === 'volquetero') {
                              return '+' + formatCurrency(Math.abs(transaccion.valor)); // POSITIVO: volquetero paga
                            }
                          }
                          
                          // Para transacciones de viajes (son ingresos del volquetero)
                          if (transaccion.tipo === "Viaje") {
                            return '+' + formatCurrency(Math.abs(transaccion.valor));
                          }
                          
                          // Fallback
                          return formatCurrency(transaccion.valor);
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
                {getFilterText(transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd) && (
                  <p className="text-sm text-muted-foreground">
                    Período: {getFilterText(transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd)}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Ingresos</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(balanceResumido.ingresos)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Egresos</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(balanceResumido.egresos)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t text-center">
                  <p className="text-sm text-muted-foreground">Balance Neto</p>
                  <p className={`text-xl font-bold ${
                    balanceResumido.balance >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(balanceResumido.balance)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de detalles de transacción */}
      {selectedTransaction && (
        <TransactionDetailModal
          open={showTransactionDetail}
          onOpenChange={setShowTransactionDetail}
          transaction={selectedTransaction}
          relatedTrip={(() => {
            // Solo para transacciones automáticas de viajes (tipo: "Viaje"), no para transacciones manuales
            if (selectedTransaction?.tipo === "Viaje" && selectedTransaction?.concepto) {
              const viajeId = selectedTransaction.concepto.match(/Viaje\s+([A-Z]\d+)/i)?.[1];
              if (viajeId) {
                return viajes.find(v => v.id === viajeId);
              }
            }
            return null;
          })()}
        />
      )}

      {/* Navegación inferior */}
      <BottomNavigation />
    </div>
  );
}