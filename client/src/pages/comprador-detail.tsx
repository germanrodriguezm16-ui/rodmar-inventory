import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Users, Receipt, DollarSign, Truck, Calendar, X, Download, Eye, EyeOff,
  TrendingUp, TrendingDown, PieChart, BarChart3, LineChart, Calculator, Edit, Trash2, Plus, Search
} from "lucide-react";
import { useLocation } from "wouter";
import type { Comprador, TransaccionWithSocio, ViajeWithDetails } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
// Función para obtener día de la semana abreviado
const getDayOfWeek = (dateInput: string | Date): string => {
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  let date: Date;
  if (typeof dateInput === 'string') {
    // Si es string, crear fecha sin problemas UTC
    const dateStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    const [year, month, day] = dateStr.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = dateInput;
  }
  
  return daysOfWeek[date.getDay()];
};

// Components
import BottomNavigation from "@/components/layout/bottom-navigation";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import CompradorViajesImageModal from "@/components/modals/comprador-viajes-image-modal";
import { CompradorTransaccionesImageModal } from "@/components/modals/comprador-transacciones-image-modal";
import { previewCompradorTripHistory, exportCompradorTripHistory } from '@/lib/excel-export-compradores';
import { previewCompradorTransactionHistory, exportCompradorTransactionHistory } from '@/lib/excel-export-comprador-transacciones';
import ExcelPreviewModal from '@/components/modals/excel-preview-modal';

// Recharts components
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart as RechartsLineChart,
  Line
} from "recharts";

export default function CompradorDetail() {
  const [, params] = useRoute("/compradores/:id");
  const [, setLocation] = useLocation();
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransaccionWithSocio | null>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [showDeleteTransaction, setShowDeleteTransaction] = useState(false);
  
  // Estados para filtros de viajes
  const [dateFilter, setDateFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Estados para filtros de transacciones
  const [transaccionesFechaFilterType, setTransaccionesFechaFilterType] = useState("todos");
  const [transaccionesFechaFilterValue, setTransaccionesFechaFilterValue] = useState("");
  const [transaccionesFechaFilterValueEnd, setTransaccionesFechaFilterValueEnd] = useState("");
  const [showTransaccionesImagePreview, setShowTransaccionesImagePreview] = useState(false);
  
  // Estados para modal de Excel
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);
  
  // Estado para transacciones filtradas (para el modal de imagen)
  const [transaccionesFiltradas, setTransaccionesFiltradas] = useState<any[]>([]);
  
  // Estado para transacciones temporales
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<any[]>([]);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  
  const compradorId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Función para formatear valores sin redondear
  const formatCurrencyNoRounding = (value: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value).replace('COP', '$');
  };

  // useEffect para limpiar transacciones ocultas al salir de la página
  useEffect(() => {
    return () => {
      // Cleanup function - se ejecuta cuando se desmonta el componente
      if (compradorId) {
        console.log('🔄 LIMPIEZA: Mostrando transacciones ocultas al salir de la página del comprador', compradorId);
        
        // Llamar a la API para mostrar todas las transacciones ocultas
        fetch(apiUrl(`/api/transacciones/socio/comprador/${compradorId}/show-all`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(error => {
          console.error('Error al limpiar transacciones ocultas:', error);
        });
        
        // También mostrar viajes ocultos 
        fetch(apiUrl(`/api/viajes/comprador/${compradorId}/show-all`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(error => {
          console.error('Error al limpiar viajes ocultos:', error);
        });
        
        // Limpiar transacciones temporales
        setTransaccionesTemporales([]);
        console.log('🧹 Transacciones temporales eliminadas al salir del comprador');
      }
    };
  }, [compradorId]);

  // Función auxiliar para crear fechas locales (evita problemas de zona horaria UTC)
  const createLocalDate = (dateString: string, isEndOfDay?: boolean): Date => {
    const timeString = isEndOfDay ? 'T23:59:59' : 'T00:00:00';
    return new Date(dateString + timeString);
  };

  // Fetch comprador data
  const { data: comprador, isLoading: isLoadingComprador, error: compradorError } = useQuery<Comprador>({
    queryKey: ["/api/compradores", compradorId],
    queryFn: () => fetch(apiUrl(`/api/compradores/${compradorId}`)).then(res => res.json()),
    enabled: !!compradorId,
  });

  // Fetch viajes del comprador
  const { data: viajes = [] } = useQuery<ViajeWithDetails[]>({
    queryKey: ["/api/viajes/comprador", compradorId],
    queryFn: () => fetch(apiUrl(`/api/viajes/comprador/${compradorId}`)).then(res => res.json()),
    enabled: !!compradorId,
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar - solo cuando hay cambios
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Viajes completados (con fechaDescargue) excluyendo ocultos
  const viajesCompletados = useMemo(() => 
    viajes.filter(viaje => viaje.fechaDescargue && viaje.estado === "completado" && !viaje.oculta),
    [viajes]
  );

  // Fetch transacciones usando el endpoint específico para compradores
  const { data: transacciones = [] } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones/comprador", compradorId],
    queryFn: () => fetch(apiUrl(`/api/transacciones/comprador/${compradorId}`)).then(res => res.json()),
    enabled: !!compradorId,
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar - solo cuando hay cambios
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Fetch todas las transacciones incluyendo ocultas (para el contador del botón y balance del encabezado)
  const { data: todasTransaccionesIncOcultas = [] } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"],
    queryFn: () => fetch(apiUrl(`/api/transacciones/comprador/${compradorId}?includeHidden=true`)).then(res => res.json()),
    enabled: !!compradorId,
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar - solo cuando hay cambios
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Fetch todos los viajes incluyendo ocultos (solo para el balance del encabezado)
  const { data: todosViajesIncOcultos = [] } = useQuery<ViajeWithDetails[]>({
    queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"],
    queryFn: () => fetch(apiUrl(`/api/viajes/comprador/${compradorId}?includeHidden=true`)).then(res => res.json()),
    enabled: !!compradorId,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Combinar transacciones reales con transacciones dinámicas de viajes
  const transaccionesConViajes = useMemo(() => {
    const viajesCompletados = viajes?.filter(v => v.fechaDescargue && v.compradorId === parseInt(compradorId) && !v.oculta) || [];
    
    const transaccionesDinamicas = viajesCompletados.map(viaje => {
      // Usar directamente el valorConsignar ya calculado en la base de datos
      const valorConsignar = parseFloat(viaje.valorConsignar || "0");
      
      // Debug temporal para viaje G24
      if (viaje.id === "G24") {
        console.log("🔍 DEBUG G24 FRONTEND:", {
          id: viaje.id,
          valorConsignar: viaje.valorConsignar,
          valorConsignarParsed: valorConsignar,
          valorFinal: (-Math.abs(valorConsignar)).toString(),
          totalVenta: viaje.totalVenta,
          totalFlete: viaje.totalFlete,
          quienPagaFlete: viaje.quienPagaFlete
        });
      }

      return {
        id: `viaje-${viaje.id}`,
        concepto: `Viaje ${viaje.id}`,
        valor: (-Math.abs(valorConsignar)).toString(),
        fecha: viaje.fechaDescargue!,
        isFromTrip: true,
        createdAt: viaje.fechaDescargue!,
        deQuienTipo: "comprador",
        deQuienId: compradorId,
        paraQuienTipo: "rodmar",
        paraQuienId: "1",
        formaPago: "Transferencia",
        voucher: null,
        comentario: null,
        tipoSocio: "comprador",
        socioId: parseInt(compradorId),
        tipo: "Viaje"
      } as TransaccionWithSocio & { isFromTrip: boolean };
    });

    const transaccionesReales = transacciones.map(t => ({
      ...t,
      isFromTrip: false,
      tipo: "Manual"
    }));

    // Agregar transacciones temporales
    const transaccionesTemporalesFormateadas = transaccionesTemporales.map(t => ({
      ...t,
      isFromTrip: false,
      tipo: "Manual",
      isTemporal: true
    }));

    return [...transaccionesReales, ...transaccionesDinamicas, ...transaccionesTemporalesFormateadas];
  }, [transacciones, viajes, compradorId, transaccionesTemporales]);



  // Calcular balance neto total del comprador (INCLUYE todas las transacciones y viajes, incluso ocultos)
  // Este balance NO debe cambiar al ocultar/mostrar transacciones
  const balanceNetoReal = useMemo(() => {
    // Usar TODOS los viajes completados (incluyendo ocultos) para el balance real
    const viajesCompletados = todosViajesIncOcultos?.filter(v => v.fechaDescargue && v.compradorId === parseInt(compradorId)) || [];
    
    // Para transacciones manuales, separar ingresos y egresos
    // Usar TODAS las transacciones (incluyendo ocultas) para el balance real
    let totalManualesPositivos = 0;
    let totalManualesNegativos = 0;

    todasTransaccionesIncOcultas.forEach(transaccion => {
      const valor = parseFloat(transaccion.valor);
      
      if (transaccion.paraQuienTipo === 'comprador' && transaccion.paraQuienId === compradorId.toString()) {
        // Transacciones hacia el comprador son egresos (negativos)
        totalManualesNegativos += Math.abs(valor);
      } else if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
        // Transacciones desde el comprador son ingresos (positivos)
        totalManualesPositivos += Math.abs(valor);
      }
    });
    
    // Calcular egresos de viajes (valor a consignar) - usar directamente valorConsignar de BD
    const totalViajes = viajesCompletados.reduce((sum, viaje) => {
      const valorConsignar = parseFloat(viaje.valorConsignar || "0");
      return sum + (-valorConsignar); // Negativo porque es egreso para comprador
    }, 0);
    
    const totalPositivos = totalManualesPositivos;
    const totalNegativos = Math.abs(totalViajes) + totalManualesNegativos;
    const balanceTotal = totalPositivos - totalNegativos;

    return balanceTotal;
  }, [todosViajesIncOcultos, todasTransaccionesIncOcultas, compradorId]);

  // Función para obtener rangos de fecha
  const getDateRange = (filterType: string, startDate?: string, endDate?: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
      case "exactamente":
        if (startDate) {
          return { 
            start: createLocalDate(startDate), 
            end: createLocalDate(startDate, true) 
          };
        }
        break;
      case "entre":
        if (startDate && endDate) {
          return { 
            start: createLocalDate(startDate), 
            end: createLocalDate(endDate, true) 
          };
        }
        break;
      case "despues-de":
        if (startDate) {
          return { 
            start: createLocalDate(startDate), 
            end: new Date(2099, 11, 31) 
          };
        }
        break;
      case "antes-de":
        if (startDate) {
          return { 
            start: new Date(1900, 0, 1), 
            end: createLocalDate(startDate, true) 
          };
        }
        break;
      case "hoy":
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return { 
          start: createLocalDate(todayStr), 
          end: createLocalDate(todayStr, true) 
        };
      case "ayer":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        return { 
          start: createLocalDate(yesterdayStr), 
          end: createLocalDate(yesterdayStr, true) 
        };
      case "esta-semana":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const startWeekStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
        const todayStr2 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return { 
          start: createLocalDate(startWeekStr), 
          end: createLocalDate(todayStr2, true) 
        };
      case "semana-pasada":
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return { 
          start: createLocalDate(`${startOfLastWeek.getFullYear()}-${String(startOfLastWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfLastWeek.getDate()).padStart(2, '0')}`), 
          end: createLocalDate(`${endOfLastWeek.getFullYear()}-${String(endOfLastWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfLastWeek.getDate()).padStart(2, '0')}`, true) 
        };
      case "este-mes":
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startMonthStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
        const todayStr3 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return { 
          start: createLocalDate(startMonthStr), 
          end: createLocalDate(todayStr3, true) 
        };
      case "mes-pasado":
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return { 
          start: createLocalDate(`${startOfLastMonth.getFullYear()}-${String(startOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfLastMonth.getDate()).padStart(2, '0')}`), 
          end: createLocalDate(`${endOfLastMonth.getFullYear()}-${String(endOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfLastMonth.getDate()).padStart(2, '0')}`, true) 
        };
      case "este-ano":
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const startYearStr = `${startOfYear.getFullYear()}-${String(startOfYear.getMonth() + 1).padStart(2, '0')}-${String(startOfYear.getDate()).padStart(2, '0')}`;
        const todayStr4 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return { 
          start: createLocalDate(startYearStr), 
          end: createLocalDate(todayStr4, true) 
        };
      case "ano-pasado":
        const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
        return { 
          start: createLocalDate(`${startOfLastYear.getFullYear()}-${String(startOfLastYear.getMonth() + 1).padStart(2, '0')}-${String(startOfLastYear.getDate()).padStart(2, '0')}`), 
          end: createLocalDate(`${endOfLastYear.getFullYear()}-${String(endOfLastYear.getMonth() + 1).padStart(2, '0')}-${String(endOfLastYear.getDate()).padStart(2, '0')}`, true) 
        };
      default:
        return null;
    }
    return null;
  };

  // Filtrar viajes según los criterios basándose en fechaDescargue
  const viajesFiltrados = useMemo(() => {
    if (!viajes) return [];
    
    if (dateFilter === "todos") {
      return viajes;
    }

    const dateRange = getDateRange(dateFilter, startDate, endDate);
    if (!dateRange) return viajes;

    return viajes.filter((viaje) => {
      const fechaDescargue = viaje.fechaDescargue;
      
      // Solo filtrar viajes completados (con fechaDescargue) y no ocultos
      if (!fechaDescargue || viaje.oculta) return false;
      
      // Extraer fecha como string para comparación consistente basándose en fechaDescargue
      const fechaDescargueStr = typeof fechaDescargue === 'string' && fechaDescargue.includes('T') 
        ? fechaDescargue.split('T')[0] 
        : fechaDescargue instanceof Date 
        ? `${fechaDescargue.getFullYear()}-${String(fechaDescargue.getMonth() + 1).padStart(2, '0')}-${String(fechaDescargue.getDate()).padStart(2, '0')}` 
        : fechaDescargue;

      const startStr = `${dateRange.start.getFullYear()}-${String(dateRange.start.getMonth() + 1).padStart(2, '0')}-${String(dateRange.start.getDate()).padStart(2, '0')}`;
      const endStr = `${dateRange.end.getFullYear()}-${String(dateRange.end.getMonth() + 1).padStart(2, '0')}-${String(dateRange.end.getDate()).padStart(2, '0')}`;
      
      return fechaDescargueStr >= startStr && fechaDescargueStr <= endStr;
    });
  }, [viajes, dateFilter, startDate, endDate]);

  // Función para obtener texto descriptivo del filtro
  const getFilterText = (filter: string) => {
    switch (filter) {
      case "exactamente": return "Exactamente";
      case "entre": return "Entre fechas";
      case "despues-de": return "Después de";
      case "antes-de": return "Antes de";
      case "hoy": return "Hoy";
      case "ayer": return "Ayer";
      case "esta-semana": return "Esta semana";
      case "semana-pasada": return "Semana pasada";
      case "este-mes": return "Este mes";
      case "mes-pasado": return "Mes pasado";
      case "este-ano": return "Este año";
      case "ano-pasado": return "Año pasado";
      default: return "Todos";
    }
  };

  // Función para limpiar filtros
  const handleClearFilter = () => {
    setDateFilter("todos");
    setStartDate("");
    setEndDate("");
  };

  // Mutaciones para ocultar transacciones usando endpoint específico de compradores
  const hideTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      const response = await fetch(apiUrl(`/api/transacciones/${transactionId}/hide-comprador`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error al ocultar transacción en módulo compradores');
      return response.json();
    },
    onSuccess: async () => {
      toast({
        description: "Transacción ocultada en módulo compradores",
        duration: 2000,
      });
      // Invalidar y forzar refetch inmediato de queries específicas (similar a volqueteros)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"] }),
      ]);
      // Forzar refetch inmediato para actualización visual instantánea
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/transacciones/comprador", compradorId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"], type: 'active' }),
      ]);
    },
    onError: () => {
      toast({
        description: "Error al ocultar transacción en módulo compradores",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  // Mutación para ocultar viajes
  const hideViajesMutation = useMutation({
    mutationFn: async (viajeId: string) => {
      const response = await fetch(apiUrl(`/api/viajes/${viajeId}/hide`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al ocultar viaje');
      return response.json();
    },
    onMutate: async (viajeId: string) => {
      // Actualización optimista: actualizar el cache inmediatamente
      await queryClient.cancelQueries({ queryKey: ["/api/viajes/comprador", compradorId] });
      await queryClient.cancelQueries({ queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"] });
      
      // Snapshot del valor anterior
      const previousViajes = queryClient.getQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId]);
      const previousViajesIncOcultos = queryClient.getQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId, "includeHidden"]);
      
      // Actualizar optimistamente
      if (previousViajes) {
        queryClient.setQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId], (old) => 
          (old || []).map(v => v.id === viajeId ? { ...v, oculta: true } : v)
        );
      }
      if (previousViajesIncOcultos) {
        queryClient.setQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId, "includeHidden"], (old) => 
          (old || []).map(v => v.id === viajeId ? { ...v, oculta: true } : v)
        );
      }
      
      return { previousViajes, previousViajesIncOcultos };
    },
    onSuccess: async () => {
      toast({
        description: "Viaje ocultado",
        duration: 2000,
      });
      // Invalidar queries para sincronizar con el backend
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/comprador", compradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"] });
    },
    onError: (error, viajeId, context) => {
      // Revertir actualización optimista en caso de error
      if (context?.previousViajes) {
        queryClient.setQueryData(["/api/viajes/comprador", compradorId], context.previousViajes);
      }
      if (context?.previousViajesIncOcultos) {
        queryClient.setQueryData(["/api/viajes/comprador", compradorId, "includeHidden"], context.previousViajesIncOcultos);
      }
      toast({
        description: "Error al ocultar viaje",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  // Mutación para mostrar todas las transacciones y viajes ocultos
  const showAllHiddenMutation = useMutation({
    mutationFn: async () => {
      const { apiUrl } = await import('@/lib/api');
      // Mostrar transacciones ocultas
      const transaccionesResponse = await fetch(apiUrl(`/api/transacciones/socio/comprador/${compradorId}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Mostrar viajes ocultos
      const viajesResponse = await fetch(apiUrl(`/api/viajes/comprador/${compradorId}/show-all`), {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!transaccionesResponse.ok || !viajesResponse.ok) {
        throw new Error('Error al mostrar elementos ocultos');
      }
    },
    onMutate: async () => {
      // Actualización optimista: mostrar todos los viajes ocultos inmediatamente
      await queryClient.cancelQueries({ queryKey: ["/api/viajes/comprador", compradorId] });
      await queryClient.cancelQueries({ queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"] });
      
      // Snapshot del valor anterior
      const previousViajes = queryClient.getQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId]);
      const previousViajesIncOcultos = queryClient.getQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId, "includeHidden"]);
      
      // Actualizar optimistamente: marcar todos los viajes ocultos como visibles
      if (previousViajes) {
        queryClient.setQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId], (old) => 
          (old || []).map(v => ({ ...v, oculta: false }))
        );
      }
      if (previousViajesIncOcultos) {
        queryClient.setQueryData<ViajeWithDetails[]>(["/api/viajes/comprador", compradorId, "includeHidden"], (old) => 
          (old || []).map(v => ({ ...v, oculta: false }))
        );
      }
      
      return { previousViajes, previousViajesIncOcultos };
    },
    onSuccess: () => {
      toast({
        description: "Todos los elementos ocultos ahora son visibles",
        duration: 2000,
      });
      // Invalidar queries para sincronizar con el backend
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId, "includeHidden"] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/comprador", compradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/viajes/comprador", compradorId, "includeHidden"] });
    },
    onError: (error, variables, context) => {
      // Revertir actualización optimista en caso de error
      if (context?.previousViajes) {
        queryClient.setQueryData(["/api/viajes/comprador", compradorId], context.previousViajes);
      }
      if (context?.previousViajesIncOcultos) {
        queryClient.setQueryData(["/api/viajes/comprador", compradorId, "includeHidden"], context.previousViajesIncOcultos);
      }
      toast({
        description: "Error al mostrar elementos ocultos",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  if (isLoadingComprador || !comprador) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="p-2 sm:p-4">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="p-2 sm:p-4">
        {/* Header */}
        <div className="flex items-center mb-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/compradores")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Compradores
          </Button>
        </div>

        {/* Comprador Info Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">{comprador.nombre}</CardTitle>
                  <p className="text-sm text-muted-foreground">ID: {comprador.id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className={`text-2xl font-bold ${
                  balanceNetoReal >= 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {formatCurrency(balanceNetoReal)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="viajes" className="w-full">
              <TabsList className="rodmar-tabs grid w-full grid-cols-3 gap-1 p-1">
                <TabsTrigger 
                  value="viajes" 
                  className="flex items-center text-sm px-3 py-2"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Viajes
                </TabsTrigger>
                <TabsTrigger 
                  value="transacciones"
                  className="flex items-center text-sm px-3 py-2"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Transacciones
                </TabsTrigger>
                <TabsTrigger 
                  value="balance"
                  className="flex items-center text-sm px-3 py-2"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Balance
                </TabsTrigger>
              </TabsList>

              <TabsContent value="viajes" className="mt-6">
                <CompradorViajesTab 
                  viajes={viajesFiltrados}
                  viajesOriginal={viajes || []}
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  getFilterText={getFilterText}
                  handleClearFilter={handleClearFilter}
                  setShowImagePreview={setShowImagePreview}
                  setExcelPreviewData={setExcelPreviewData}
                  setShowExcelPreview={setShowExcelPreview}
                  comprador={comprador}
                />
              </TabsContent>

              <TabsContent value="transacciones" className="mt-6">
                <CompradorTransaccionesTab 
                  transacciones={transacciones}
                  viajesCompletados={viajesCompletados}
                  compradorId={comprador.id}
                  comprador={comprador}
                  isLoadingComprador={isLoadingComprador}
                  transaccionesFechaFilterType={transaccionesFechaFilterType}
                  setTransaccionesFechaFilterType={setTransaccionesFechaFilterType}
                  transaccionesFechaFilterValue={transaccionesFechaFilterValue}
                  setTransaccionesFechaFilterValue={setTransaccionesFechaFilterValue}
                  transaccionesFechaFilterValueEnd={transaccionesFechaFilterValueEnd}
                  setTransaccionesFechaFilterValueEnd={setTransaccionesFechaFilterValueEnd}
                  setShowTransaccionesImagePreview={setShowTransaccionesImagePreview}
                  setExcelPreviewData={setExcelPreviewData}
                  setShowExcelPreview={setShowExcelPreview}
                  todasTransaccionesIncOcultas={todasTransaccionesIncOcultas}
                  hideTransactionMutation={hideTransactionMutation}
                  hideViajesMutation={hideViajesMutation}
                  showAllHiddenMutation={showAllHiddenMutation}
                  viajes={viajes}
                  todosViajesIncOcultos={todosViajesIncOcultos}
                  setTransaccionesFiltradas={setTransaccionesFiltradas}
                  setSelectedTransaction={setSelectedTransaction}
                  setShowTransactionDetail={setShowTransactionDetail}
                  transaccionesTemporales={transaccionesTemporales}
                  setTransaccionesTemporales={setTransaccionesTemporales}
                  setShowTemporalTransaction={setShowTemporalTransaction}
                  setShowEditTransaction={setShowEditTransaction}
                  setShowDeleteTransaction={setShowDeleteTransaction}
                />
              </TabsContent>

              <TabsContent value="balance" className="mt-6">
                <CompradorBalanceTab 
                  comprador={comprador} 
                  transacciones={transaccionesFiltradas} 
                  viajes={viajes}
                  filterType={transaccionesFechaFilterType}
                  filterValue={transaccionesFechaFilterValue}
                  filterValueEnd={transaccionesFechaFilterValueEnd}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <NewTransactionModal 
        open={showNewTransaction} 
        onClose={() => setShowNewTransaction(false)}
      />

      {/* Modal para transacciones temporales */}
      <NewTransactionModal 
        open={showTemporalTransaction} 
        onClose={() => setShowTemporalTransaction(false)}
        isTemporalMode={true}
        compradorId={comprador?.id}
        onTemporalSubmit={(nuevaTransaccion) => {
          console.log('🧪 Nueva transacción temporal creada:', nuevaTransaccion);
          setTransaccionesTemporales(prev => [...prev, nuevaTransaccion]);
          setShowTemporalTransaction(false);
        }}
      />

      {/* Modal de imagen de viajes */}
      {comprador && (
        <CompradorViajesImageModal
          open={showImagePreview}
          onOpenChange={(open) => {
            console.log("🔄 MODAL STATE CHANGED:", open);
            console.log("Comprador:", comprador);
            console.log("Viajes count:", viajes?.length || 0);
            setShowImagePreview(open);
          }}
          comprador={comprador}
          viajes={viajesFiltrados || []}
          filterType={dateFilter}
          filterValue={startDate}
          filterValueEnd={endDate}
        />
      )}

      {/* Modal de imagen de transacciones */}
      {comprador && (
        <CompradorTransaccionesImageModal
          open={showTransaccionesImagePreview}
          onOpenChange={setShowTransaccionesImagePreview}
          transacciones={transaccionesFiltradas || []}
          comprador={comprador}
          filterLabel={(() => {
            switch (transaccionesFechaFilterType) {
              case "exactamente": return `Exactamente ${transaccionesFechaFilterValue}`;
              case "entre": return `Entre ${transaccionesFechaFilterValue} y ${transaccionesFechaFilterValueEnd}`;
              case "despues-de": return `Después de ${transaccionesFechaFilterValue}`;
              case "antes-de": return `Antes de ${transaccionesFechaFilterValue}`;
              case "hoy": return "Hoy";
              case "ayer": return "Ayer";
              case "esta-semana": return "Esta semana";
              case "semana-pasada": return "Semana pasada";
              case "este-mes": return "Este mes";
              case "mes-pasado": return "Mes pasado";
              case "este-año": return "Este año";
              case "año-pasado": return "Año pasado";
              default: return "Todos los períodos";
            }
          })()}
        />
      )}

      {/* Modales de transacciones */}
      <EditTransactionModal
        isOpen={showEditTransaction}
        onClose={() => {
          setShowEditTransaction(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />

      <DeleteTransactionModal
        isOpen={showDeleteTransaction}
        onClose={() => {
          setShowDeleteTransaction(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />

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

      {/* Botón flotante para nueva transacción */}
      <Button
        size="icon"
        className="fixed bottom-24 right-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg z-40"
        onClick={() => setShowNewTransaction(true)}
        aria-label="Crear transacción"
      >
        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>

      {/* Navegación inferior */}
      <BottomNavigation />

      {/* Modal de vista previa Excel */}
      <ExcelPreviewModal
        open={showExcelPreview}
        onOpenChange={setShowExcelPreview}
        data={excelPreviewData}
        fileName={`RodMar_${comprador?.nombre || 'Comprador'}_Transacciones_${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}.xlsx`}
        totalTripsCount={transaccionesFiltradas?.length || 0}
        exportType="transacciones"
        onDownload={() => {
          if (transaccionesFiltradas && comprador && !isLoadingComprador) {
            exportCompradorTransactionHistory(transaccionesFiltradas, comprador.nombre);
          }
        }}
      />
    </div>
  );
}

// Componente para la tab de viajes
function CompradorViajesTab({ 
  viajes,
  viajesOriginal,
  dateFilter,
  setDateFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  getFilterText,
  handleClearFilter,
  setShowImagePreview,
  setExcelPreviewData,
  setShowExcelPreview,
  comprador
}: { 
  viajes: ViajeWithDetails[];
  viajesOriginal: ViajeWithDetails[];
  dateFilter: string;
  setDateFilter: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  getFilterText: (filter: string) => string;
  handleClearFilter: () => void;
  setShowImagePreview: (value: boolean) => void;
  setExcelPreviewData: (data: any[]) => void;
  setShowExcelPreview: (value: boolean) => void;
  comprador: Comprador | undefined;
}) {
  return (
    <div className="space-y-4">
      {/* Filtro de fechas */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <SelectValue placeholder="Filtrar por fecha de descargue" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los períodos</SelectItem>
              <SelectItem value="exactamente">Exactamente</SelectItem>
              <SelectItem value="entre">Entre fechas</SelectItem>
              <SelectItem value="despues-de">Después de</SelectItem>
              <SelectItem value="antes-de">Antes de</SelectItem>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="ayer">Ayer</SelectItem>
              <SelectItem value="esta-semana">Esta semana</SelectItem>
              <SelectItem value="semana-pasada">Semana pasada</SelectItem>
              <SelectItem value="este-mes">Este mes</SelectItem>
              <SelectItem value="mes-pasado">Mes pasado</SelectItem>
              <SelectItem value="este-ano">Este año</SelectItem>
              <SelectItem value="ano-pasado">Año pasado</SelectItem>
            </SelectContent>
          </Select>

          {/* Campos de fecha dinámicos */}
          {(dateFilter === "exactamente" || dateFilter === "despues-de" || dateFilter === "antes-de") && (
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs"
              placeholder="Seleccionar fecha"
            />
          )}

          {dateFilter === "entre" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
                placeholder="Fecha inicio"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
                placeholder="Fecha fin"
              />
            </div>
          )}
        </div>

        {/* Badge de filtro activo y botón de descarga */}
        <div className="flex items-center justify-between">
          {dateFilter !== "todos" && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs h-6">
                Filtro: {getFilterText(dateFilter)}
              </Badge>
              {viajes && viajes.length > 0 && (
                <Badge variant="outline" className="text-xs h-6">
                  {viajes.length} viajes
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilter}
                className="h-6 px-2 text-xs"
              >
                <X className="h-3 w-3" />
                Limpiar
              </Button>
            </div>
          )}
          
          {/* Botones de descarga */}
          {viajes && viajes.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-600"
                onClick={() => {
                  const previewData = previewCompradorTripHistory(viajes);
                  setExcelPreviewData(previewData);
                  setShowExcelPreview(true);
                }}
              >
                <Download className="h-3 w-3 mr-1" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log("🖼️ BOTÓN IMAGEN CLICKEADO - Abriendo modal de imagen de viajes");
                  console.log("Viajes disponibles:", viajes?.length || 0);
                  setShowImagePreview(true);
                }}
                className="h-6 px-2 text-xs gap-1 hover:bg-accent hover:text-accent-foreground"
                title={`Descargar imagen de ${Math.min(viajes.length, 20)} viajes`}
              >
                <Download className="h-3 w-3" />
                Imagen
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de viajes filtrados */}
      {!viajes || viajes.length === 0 ? (
        <div className="text-center py-8">
          <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">
            {dateFilter === "todos" 
              ? "No hay viajes registrados para este comprador"
              : "No hay viajes que coincidan con el filtro seleccionado"
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {viajes.map((viaje) => (
            <Card key={viaje.id} className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
              <CardContent className="p-4">
                <div className="grid gap-3">
                  {/* Fila 1: ID, fechas */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">ID</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{viaje.id}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">F. CARGUE</span>
                      <span className="text-xs">{viaje.fechaCargue ? (() => {
                        const fecha = viaje.fechaCargue;
                        if (typeof fecha === 'string') {
                          const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                          const [year, month, day] = dateStr.split('-');
                          return `${day}/${month}/${year?.slice(-2) || ''}`;
                        }
                        return "-";
                      })() : "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">F. DESCARGUE</span>
                      <span className="text-xs">{viaje.fechaDescargue ? (() => {
                        const fecha = viaje.fechaDescargue;
                        if (typeof fecha === 'string') {
                          const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                          const [year, month, day] = dateStr.split('-');
                          return `${day}/${month}/${year?.slice(-2) || ''}`;
                        }
                        return "-";
                      })() : "-"}</span>
                    </div>
                  </div>

                  {/* Fila 2: Conductor, tipo carro, placa */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">CONDUCTOR</span>
                      <span className="truncate">{viaje.conductor || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">TIPO CARRO</span>
                      <span className="truncate">{viaje.tipoCarro || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">PLACA</span>
                      <span className="truncate">{viaje.placa || "-"}</span>
                    </div>
                  </div>

                  {/* Fila 3: Peso, precios unitarios */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">PESO</span>
                      <span className="font-medium">{viaje.peso ? `${viaje.peso} Ton` : "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">VUT</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">
                        {viaje.vut ? formatCurrency(parseFloat(viaje.vut)) : "-"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">FUT</span>
                      <span className="text-orange-600 dark:text-orange-400 font-bold">
                        {viaje.fleteTon ? formatCurrency(parseFloat(viaje.fleteTon)) : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Fila 4: Gastos y totales */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">OGF</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold">
                        {viaje.otrosGastosFlete ? formatCurrency(parseFloat(viaje.otrosGastosFlete)) : "-"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">TOTAL VENTA</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        {viaje.totalVenta ? formatCurrency(parseFloat(viaje.totalVenta)) : "-"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs font-medium">TOTAL FLETE</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">
                        {viaje.totalFlete ? formatCurrency(parseFloat(viaje.totalFlete)) : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Fila 4: Valor a consignar */}
                  {viaje.valorConsignar && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-center">
                        <div className="text-center">
                          <span className="text-muted-foreground text-xs">VALOR A CONSIGNAR:</span>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(parseFloat(viaje.valorConsignar))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente para la tab de transacciones
function CompradorTransaccionesTab({ 
  transacciones, 
  viajesCompletados, 
  compradorId,
  comprador,
  isLoadingComprador,
  transaccionesFechaFilterType,
  setTransaccionesFechaFilterType,
  transaccionesFechaFilterValue,
  setTransaccionesFechaFilterValue,
  transaccionesFechaFilterValueEnd,
  setTransaccionesFechaFilterValueEnd,
  setShowTransaccionesImagePreview,
  setExcelPreviewData,
  setShowExcelPreview,
  todasTransaccionesIncOcultas,
  hideTransactionMutation,
  hideViajesMutation,
  showAllHiddenMutation,
  viajes,
  todosViajesIncOcultos,
  setTransaccionesFiltradas,
  setSelectedTransaction,
  setShowTransactionDetail,
  transaccionesTemporales,
  setTransaccionesTemporales,
  setShowTemporalTransaction,
  setShowEditTransaction,
  setShowDeleteTransaction
}: { 
  transacciones: TransaccionWithSocio[];
  viajesCompletados: ViajeWithDetails[];
  compradorId: number;
  comprador: Comprador | undefined;
  isLoadingComprador: boolean;
  transaccionesFechaFilterType: string;
  setTransaccionesFechaFilterType: (value: string) => void;
  transaccionesFechaFilterValue: string;
  setTransaccionesFechaFilterValue: (value: string) => void;
  transaccionesFechaFilterValueEnd: string;
  setTransaccionesFechaFilterValueEnd: (value: string) => void;
  setShowTransaccionesImagePreview: (value: boolean) => void;
  setExcelPreviewData: (data: any[]) => void;
  setShowExcelPreview: (show: boolean) => void;
  todasTransaccionesIncOcultas: TransaccionWithSocio[];
  hideTransactionMutation: any;
  hideViajesMutation: any;
  showAllHiddenMutation: any;
  viajes: ViajeWithDetails[];
  todosViajesIncOcultos: ViajeWithDetails[];
  setTransaccionesFiltradas: (transacciones: any[]) => void;
  setSelectedTransaction: (transaction: any) => void;
  setShowTransactionDetail: (show: boolean) => void;
  transaccionesTemporales: any[];
  setTransaccionesTemporales: (transacciones: any[]) => void;
  setShowTemporalTransaction: (show: boolean) => void;
  setShowEditTransaction: (show: boolean) => void;
  setShowDeleteTransaction: (show: boolean) => void;
}) {
  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState("");

  // Combinar transacciones reales con transacciones dinámicas de viajes
  const todasTransacciones = useMemo(() => {
    const transaccionesDinamicas = viajesCompletados
      .filter(viaje => viaje.fechaDescargue && viaje.compradorId === compradorId)
      .map(viaje => {
        // Usar directamente el valorConsignar ya calculado en la base de datos
        const valorConsignar = parseFloat(viaje.valorConsignar || "0");

        return {
          id: `viaje-${viaje.id}`,
          concepto: `Viaje ${viaje.id}`,
          valor: (-valorConsignar).toString(), // Negativo para el comprador
          fecha: viaje.fechaDescargue!,
          tipo: "Viaje" as const,
          esViajeCompleto: true
        };
      });

    // Transacciones manuales donde el comprador es origen o destino
    const transaccionesManuales = transacciones
      .filter(t => 
        (t.deQuienTipo === "comprador" && t.deQuienId === compradorId.toString()) ||
        (t.paraQuienTipo === "comprador" && t.paraQuienId === compradorId.toString())
      )
      .map(t => ({
        id: `manual-${t.id}`,
        concepto: t.concepto,
        valor: t.valor,
        fecha: t.fecha,
        tipo: "Manual" as const,
        esViajeCompleto: false,
        paraQuienTipo: t.paraQuienTipo,
        paraQuienId: t.paraQuienId,
        voucher: t.voucher, // ¡Incluir el campo voucher!
        comentario: t.comentario
      }));

    // Agregar transacciones temporales
    const transaccionesTemporalesFormateadas = transaccionesTemporales.map(t => ({
      ...t,
      id: `temporal-${t.id}`,
      tipo: "Manual" as const,
      esViajeCompleto: false,
      isTemporal: true
    }));

    return [...transaccionesDinamicas, ...transaccionesManuales, ...transaccionesTemporalesFormateadas]
      .sort((a, b) => {
        // Usar comparación de strings de fechas para evitar problemas de zona horaria
        const fechaAStr = typeof a.fecha === 'string' && a.fecha.includes('T') 
          ? a.fecha.split('T')[0] 
          : a.fecha instanceof Date 
          ? a.fecha.toISOString().split('T')[0]
          : a.fecha;
          
        const fechaBStr = typeof b.fecha === 'string' && b.fecha.includes('T') 
          ? b.fecha.split('T')[0] 
          : b.fecha instanceof Date 
          ? b.fecha.toISOString().split('T')[0]
          : b.fecha;
        
        // Debug específico para problema de ordenamiento (temporal)
        if (a.id === 'manual-378' || b.id === 'manual-378') {
          console.log('🔍 DEBUG ORDENAMIENTO STRINGS TRANSACCION 378:', {
            aId: a.id,
            aFecha: a.fecha,
            aFechaStr: fechaAStr,
            bId: b.id,
            bFecha: b.fecha,
            bFechaStr: fechaBStr,
            comparison: fechaBStr.localeCompare(fechaAStr)
          });
        }
        
        // Ordenamiento descendente por fecha (más recientes primero)
        return fechaBStr.localeCompare(fechaAStr);
      });
  }, [transacciones, viajesCompletados, compradorId, transaccionesTemporales]);

  // Aplicar filtros de fecha y búsqueda usando comparación de strings
  const transaccionesFiltradas = useMemo(() => {
    let filtered = todasTransacciones;

    // Filtro de búsqueda (concepto, valor)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(transaccion => {
        const concepto = (transaccion.concepto || '').toLowerCase();
        const valor = transaccion.valor?.toString() || '';
        return concepto.includes(searchLower) || valor.includes(searchLower);
      });
    }

    // Filtro de fecha
    if (transaccionesFechaFilterType === "todos") {
      return filtered;
    }

    return filtered.filter(transaccion => {
      // Extraer fecha directamente del string para evitar conversiones UTC
      const fechaDirecta = typeof transaccion.fecha === 'string' && transaccion.fecha.includes('T') 
        ? transaccion.fecha.split('T')[0] 
        : transaccion.fecha;

      // Para filtros con valores específicos de fecha
      if (transaccionesFechaFilterType === "exactamente" && transaccionesFechaFilterValue) {
        return fechaDirecta === transaccionesFechaFilterValue;
      }

      if (transaccionesFechaFilterType === "entre" && transaccionesFechaFilterValue && transaccionesFechaFilterValueEnd) {
        return fechaDirecta >= transaccionesFechaFilterValue && 
               fechaDirecta <= transaccionesFechaFilterValueEnd;
      }

      if (transaccionesFechaFilterType === "despues-de" && transaccionesFechaFilterValue) {
        return fechaDirecta > transaccionesFechaFilterValue;
      }

      if (transaccionesFechaFilterType === "antes-de" && transaccionesFechaFilterValue) {
        return fechaDirecta < transaccionesFechaFilterValue;
      }

      // Para filtros preestablecidos - generar fechas como strings directamente  
      const now = new Date();
      const hoyString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      switch (transaccionesFechaFilterType) {
        case "hoy": {
          // DEBUG temporal
          if (transaccion.id === 399) {
            console.log('🔍 DEBUG FILTRO HOY:', {
              fechaTransaccion: transaccion.fecha,
              fechaDirecta,
              hoyString,
              coincide: fechaDirecta === hoyString
            });
          }
          return fechaDirecta === hoyString;
        }
        case "ayer": {
          const ayer = new Date(now);
          ayer.setDate(ayer.getDate() - 1);
          const ayerString = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
          // DEBUG temporal
          if (transaccion.id === 399) {
            console.log('🔍 DEBUG FILTRO AYER:', {
              fechaTransaccion: transaccion.fecha,
              fechaDirecta,
              ayerString,
              coincide: fechaDirecta === ayerString
            });
          }
          return fechaDirecta === ayerString;
        }

        case "esta-semana": {
          const inicioSemana = new Date(now);
          inicioSemana.setDate(now.getDate() - now.getDay());
          const inicioSemanaString = `${inicioSemana.getFullYear()}-${String(inicioSemana.getMonth() + 1).padStart(2, '0')}-${String(inicioSemana.getDate()).padStart(2, '0')}`;
          return fechaDirecta >= inicioSemanaString && fechaDirecta <= hoyString;
        }
        case "semana-pasada": {
          const inicioSemanaPasada = new Date(now);
          inicioSemanaPasada.setDate(now.getDate() - now.getDay() - 7);
          const finSemanaPasada = new Date(inicioSemanaPasada);
          finSemanaPasada.setDate(inicioSemanaPasada.getDate() + 6);
          const inicioSemanaPasadaString = `${inicioSemanaPasada.getFullYear()}-${String(inicioSemanaPasada.getMonth() + 1).padStart(2, '0')}-${String(inicioSemanaPasada.getDate()).padStart(2, '0')}`;
          const finSemanaPasadaString = `${finSemanaPasada.getFullYear()}-${String(finSemanaPasada.getMonth() + 1).padStart(2, '0')}-${String(finSemanaPasada.getDate()).padStart(2, '0')}`;
          return fechaDirecta >= inicioSemanaPasadaString && fechaDirecta <= finSemanaPasadaString;
        }
        case "este-mes": {
          const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
          const inicioMesString = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(inicioMes.getDate()).padStart(2, '0')}`;
          return fechaDirecta >= inicioMesString && fechaDirecta <= hoyString;
        }
        case "mes-pasado": {
          // Extraer fecha directamente del string para evitar conversiones UTC
          const fechaDirecta = typeof transaccion.fecha === 'string' && transaccion.fecha.includes('T') 
            ? transaccion.fecha.split('T')[0] 
            : transaccion.fecha;
            
          // Generar rango del mes pasado usando fechas locales
          const now = new Date();
          const añoActual = now.getFullYear();
          const mesActual = now.getMonth(); // 0-11
          
          // Mes pasado
          let añoMesPasado = añoActual;
          let mesPasado = mesActual - 1;
          
          if (mesPasado < 0) {
            mesPasado = 11;
            añoMesPasado = añoActual - 1;
          }
          
          const inicioMesPasado = `${añoMesPasado}-${String(mesPasado + 1).padStart(2, '0')}-01`;
          
          // Último día del mes pasado
          const ultimoDiaMesPasado = new Date(añoMesPasado, mesPasado + 1, 0).getDate();
          const finMesPasado = `${añoMesPasado}-${String(mesPasado + 1).padStart(2, '0')}-${String(ultimoDiaMesPasado).padStart(2, '0')}`;
          
          return fechaDirecta >= inicioMesPasado && fechaDirecta <= finMesPasado;
        }
        case "este-año": {
          const inicioAño = new Date(now.getFullYear(), 0, 1);
          const inicioAñoString = `${inicioAño.getFullYear()}-${String(inicioAño.getMonth() + 1).padStart(2, '0')}-${String(inicioAño.getDate()).padStart(2, '0')}`;
          return fechaDirecta >= inicioAñoString && fechaDirecta <= hoyString;
        }
        case "año-pasado": {
          const inicioAñoPasado = new Date(now.getFullYear() - 1, 0, 1);
          const finAñoPasado = new Date(now.getFullYear() - 1, 11, 31);
          const inicioAñoPasadoString = `${inicioAñoPasado.getFullYear()}-${String(inicioAñoPasado.getMonth() + 1).padStart(2, '0')}-${String(inicioAñoPasado.getDate()).padStart(2, '0')}`;
          const finAñoPasadoString = `${finAñoPasado.getFullYear()}-${String(finAñoPasado.getMonth() + 1).padStart(2, '0')}-${String(finAñoPasado.getDate()).padStart(2, '0')}`;
          return fechaDirecta >= inicioAñoPasadoString && fechaDirecta <= finAñoPasadoString;
        }
        default:
          return true;
      }
    });
  }, [todasTransacciones, searchTerm, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd]);

  // Actualizar las transacciones filtradas en el componente padre
  useEffect(() => {
    setTransaccionesFiltradas(transaccionesFiltradas);
  }, [transaccionesFiltradas, setTransaccionesFiltradas]);

  // Calcular totales de transacciones para el resumen DINÁMICO (usar transacciones filtradas)
  const totales = useMemo(() => {
    console.log('📊 RESUMEN DINÁMICO USANDO TRANSACCIONES FILTRADAS');
    console.log('📊 todasTransacciones.length:', todasTransacciones.length);
    console.log('📊 transaccionesFiltradas.length:', transaccionesFiltradas.length);
    
    // NUEVO: Usar transaccionesFiltradas para el resumen dinámico
    const manuales = transaccionesFiltradas.filter(t => t.tipo === "Manual");
    const viajes = transaccionesFiltradas.filter(t => t.tipo === "Viaje");
    
    console.log('📊 RESUMEN - manuales:', manuales.length, 'viajes:', viajes.length);
    
    // Para transacciones manuales, separar ingresos y egresos
    let totalManualesPositivos = 0;
    let totalManualesNegativos = 0;

    manuales.forEach(transaccion => {
      const transactionIdStr = transaccion.id.toString();
      const valor = parseFloat(transaccion.valor);
      
      // Manejar transacciones temporales
      if (transaccion.isTemporal) {
        // Para transacciones temporales, aplicar lógica visual adaptativa
        // Si origen es el comprador actual → negativo (egreso)
        if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
          totalManualesNegativos += Math.abs(valor);
        } else {
          totalManualesPositivos += Math.abs(valor);
        }
        return;
      }
      
      const realTransactionId = transactionIdStr.replace('manual-', '');
      const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
      
      // Debug logging para transacción 323 en resumen
      if (realTransaction?.id === 323) {
        console.log('📊 RESUMEN TRANSACCION 323 DEBUG:', {
          transaccionId: transaccion.id,
          realTransactionId,
          realTransaction: realTransaction,
          paraQuienTipo: realTransaction?.paraQuienTipo,
          paraQuienId: realTransaction?.paraQuienId,
          compradorId: compradorId.toString(),
          valor: valor,
          condicion1: realTransaction?.paraQuienTipo === 'comprador',
          condicion2: realTransaction?.paraQuienId === compradorId.toString(),
          esEgreso: realTransaction?.paraQuienTipo === 'comprador' && realTransaction?.paraQuienId === compradorId.toString()
        });
      }
      
      if (realTransaction?.paraQuienTipo === 'comprador' && realTransaction?.paraQuienId === compradorId.toString()) {
        // Transacciones hacia el comprador son egresos (negativos)
        totalManualesNegativos += Math.abs(valor);
        if (realTransaction?.id === 323) {
          console.log('📊 Transacción 323 en resumen agregada como egreso:', Math.abs(valor));
        }
      } else if (realTransaction?.deQuienTipo === 'comprador' && realTransaction?.deQuienId === compradorId.toString()) {
        // Transacciones desde el comprador son ingresos (positivos)
        totalManualesPositivos += Math.abs(valor);
        if (realTransaction?.id === 323) {
          console.log('📊 Transacción 323 en resumen agregada como ingreso:', Math.abs(valor));
        }
      }
    });
    
    const totalViajes = viajes.reduce((sum, t) => sum + parseFloat(t.valor), 0); // Ya son negativos
    const totalPositivos = totalManualesPositivos;
    const totalNegativos = Math.abs(totalViajes) + totalManualesNegativos;
    const totalGeneral = totalPositivos - totalNegativos;

    console.log('📊 RESUMEN TOTALES CALCULO:', {
      compradorId: compradorId.toString(),
      totalManualesPositivos,
      totalManualesNegativos,
      totalViajes: Math.abs(totalViajes),
      totalPositivos,
      totalNegativos,
      totalGeneral
    });

    return {
      manuales: manuales.length,
      viajes: viajes.length,
      totalPositivos,
      totalNegativos,
      totalGeneral
    };
  }, [transaccionesFiltradas, transacciones, compradorId]);

  if (todasTransacciones.length === 0) {
    return (
      <div className="text-center py-8">
        <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground">No hay transacciones registradas para este comprador</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Encabezado compacto */}
      <Card className="p-2">
        <div className="space-y-2">
          {/* Primera fila: Título, badges y botones de acción */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold">Transacciones</h3>
              <Badge variant="outline" className="text-xs h-5">{totales.manuales} abonos</Badge>
              <Badge variant="outline" className="text-xs h-5">{totales.viajes} viajes</Badge>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {/* Botón para mostrar elementos ocultos */}
              {(() => {
                const transaccionesOcultas = todasTransaccionesIncOcultas?.filter(t => 
                  t.ocultaEnComprador && 
                  ((t.deQuienTipo === "comprador" && t.deQuienId === compradorId.toString()) ||
                   (t.paraQuienTipo === "comprador" && t.paraQuienId === compradorId.toString()))
                ).length || 0;
                const viajesOcultos = todosViajesIncOcultos?.filter((v: ViajeWithDetails) => v.oculta && v.compradorId === compradorId).length || 0;
                const totalOcultos = transaccionesOcultas + viajesOcultos;
                
                return totalOcultos > 0 ? (
                  <Button
                    onClick={() => showAllHiddenMutation.mutate()}
                    variant="outline"
                    disabled={showAllHiddenMutation.isPending}
                    size="sm"
                    className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 h-7 px-2 text-xs"
                    title={`Mostrar ${totalOcultos} elementos ocultos`}
                  >
                    <EyeOff className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">{totalOcultos}</span>
                  </Button>
                ) : null;
              })()}
              
              <Button
                onClick={() => {
                  if (transaccionesFiltradas && comprador && !isLoadingComprador) {
                    const preview = previewCompradorTransactionHistory(
                      transaccionesFiltradas,
                      comprador.nombre
                    );
                    setExcelPreviewData(preview.preview);
                    setShowExcelPreview(true);
                  }
                }}
                variant="outline"
                disabled={!comprador || isLoadingComprador}
                size="sm"
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 h-7 px-2 text-xs"
                title={`Exportar a Excel (${transaccionesFiltradas.length} transacciones)`}
              >
                <Download className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button
                onClick={() => {
                  setShowTransaccionesImagePreview(true);
                }}
                variant="outline"
                size="sm"
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 h-7 px-2 text-xs"
                title={`Descargar imagen (máx. 50 de ${transaccionesFiltradas.length} transacciones)`}
              >
                <Eye className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Imagen</span>
              </Button>
            </div>
          </div>

          {/* Segunda fila: Búsqueda, botón Temporal y filtro de fecha */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Campo de búsqueda */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por concepto o valor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
            
            {/* Botón nueva temporal - en la misma fila que filtros */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowTemporalTransaction(true);
              }}
              className="h-7 px-2 text-xs bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
            >
              <Calculator className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Temporal</span>
              <span className="sm:hidden">Temp</span>
            </Button>

            {/* Filtro de fecha */}
            <Select value={transaccionesFechaFilterType} onValueChange={setTransaccionesFechaFilterType}>
              <SelectTrigger className="h-7 text-xs w-[140px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="exactamente">Exactamente</SelectItem>
                <SelectItem value="entre">Entre</SelectItem>
                <SelectItem value="despues-de">Después de</SelectItem>
                <SelectItem value="antes-de">Antes de</SelectItem>
                <SelectItem value="hoy">Hoy</SelectItem>
                <SelectItem value="ayer">Ayer</SelectItem>
                <SelectItem value="esta-semana">Esta semana</SelectItem>
                <SelectItem value="semana-pasada">Semana pasada</SelectItem>
                <SelectItem value="este-mes">Este mes</SelectItem>
                <SelectItem value="mes-pasado">Mes pasado</SelectItem>
                <SelectItem value="este-año">Este año</SelectItem>
                <SelectItem value="año-pasado">Año pasado</SelectItem>
              </SelectContent>
            </Select>

            {/* Botón limpiar filtros */}
            {(transaccionesFechaFilterType !== "todos" || searchTerm.trim()) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setTransaccionesFechaFilterType("todos");
                  setTransaccionesFechaFilterValue("");
                  setTransaccionesFechaFilterValueEnd("");
                  setSearchTerm("");
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {/* Tercera fila: Inputs de fecha (debajo cuando se necesita seleccionar fecha) */}
          {((transaccionesFechaFilterType === "exactamente" || 
              transaccionesFechaFilterType === "despues-de" || 
              transaccionesFechaFilterType === "antes-de") && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="h-7 text-xs w-full sm:w-[200px]"
                  value={transaccionesFechaFilterValue}
                  onChange={(e) => setTransaccionesFechaFilterValue(e.target.value)}
                />
              </div>
            )) || (transaccionesFechaFilterType === "entre" && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="Desde"
                  className="h-7 text-xs flex-1"
                  value={transaccionesFechaFilterValue}
                  onChange={(e) => setTransaccionesFechaFilterValue(e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="Hasta"
                  className="h-7 text-xs flex-1"
                  value={transaccionesFechaFilterValueEnd}
                  onChange={(e) => setTransaccionesFechaFilterValueEnd(e.target.value)}
                />
              </div>
            ))}

          {/* Cuarta fila: Tarjetas de balance compactas */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t">
            {/* Tarjeta Positivos */}
            <Card className="p-2 bg-green-50 border-green-200">
              <div className="flex flex-col">
                <span className="text-xs text-green-700 font-medium mb-1">Positivos</span>
                <span className="text-sm sm:text-base text-green-600 font-bold">
                  +{formatCurrency(totales.totalPositivos.toString())}
                </span>
              </div>
            </Card>

            {/* Tarjeta Negativos */}
            <Card className="p-2 bg-red-50 border-red-200">
              <div className="flex flex-col">
                <span className="text-xs text-red-700 font-medium mb-1">Negativos</span>
                <span className="text-sm sm:text-base text-red-600 font-bold">
                  -{formatCurrency(totales.totalNegativos.toString())}
                </span>
              </div>
            </Card>

            {/* Tarjeta Balance */}
            <Card className={`p-2 border-2 ${totales.totalGeneral >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <div className="flex flex-col">
                <span className={`text-xs font-medium mb-1 ${totales.totalGeneral >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Balance
                </span>
                <span className={`text-sm sm:text-base font-bold ${totales.totalGeneral >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totales.totalGeneral.toString())}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      {/* Vista de tabla para desktop */}
      <div className="bg-card rounded-lg border overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-sm">FECHA</th>
                <th className="text-left p-3 font-medium text-sm">CONCEPTO</th>
                <th className="text-right p-3 font-medium text-sm">VALOR</th>
                <th className="text-center p-3 font-medium text-sm w-16">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {transaccionesFiltradas.map((transaccion, index) => {
                const valor = parseFloat(transaccion.valor);
                const esPositivo = valor >= 0;
                
                // Debug específico para G24
                if (transaccion.concepto === "Viaje G24") {
                  console.log("🚨 TABLA G24:", {
                    concepto: transaccion.concepto,
                    valorString: transaccion.valor,
                    valorParsed: valor,
                    valorAbs: Math.abs(valor)
                  });
                }
              
                return (
                  <tr 
                    key={transaccion.id}
                    className={`border-t cursor-pointer hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    onClick={() => {
                      setSelectedTransaction(transaccion);
                      setShowTransactionDetail(true);
                    }}
                  >
                    <td className="p-3 text-sm">
                      {(() => {
                        // Formateo con día de la semana para transacciones de compradores
                        const fecha = transaccion.fecha;
                        if (typeof fecha === 'string') {
                          // Si es string, extraer solo fecha (YYYY-MM-DD)
                          const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                          const [year, month, day] = dateStr.split('-');
                          const dayOfWeek = getDayOfWeek(fecha);
                          return `${dayOfWeek}. ${day}/${month}/${year?.slice(-2) || ''}`;
                        } else if (fecha instanceof Date) {
                          // Si es Date, extraer componentes locales
                          const day = String(fecha.getDate()).padStart(2, '0');
                          const month = String(fecha.getMonth() + 1).padStart(2, '0');
                          const year = String(fecha.getFullYear()).slice(-2);
                          const dayOfWeek = getDayOfWeek(fecha);
                          return `${dayOfWeek}. ${day}/${month}/${year}`;
                        }
                        return 'Fecha inválida';
                      })()}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{transaccion.concepto}</span>
                        {transaccion.isTemporal ? (
                          <Badge 
                            variant="outline" 
                            className="text-xs px-1.5 py-0.5 bg-orange-50 border-orange-200 text-orange-700"
                          >
                            T
                          </Badge>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="text-xs px-1.5 py-0.5"
                          >
                            {transaccion.tipo}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-sm text-right font-medium ${
                      (() => {
                        // NUEVA REGLA ESPECÍFICA PARA COMPRADORES:
                        // 1. Transacciones automáticas de viajes = ROJO y NEGATIVO
                        // 2. Transacciones manuales desde comprador = VERDE y POSITIVO
                        
                        if (transaccion.tipo === "Viaje") {
                          // Transacciones automáticas de viajes aparecen en ROJO
                          return "text-red-600 dark:text-red-400";
                        }
                        
                        if (transaccion.tipo === "Manual") {
                          // Manejar transacciones temporales con lógica visual adaptativa
                          if (transaccion.isTemporal) {
                            // Si origen es el comprador actual → rojo/negativo
                            if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
                              return "text-red-600 dark:text-red-400";
                            } else {
                              return "text-green-600 dark:text-green-400";
                            }
                          }
                          
                          // Para transacciones manuales, verificar el origen
                          const transactionIdStr = transaccion.id.toString();
                          const realTransactionId = transactionIdStr.replace('manual-', '');
                          const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                          
                          // Si la transacción viene DESDE el comprador = VERDE y POSITIVO
                          if (realTransaction?.deQuienTipo === 'comprador' && realTransaction?.deQuienId === compradorId.toString()) {
                            return "text-green-600 dark:text-green-400";
                          }
                          

                          
                          // Para otras transacciones manuales, aplicar lógica estándar
                          if (realTransaction?.paraQuienTipo) {
                            const isToPartner = realTransaction.paraQuienTipo === 'mina' || 
                                              realTransaction.paraQuienTipo === 'comprador' || 
                                              realTransaction.paraQuienTipo === 'volquetero';
                            const isToRodMarOrBank = realTransaction.paraQuienTipo === 'rodmar' || 
                                                   realTransaction.paraQuienTipo === 'banco';
                            
                            if (isToPartner) {
                              return "text-red-600 dark:text-red-400"; // ROJO para destino socios
                            } else if (isToRodMarOrBank) {
                              return "text-green-600 dark:text-green-400"; // VERDE para destino RodMar/Banco
                            }
                          }
                        }
                        
                        // Fallback
                        return "text-gray-600 dark:text-gray-400";
                      })()
                    }`}>
                      {(() => {
                        // NUEVA LÓGICA PARA TRANSACCIONES MANUALES EN COMPRADORES
                        if (transaccion.tipo === "Manual") {
                          // Manejar transacciones temporales con lógica visual adaptativa
                          if (transaccion.isTemporal) {
                            // Si origen es el comprador actual → negativo
                            if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
                              return '-' + formatCurrency(Math.abs(valor));
                            } else {
                              return '+' + formatCurrency(Math.abs(valor));
                            }
                          }
                          
                          const transactionIdStr = transaccion.id.toString();
                          const realTransactionId = transactionIdStr.replace('manual-', '');
                          const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                          
                          // LÓGICA CORREGIDA ESPECÍFICA PARA COMPRADORES:
                          // 1. Transacciones HACIA este comprador = NEGATIVO (rojo)
                          if (realTransaction?.paraQuienTipo === 'comprador' && realTransaction?.paraQuienId === compradorId.toString()) {
                            return '-' + formatCurrency(Math.abs(valor));
                          }
                          
                          // 2. Transacciones DESDE este comprador = POSITIVO (verde)
                          if (realTransaction?.deQuienTipo === 'comprador' && realTransaction?.deQuienId === compradorId.toString()) {
                            return '+' + formatCurrency(Math.abs(valor));
                          }
                          
                          // 3. Otras transacciones (no involucran este comprador específico)
                          if (realTransaction?.paraQuienTipo) {
                            const isToRodMarOrBank = realTransaction.paraQuienTipo === 'rodmar' || 
                                                   realTransaction.paraQuienTipo === 'banco';
                            
                            if (isToRodMarOrBank) {
                              return '+' + formatCurrency(Math.abs(valor));
                            } else {
                              return '-' + formatCurrency(Math.abs(valor));
                            }
                          }
                        }
                        
                        // Para transacciones de viajes = NEGATIVAS en compradores
                        if (transaccion.tipo === "Viaje") {
                          return '-' + formatCurrency(Math.abs(valor));
                        }
                        
                        // Fallback
                        return formatCurrency(valor);
                      })()
                    }
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {transaccion.isTemporal ? (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log("🗑️ Eliminando transacción temporal:", transaccion.id);
                              // Eliminar de la lista de transacciones temporales
                              const nuevasTemporales = transaccionesTemporales.filter(t => t.id !== transaccion.id.replace('temporal-', ''));
                              setTransaccionesTemporales(nuevasTemporales);
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100"
                            title="Eliminar transacción temporal"
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        ) : transaccion.tipo === "Manual" ? (
                          <>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                const transactionIdStr = transaccion.id.toString();
                                const realTransactionId = transactionIdStr.replace('manual-', '');
                                const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                                if (realTransaction) {
                                  setSelectedTransaction(realTransaction);
                                  setShowEditTransaction(true);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-blue-100"
                              title="Editar transacción"
                            >
                              <Edit className="h-3 w-3 text-blue-600" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                const transactionIdStr = transaccion.id.toString();
                                const realTransactionId = transactionIdStr.replace('manual-', '');
                                const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                                if (realTransaction) {
                                  setSelectedTransaction(realTransaction);
                                  setShowDeleteTransaction(true);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-red-100"
                              title="Eliminar transacción"
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                const transactionIdStr = transaccion.id.toString();
                                const realTransactionId = parseInt(transactionIdStr.replace('manual-', ''));
                                hideTransactionMutation.mutate(realTransactionId);
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                              title="Ocultar transacción"
                            >
                              <EyeOff className="h-3 w-3 text-gray-500" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (transaccion.tipo === "Viaje") {
                                // Para viajes, extraer ID del viaje del concepto "Viaje G24" -> "G24"
                                const viajeId = transaccion.concepto.replace("Viaje ", "");
                                hideViajesMutation.mutate(viajeId);
                              }
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-100"
                            title="Ocultar elemento"
                          >
                            <EyeOff className="h-3 w-3 text-gray-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista de tarjetas para móviles */}
      <div className="space-y-1 md:hidden">
        {transaccionesFiltradas.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No hay transacciones para mostrar</p>
            {(transaccionesFechaFilterType !== "todos" || 
              transaccionesFechaFilterValue || 
              transaccionesFechaFilterValueEnd) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setTransaccionesFechaFilterType("todos");
                  setTransaccionesFechaFilterValue("");
                  setTransaccionesFechaFilterValueEnd("");
                }}
                className="mt-2"
              >
                Limpiar filtros
              </Button>
            )}
          </Card>
        ) : (
          transaccionesFiltradas.map((transaccion, index) => {
          const valor = parseFloat(transaccion.valor);
          const esPositivo = valor >= 0;
          
          return (
            <Card 
              key={transaccion.id}
              className="p-2 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => {
                setSelectedTransaction(transaccion);
                setShowTransactionDetail(true);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Información principal */}
                <div className="flex-1 min-w-0">
                  {/* Header con fecha y badges compacto */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const fecha = transaccion.fecha;
                        if (typeof fecha === 'string') {
                          const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                          const [year, month, day] = dateStr.split('-');
                          const dayOfWeek = getDayOfWeek(fecha);
                          return `${dayOfWeek}. ${day}/${month}/${year?.slice(-2) || ''}`;
                        } else if (fecha instanceof Date) {
                          const day = String(fecha.getDate()).padStart(2, '0');
                          const month = String(fecha.getMonth() + 1).padStart(2, '0');
                          const year = String(fecha.getFullYear()).slice(-2);
                          const dayOfWeek = getDayOfWeek(fecha);
                          return `${dayOfWeek}. ${day}/${month}/${year}`;
                        }
                        return 'Fecha inválida';
                      })()}
                    </span>
                    {transaccion.isTemporal ? (
                      <Badge 
                        variant="outline" 
                        className="text-xs px-1 py-0 h-4 bg-orange-50 border-orange-200 text-orange-700"
                      >
                        T
                      </Badge>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="text-xs px-1 py-0 h-4"
                      >
                        {transaccion.tipo === "Manual" ? "M" : "V"}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Concepto compacto */}
                  <p className="text-xs text-foreground leading-tight truncate">
                    {transaccion.concepto}
                  </p>
                  {/* Comentario compacto si existe */}
                  {transaccion.comentario && transaccion.comentario.trim() && (
                    <p className="text-xs text-gray-500 leading-tight truncate mt-0.5">
                      {transaccion.comentario.length > 40 ? 
                        `${transaccion.comentario.substring(0, 40)}...` : 
                        transaccion.comentario
                      }
                    </p>
                  )}
                </div>
                
                {/* Valor y acción compactos */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-xs font-semibold ${
                    (() => {
                      if (transaccion.tipo === "Viaje") {
                        return "text-red-600 dark:text-red-400";
                      }
                      
                      if (transaccion.tipo === "Manual") {
                        if (transaccion.isTemporal) {
                          if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
                            return "text-red-600 dark:text-red-400";
                          } else {
                            return "text-green-600 dark:text-green-400";
                          }
                        }
                        
                        const transactionIdStr = transaccion.id.toString();
                        const realTransactionId = transactionIdStr.replace('manual-', '');
                        const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                        
                        // LÓGICA CORREGIDA ESPECÍFICA PARA COMPRADORES:
                        // 1. Transacciones HACIA este comprador = ROJO y NEGATIVO
                        if (realTransaction?.paraQuienTipo === 'comprador' && realTransaction?.paraQuienId === compradorId.toString()) {
                          return "text-red-600 dark:text-red-400";
                        }
                        
                        // 2. Transacciones DESDE este comprador = VERDE y POSITIVO  
                        if (realTransaction?.deQuienTipo === 'comprador' && realTransaction?.deQuienId === compradorId.toString()) {
                          return "text-green-600 dark:text-green-400";
                        }
                        
                        // 3. Otras transacciones (no involucran este comprador específico)
                        if (realTransaction?.paraQuienTipo) {
                          const isToRodMarOrBank = realTransaction.paraQuienTipo === 'rodmar' || 
                                                 realTransaction.paraQuienTipo === 'banco';
                          
                          if (isToRodMarOrBank) {
                            return "text-green-600 dark:text-green-400";
                          } else {
                            return "text-red-600 dark:text-red-400";
                          }
                        }
                      }
                      
                      return "text-gray-600 dark:text-gray-400";
                    })()
                  }`}>
                    {(() => {
                      if (transaccion.tipo === "Manual") {
                        if (transaccion.isTemporal) {
                          if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === compradorId.toString()) {
                            return '-$' + Math.abs(valor).toLocaleString();
                          } else {
                            return '+$' + Math.abs(valor).toLocaleString();
                          }
                        }
                        
                        const transactionIdStr = transaccion.id.toString();
                        const realTransactionId = transactionIdStr.replace('manual-', '');
                        const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                        
                        // LÓGICA CORREGIDA ESPECÍFICA PARA COMPRADORES:
                        // 1. Transacciones HACIA este comprador = NEGATIVO (rojo)
                        if (realTransaction?.paraQuienTipo === 'comprador' && realTransaction?.paraQuienId === compradorId.toString()) {
                          return '-$' + Math.abs(valor).toLocaleString();
                        }
                        
                        // 2. Transacciones DESDE este comprador = POSITIVO (verde)
                        if (realTransaction?.deQuienTipo === 'comprador' && realTransaction?.deQuienId === compradorId.toString()) {
                          return '+$' + Math.abs(valor).toLocaleString();
                        }
                        
                        // 3. Otras transacciones (no involucran este comprador específico)
                        if (realTransaction?.paraQuienTipo) {
                          const isToRodMarOrBank = realTransaction.paraQuienTipo === 'rodmar' || 
                                                 realTransaction.paraQuienTipo === 'banco';
                          
                          if (isToRodMarOrBank) {
                            return '+$' + Math.abs(valor).toLocaleString();
                          } else {
                            return '-$' + Math.abs(valor).toLocaleString();
                          }
                        }
                      }
                      
                      if (transaccion.tipo === "Viaje") {
                        return '-$' + Math.abs(valor).toLocaleString();
                      }
                      
                      return '$' + valor.toLocaleString();
                    })()}
                  </span>
                  
                  {/* Botones de acción compactos */}
                  {transaccion.isTemporal ? (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        const nuevasTemporales = transaccionesTemporales.filter(t => t.id !== transaccion.id.replace('temporal-', ''));
                        setTransaccionesTemporales(nuevasTemporales);
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-red-100 shrink-0"
                      title="Eliminar transacción temporal"
                    >
                      <X className="h-2.5 w-2.5 text-red-500" />
                    </Button>
                  ) : transaccion.tipo === "Manual" ? (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          const transactionIdStr = transaccion.id.toString();
                          const realTransactionId = transactionIdStr.replace('manual-', '');
                          const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                          if (realTransaction) {
                            setSelectedTransaction(realTransaction);
                            setShowEditTransaction(true);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-blue-100 shrink-0"
                        title="Editar transacción"
                      >
                        <Edit className="h-3 w-3 text-blue-600" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          const transactionIdStr = transaccion.id.toString();
                          const realTransactionId = transactionIdStr.replace('manual-', '');
                          const realTransaction = transacciones.find(t => t.id.toString() === realTransactionId);
                          if (realTransaction) {
                            setSelectedTransaction(realTransaction);
                            setShowDeleteTransaction(true);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-red-100 shrink-0"
                        title="Eliminar transacción"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          const transactionIdStr = transaccion.id.toString();
                          const realTransactionId = transactionIdStr.replace('manual-', '');
                          hideTransactionMutation.mutate(parseInt(realTransactionId));
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-gray-100 shrink-0"
                        title="Ocultar transacción"
                      >
                        <EyeOff className="h-3 w-3 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (transaccion.tipo === "Viaje") {
                          const viajeId = transaccion.concepto.replace("Viaje ", "");
                          hideViajesMutation.mutate(viajeId);
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-gray-100 shrink-0"
                      title="Ocultar elemento"
                    >
                      <EyeOff className="h-3 w-3 text-gray-500" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
          })
        )}
      </div>
    </div>
  );
}

// Componente para la tab de balance
function CompradorBalanceTab({ comprador, transacciones, viajes, filterType, filterValue, filterValueEnd }: { 
  comprador: Comprador; 
  transacciones: TransaccionWithSocio[];
  viajes: ViajeWithDetails[];
  filterType: string;
  filterValue?: string;
  filterValueEnd?: string;
}) {
  // Filtrar viajes según el mismo filtro aplicado a transacciones
  const viajesFiltrados = useMemo(() => {
    if (filterType === "todos") {
      return viajes.filter(viaje => 
        viaje.compradorId && parseInt(viaje.compradorId.toString()) === comprador.id && 
        viaje.fechaDescargue
      );
    }

    return viajes.filter(viaje => {
      // Filtrar por comprador y fecha de descargue válida
      if (!viaje.compradorId || parseInt(viaje.compradorId.toString()) !== comprador.id || !viaje.fechaDescargue) {
        return false;
      }

      const fechaViaje = new Date(viaje.fechaDescargue);
      const today = new Date();
      
      switch (filterType) {
        case "exactamente":
          if (filterValue) {
            const targetDate = new Date(filterValue);
            return fechaViaje.toDateString() === targetDate.toDateString();
          }
          break;
        case "entre":
          if (filterValue && filterValueEnd) {
            const startDate = new Date(filterValue);
            const endDate = new Date(filterValueEnd);
            return fechaViaje >= startDate && fechaViaje <= endDate;
          }
          break;
        case "despues-de":
          if (filterValue) {
            const startDate = new Date(filterValue);
            return fechaViaje >= startDate;
          }
          break;
        case "antes-de":
          if (filterValue) {
            const endDate = new Date(filterValue);
            return fechaViaje <= endDate;
          }
          break;
        case "hoy":
          return fechaViaje.toDateString() === today.toDateString();
        case "ayer":
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return fechaViaje.toDateString() === yesterday.toDateString();
        case "esta-semana":
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return fechaViaje >= startOfWeek && fechaViaje <= endOfWeek;
        case "semana-pasada":
          const lastWeekStart = new Date(today);
          lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
          const lastWeekEnd = new Date(lastWeekStart);
          lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
          return fechaViaje >= lastWeekStart && fechaViaje <= lastWeekEnd;
        case "este-mes":
          return fechaViaje.getMonth() === today.getMonth() && 
                 fechaViaje.getFullYear() === today.getFullYear();
        case "mes-pasado":
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);
          return fechaViaje.getMonth() === lastMonth.getMonth() && 
                 fechaViaje.getFullYear() === lastMonth.getFullYear();
        case "este-ano":
          return fechaViaje.getFullYear() === today.getFullYear();
        case "ano-pasado":
          return fechaViaje.getFullYear() === today.getFullYear() - 1;
      }
      return true;
    });
  }, [viajes, comprador.id, filterType, filterValue, filterValueEnd]);

  // Calculamos el balance usando la misma lógica que funciona
  const balanceCalculado = useMemo(() => {
    console.log('🎯 BALANCE TAB - Calculando balance dinámico para comprador:', comprador.id);
    console.log('🎯 BALANCE TAB - Filtro aplicado:', filterType, filterValue, filterValueEnd);
    console.log('🎯 BALANCE TAB - Viajes filtrados:', viajesFiltrados.length);
    console.log('🎯 BALANCE TAB - Transacciones filtradas:', transacciones.length);

    // Calcular total de viajes (valor a consignar) con viajes filtrados
    const totalViajes = viajesFiltrados.reduce((sum, viaje) => {
      const valor = parseFloat(viaje.valorConsignar || '0');
      return sum + Math.abs(valor);
    }, 0);

    // Procesar transacciones manuales usando la misma lógica
    let totalManualesPositivos = 0;
    let totalManualesNegativos = 0;

    transacciones.forEach(transaccion => {
      const valor = parseFloat(transaccion.valor);
      
      if (transaccion.paraQuienTipo === 'comprador' && transaccion.paraQuienId === comprador.id.toString()) {
        // Transacciones hacia el comprador son egresos
        totalManualesNegativos += Math.abs(valor);
      } else if (transaccion.deQuienTipo === 'comprador' && transaccion.deQuienId === comprador.id.toString()) {
        // Transacciones desde el comprador son ingresos
        totalManualesPositivos += Math.abs(valor);
      }
    });

    const ingresos = totalManualesPositivos;
    const egresos = totalViajes + totalManualesNegativos;
    const balanceTotal = ingresos - egresos;

    console.log('🎯 BALANCE TAB - Resultado:', {
      totalManualesPositivos,
      totalManualesNegativos, 
      totalViajes,
      ingresos,
      egresos,
      balanceTotal
    });

    return { ingresos, egresos, balanceTotal };
  }, [comprador.id, transacciones, viajesFiltrados]);

  return (
    <div className="space-y-6">
      {/* Resumen de Balance - Optimizado para móviles */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Resumen Financiero
          </h3>
          {filterType !== "todos" && (
            <Badge variant="secondary" className="text-xs">
              Filtro: {(() => {
                switch (filterType) {
                  case "exactamente": return `Exactamente ${filterValue}`;
                  case "entre": return `Entre ${filterValue} y ${filterValueEnd}`;
                  case "despues-de": return `Después de ${filterValue}`;
                  case "antes-de": return `Antes de ${filterValue}`;
                  case "hoy": return "Hoy";
                  case "ayer": return "Ayer";
                  case "esta-semana": return "Esta semana";
                  case "semana-pasada": return "Semana pasada";
                  case "este-mes": return "Este mes";
                  case "mes-pasado": return "Mes pasado";
                  case "este-ano": return "Este año";
                  case "ano-pasado": return "Año pasado";
                  default: return "Filtro activo";
                }
              })()}
            </Badge>
          )}
        </div>
        
        {/* Layout responsivo: vertical en móvil, horizontal en desktop */}
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex justify-between sm:block sm:text-center p-3 sm:p-0 bg-green-50 dark:bg-green-950/20 sm:bg-transparent rounded-lg sm:rounded-none">
            <div className="sm:hidden text-sm font-medium text-gray-700 dark:text-gray-300">Positivos:</div>
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(balanceCalculado.ingresos)}
            </div>
            <div className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 mt-1">Positivos</div>
          </div>
          
          <div className="flex justify-between sm:block sm:text-center p-3 sm:p-0 bg-red-50 dark:bg-red-950/20 sm:bg-transparent rounded-lg sm:rounded-none">
            <div className="sm:hidden text-sm font-medium text-gray-700 dark:text-gray-300">Negativos:</div>
            <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(balanceCalculado.egresos)}
            </div>
            <div className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 mt-1">Negativos</div>
          </div>
          
          <div className="flex justify-between sm:block sm:text-center p-3 sm:p-0 bg-gray-50 dark:bg-gray-800 sm:bg-transparent rounded-lg sm:rounded-none border-2 border-gray-200 dark:border-gray-600 sm:border-0">
            <div className="sm:hidden text-sm font-medium text-gray-700 dark:text-gray-300">Balance:</div>
            <div className={`text-xl sm:text-2xl font-bold ${
              balanceCalculado.balanceTotal >= 0 
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(balanceCalculado.balanceTotal)}
            </div>
            <div className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 mt-1">Balance</div>
          </div>
        </div>
      </div>
    </div>
  );
}
