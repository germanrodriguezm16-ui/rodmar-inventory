import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, Users, Receipt, DollarSign, Truck, Calendar, X, Download, Eye,
  TrendingUp, TrendingDown, PieChart, BarChart3, LineChart, Calculator,
  Plus, Edit, Trash2, Search, Filter, SortAsc, SortDesc, CalendarDays,
  ArrowUp, ArrowDown
} from "lucide-react";
import { useLocation } from "wouter";
import type { Mina, TransaccionWithSocio, ViajeWithDetails } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Components
import BottomNavigation from "@/components/layout/bottom-navigation";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { PendingDetailModal } from "@/components/pending-transactions/pending-detail-modal";
import { CompleteTransactionModal } from "@/components/modals/complete-transaction-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import { TransaccionesImageModal } from "@/components/modals/transacciones-image-modal";
import ViajesImageModal from "@/components/modals/viajes-image-modal";
import ExcelPreviewModal from '@/components/modals/excel-preview-modal';

// Filtro de fechas (tipos válidos)
type DateFilterType = "todos" | "exactamente" | "entre" | "despues-de" | "antes-de" | "hoy" | "ayer" | "esta-semana" | "semana-pasada" | "este-mes" | "mes-pasado" | "este-año" | "año-pasado";

export default function MinaDetail() {
  const [, params] = useRoute("/minas/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const minaId = parseInt(params?.id || "0");
  
  // Estado para transacciones temporales (solo en memoria)
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<TransaccionWithSocio[]>([]);

  // Estado para rastrear pestaña activa y ejecutar limpieza al cambiar
  const [activeTab, setActiveTab] = useState<string>("viajes");

  // Función para ejecutar limpieza de transacciones ocultas
  const ejecutarLimpiezaTransaccionesOcultas = useCallback(async () => {
    if (minaId) {
      console.log('🔄 LIMPIEZA: Mostrando transacciones ocultas de la mina', minaId);
      const { apiUrl } = await import('@/lib/api');
      
      // Llamar a la API para mostrar todas las transacciones ocultas de la mina
      fetch(apiUrl(`/api/transacciones/socio/mina/${minaId}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(error => {
        console.error('Error al limpiar transacciones ocultas de mina:', error);
      });
      
      // También mostrar viajes ocultos de la mina
      fetch(apiUrl(`/api/viajes/mina/${minaId}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(error => {
        console.error('Error al limpiar viajes ocultos de mina:', error);
      });
    }
  }, [minaId]);

  // useEffect para limpiar transacciones ocultas al cambiar de pestaña
  useEffect(() => {
    // Solo ejecutar limpieza si no estamos en la pestaña de transacciones
    if (activeTab !== "transacciones") {
      console.log('🔄 LIMPIEZA: Cambiando de pestaña, mostrando transacciones ocultas', activeTab);
      ejecutarLimpiezaTransaccionesOcultas();
    }
  }, [activeTab, ejecutarLimpiezaTransaccionesOcultas]);

  // useEffect para limpiar transacciones ocultas y temporales al salir de la página
  useEffect(() => {
    return () => {
      // Cleanup function - se ejecuta cuando se desmonta el componente
      if (minaId) {
        console.log('🔄 LIMPIEZA: Saliendo de la página de la mina, mostrando transacciones ocultas', minaId);
        
        // Limpiar transacciones temporales
        setTransaccionesTemporales([]);
        
        // Ejecutar limpieza
        ejecutarLimpiezaTransaccionesOcultas();
      }
    };
  }, [minaId, ejecutarLimpiezaTransaccionesOcultas]);

  // Mutación para ocultar transacciones individuales
  const hideTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      const response = await fetch(apiUrl(`/api/transacciones/${transactionId}/hide`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al ocultar transacción');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}/all`] });
      toast({
        title: "Transacción ocultada",
        description: "La transacción se ha ocultada correctamente"
      });
    },
    onError: (error) => {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo ocultar la transacción",
        variant: "destructive"
      });
    }
  });

  // Mutación para ocultar viajes individuales
  const hideViajeMutation = useMutation({
    mutationFn: async (viajeId: string) => {
      const response = await fetch(apiUrl(`/api/viajes/${viajeId}/hide`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al ocultar viaje');
      return await response.json();
    },
    onSuccess: () => {
      // Invalidar solo las queries específicas del socio (similar a volqueteros)
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}/viajes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}/viajes`, "includeHidden"] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}/all`] });
      
      toast({
        title: "Viaje ocultado",
        description: "El viaje se ha ocultado de las transacciones"
      });
    },
    onError: (error) => {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo ocultar el viaje",
        variant: "destructive"
      });
    }
  });

  // Mutación para eliminar transacciones pendientes
  const deletePendingTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(apiUrl(`/api/transacciones/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitud eliminada",
        description: "La transacción pendiente se ha eliminado exitosamente.",
      });
      
      // Invalidar y refetch queries de pendientes (crítico para notificaciones push)
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      
      // Invalidar queries de la mina
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}/all`] });
      // React Query refetchea automáticamente si la query está activa
      
      // Invalidar módulo general de transacciones
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      // React Query refetchea automáticamente si la query está activa
      
      setShowDeletePendingConfirm(false);
      setSelectedTransaction(null);
    },
    onError: (error: any) => {
      console.error("Error deleting solicitud:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la solicitud. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutación para mostrar todas las transacciones ocultas (manuales y viajes)
  const showAllHiddenMutation = useMutation({
    mutationFn: async () => {
      const { apiUrl } = await import('@/lib/api');
      
      if (!minaId) {
        throw new Error('Mina no encontrada');
      }
      
      // Mostrar transacciones ocultas específicas de esta mina (similar a volqueteros)
      const transaccionesResponse = await fetch(apiUrl(`/api/transacciones/socio/mina/${minaId}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Mostrar viajes ocultos específicos de esta mina
      const viajesResponse = await fetch(apiUrl(`/api/viajes/mina/${minaId}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!transaccionesResponse.ok && !viajesResponse.ok) {
        throw new Error('Error al mostrar transacciones y viajes');
      }
      
      const transaccionesResult = transaccionesResponse.ok ? await transaccionesResponse.json() : { updatedCount: 0 };
      const viajesResult = viajesResponse.ok ? await viajesResponse.json() : { updatedCount: 0 };
      
      return {
        transacciones: transaccionesResult.updatedCount || 0,
        viajes: viajesResult.updatedCount || 0,
        total: (transaccionesResult.updatedCount || 0) + (viajesResult.updatedCount || 0)
      };
    },
    onSuccess: (result) => {
      // Invalidar solo las queries específicas del socio (similar a volqueteros)
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}/all`] });
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}/viajes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}/viajes`, "includeHidden"] });
      
      const mensaje = result.total > 0 
        ? `${result.transacciones} transacciones y ${result.viajes} viajes restaurados`
        : "No había elementos ocultos para restaurar";
        
      toast({
        title: "Elementos restaurados",
        description: mensaje
      });
    },
    onError: (error) => {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron restaurar los elementos ocultos",
        variant: "destructive"
      });
    }
  });
  
  // Estados locales
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [showDeleteTransaction, setShowDeleteTransaction] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransaccionWithSocio | null>(null);
  const [showEditPendingTransaction, setShowEditPendingTransaction] = useState(false);
  const [showPendingDetailModal, setShowPendingDetailModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDeletePendingConfirm, setShowDeletePendingConfirm] = useState(false);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("todos");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');

  // Estados de filtros de fecha para viajes
  const [viajesFechaFilterType, setViajesFechaFilterType] = useState<DateFilterType>("todos");
  const [viajesFechaFilterValue, setViajesFechaFilterValue] = useState("");
  const [viajesFechaFilterValueEnd, setViajesFechaFilterValueEnd] = useState("");
  
  // Estados de filtros de fecha para transacciones
  const [transaccionesFechaFilterType, setTransaccionesFechaFilterType] = useState<DateFilterType>("todos");
  const [transaccionesFechaFilterValue, setTransaccionesFechaFilterValue] = useState("");
  const [transaccionesFechaFilterValueEnd, setTransaccionesFechaFilterValueEnd] = useState("");
  
  // Estado para modales de imagen
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showTransaccionesImagePreview, setShowTransaccionesImagePreview] = useState(false);
  
  // Estado para modal de vista previa Excel de viajes
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);

  // Estados de ordenamiento
  const [sortByFecha, setSortByFecha] = useState<"ninguno" | "asc" | "desc">("desc");
  const [sortByValor, setSortByValor] = useState<"ninguno" | "asc" | "desc">("ninguno");

  // Función auxiliar para crear fechas locales (evita problemas de zona horaria UTC)
  const createLocalDate = (dateString: string, isEndOfDay?: boolean): Date => {
    const timeString = isEndOfDay ? 'T23:59:59' : 'T00:00:00';
    return new Date(dateString + timeString);
  };

  // Obtener datos de la mina
  const { data: mina, isLoading: minaLoading } = useQuery<Mina>({
    queryKey: [`/api/minas/${minaId}`],
    enabled: !!minaId,
  });

  // Obtener viajes de la mina (solo visibles, para la pestaña de viajes)
  const { data: viajes = [], isLoading: viajesLoading } = useQuery<ViajeWithDetails[]>({
    queryKey: [`/api/minas/${minaId}/viajes`],
    enabled: !!minaId,
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar - solo cuando hay cambios
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Obtener TODOS los viajes de la mina (incluyendo ocultos) solo para el balance del encabezado
  const { data: todosViajesIncOcultos = [] } = useQuery<ViajeWithDetails[]>({
    queryKey: [`/api/minas/${minaId}/viajes`, "includeHidden"],
    queryFn: () => fetch(apiUrl(`/api/minas/${minaId}/viajes?includeHidden=true`)).then(res => res.json()),
    enabled: !!minaId,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Obtener transacciones de la mina (solo visibles)
  const { data: transacciones = [], isLoading: transaccionesLoading } = useQuery<TransaccionWithSocio[]>({
    queryKey: [`/api/transacciones/socio/mina/${minaId}`],
    queryFn: async () => {
      const { apiUrl } = await import('@/lib/api');
      const res = await fetch(apiUrl(`/api/transacciones/socio/mina/${minaId}`));
      if (!res.ok) {
        console.error(`Error fetching transacciones for mina ${minaId}:`, res.status, res.statusText);
        return []; // Devolver array vacío en caso de error
      }
      const data = await res.json();
      // Asegurar que siempre sea un array
      return Array.isArray(data) ? data : [];
    },
    enabled: !!minaId,
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar - solo cuando hay cambios
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Obtener TODAS las transacciones de la mina (incluyendo ocultas) para contar ocultas
  const { data: todasTransaccionesIncOcultas = [] } = useQuery<TransaccionWithSocio[]>({
    queryKey: [`/api/transacciones/socio/mina/${minaId}/all`],
    enabled: !!minaId,
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar - solo cuando hay cambios
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
    queryFn: async () => {
      const { apiUrl } = await import('@/lib/api');
      const response = await fetch(apiUrl(`/api/transacciones/socio/mina/${minaId}?includeHidden=true`));
      if (!response.ok) {
        console.error(`Error fetching todas transacciones for mina ${minaId}:`, response.status, response.statusText);
        return []; // Devolver array vacío en caso de error
      }
      const data = await response.json();
      // Asegurar que siempre sea un array
      return Array.isArray(data) ? data : [];
    }
  });

  // Combinar transacciones manuales con viajes completados y transacciones temporales
  const todasTransacciones = useMemo(() => {
    // Transacciones dinámicas de viajes completados (excluir viajes ocultos)
    const viajesCompletados = viajes
      .filter(viaje => viaje.fechaDescargue && viaje.estado === "completado" && !viaje.oculta)
      .map(viaje => {
        const totalCompra = parseFloat(viaje.totalCompra || "0");
        
        return {
          id: `viaje-${viaje.id}`,
          concepto: `Viaje ${viaje.id}`,
          valor: totalCompra.toString(),
          fecha: viaje.fechaDescargue!,
          deQuienTipo: "viaje",
          deQuienId: viaje.id,
          paraQuienTipo: "mina",
          paraQuienId: minaId.toString(),
          formaPago: "Viaje",
          voucher: null,
          comentario: null,
          tipo: "Viaje" as const,
          esViajeCompleto: true,
          horaInterna: viaje.fechaDescargue!,
          oculta: false,
          userId: "main_user",
          createdAt: viaje.fechaDescargue!,
          socioNombre: mina?.nombre || "",
          tipoSocio: "mina" as const,
          socioId: minaId,
          viajeId: viaje.id // Agregar ID del viaje para poder ocultarlo
        } as TransaccionWithSocio & { viajeId?: string };
      });

    // Transacciones manuales
    const transaccionesManuales = transacciones.map(t => ({
      ...t,
      tipo: "Manual" as const,
      esViajeCompleto: false
    }));

    // Transacciones temporales con tipo marcado
    const transaccionesTemporalesConTipo = transaccionesTemporales.map(t => ({
      ...t,
      tipo: "Temporal" as const,
      esViajeCompleto: false
    }));

    return [...viajesCompletados, ...transaccionesManuales, ...transaccionesTemporalesConTipo]
      .sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        return fechaB.getTime() - fechaA.getTime();
      });
  }, [viajes, transacciones, transaccionesTemporales, minaId, mina?.nombre]);

  // Función para obtener el rango de fechas según el filtro
  const getDateRange = useCallback((filterType: DateFilterType, filterValue: string, filterValueEnd: string) => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');

    switch (filterType) {
      case "exactamente":
        return filterValue ? { start: filterValue, end: filterValue } : null;
      
      case "entre":
        return (filterValue && filterValueEnd) ? { start: filterValue, end: filterValueEnd } : null;
      
      case "despues-de":
        return filterValue ? { start: filterValue, end: null } : null;
      
      case "antes-de":
        return filterValue ? { start: null, end: filterValue } : null;
      
      case "hoy":
        return { start: todayStr, end: todayStr };
      
      case "ayer": {
        const ayer = new Date(today);
        ayer.setDate(today.getDate() - 1);
        const ayerStr = ayer.getFullYear() + '-' + 
          String(ayer.getMonth() + 1).padStart(2, '0') + '-' + 
          String(ayer.getDate()).padStart(2, '0');
        return { start: ayerStr, end: ayerStr };
      }
      
      case "esta-semana": {
        const inicioSemana = new Date(today);
        inicioSemana.setDate(today.getDate() - today.getDay());
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        
        const inicioStr = inicioSemana.getFullYear() + '-' + 
          String(inicioSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioSemana.getDate()).padStart(2, '0');
        const finStr = finSemana.getFullYear() + '-' + 
          String(finSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finSemana.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "semana-pasada": {
        const inicioSemana = new Date(today);
        inicioSemana.setDate(today.getDate() - today.getDay() - 7);
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        
        const inicioStr = inicioSemana.getFullYear() + '-' + 
          String(inicioSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioSemana.getDate()).padStart(2, '0');
        const finStr = finSemana.getFullYear() + '-' + 
          String(finSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finSemana.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "este-mes": {
        const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1);
        const finMes = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const inicioStr = inicioMes.getFullYear() + '-' + 
          String(inicioMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioMes.getDate()).padStart(2, '0');
        const finStr = finMes.getFullYear() + '-' + 
          String(finMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finMes.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "mes-pasado": {
        const inicioMes = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const finMes = new Date(today.getFullYear(), today.getMonth(), 0);
        
        const inicioStr = inicioMes.getFullYear() + '-' + 
          String(inicioMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioMes.getDate()).padStart(2, '0');
        const finStr = finMes.getFullYear() + '-' + 
          String(finMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finMes.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "este-año": {
        const inicioAño = new Date(today.getFullYear(), 0, 1);
        const finAño = new Date(today.getFullYear(), 11, 31);
        
        const inicioStr = inicioAño.getFullYear() + '-' + 
          String(inicioAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioAño.getDate()).padStart(2, '0');
        const finStr = finAño.getFullYear() + '-' + 
          String(finAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finAño.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "año-pasado": {
        const inicioAño = new Date(today.getFullYear() - 1, 0, 1);
        const finAño = new Date(today.getFullYear() - 1, 11, 31);
        
        const inicioStr = inicioAño.getFullYear() + '-' + 
          String(inicioAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioAño.getDate()).padStart(2, '0');
        const finStr = finAño.getFullYear() + '-' + 
          String(finAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finAño.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      default:
        return null;
    }
  }, []);

  // Función para filtrar transacciones por fecha
  const filterTransaccionesByDate = useCallback((transacciones: TransaccionWithSocio[], filterType: DateFilterType, filterValue: string, filterValueEnd: string) => {
    if (filterType === "todos") return transacciones;
    
    const range = getDateRange(filterType, filterValue, filterValueEnd);
    if (!range) return transacciones;

    return transacciones.filter(transaction => {
      if (!transaction.fecha) return false;
      
      // Adaptarse al formato de fecha existente - puede ser string o Date
      let transactionDate: string;
      if (typeof transaction.fecha === 'string') {
        // Si es string, extraer solo la parte de fecha (YYYY-MM-DD)
        transactionDate = transaction.fecha.includes('T') 
          ? transaction.fecha.split('T')[0] 
          : transaction.fecha;
      } else {
        // Si es Date object, convertir a string
        transactionDate = transaction.fecha.toISOString().split('T')[0];
      }
      
      if (range.start && range.end) {
        return transactionDate >= range.start && transactionDate <= range.end;
      } else if (range.start) {
        return transactionDate >= range.start;
      } else if (range.end) {
        return transactionDate <= range.end;
      }
      
      return true;
    });
  }, [getDateRange]);

  // Función para filtrar viajes por fecha
  const filterViajesByDate = useCallback((viajes: ViajeWithDetails[], filterType: DateFilterType, filterValue: string, filterValueEnd: string) => {
    if (filterType === "todos") return viajes;
    
    const range = getDateRange(filterType, filterValue, filterValueEnd);
    if (!range) return viajes;

    return viajes.filter(viaje => {
      const getFechaString = (fecha: any) => {
        if (!fecha) return null;
        if (typeof fecha === 'string') {
          return fecha.split('T')[0];
        }
        if (fecha instanceof Date) {
          return fecha.toISOString().split('T')[0];
        }
        return null;
      };

      const viajeDate = getFechaString(viaje.fechaCargue);
      
      if (!viajeDate) return false;
      
      if (range.start && range.end) {
        return viajeDate >= range.start && viajeDate <= range.end;
      } else if (range.start) {
        return viajeDate >= range.start;
      } else if (range.end) {
        return viajeDate <= range.end;
      }
      
      return true;
    });
  }, [getDateRange]);

  // Aplicar filtros a transacciones
  const transaccionesFiltradas = useMemo(() => {
    let filtered = filterType === "todos" ? 
      todasTransacciones.filter(t => !t.oculta) : 
      todasTransacciones.filter(t => t.oculta);

    // Aplicar filtro de fecha
    filtered = filterTransaccionesByDate(filtered, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd);

    // Aplicar filtro de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.concepto?.toLowerCase().includes(term) ||
        t.valor?.toString().includes(term) ||
        t.formaPago?.toLowerCase().includes(term) ||
        t.comentario?.toLowerCase().includes(term)
      );
    }

    // Aplicar filtro de balance usando la misma lógica que las tarjetas
    if (balanceFilter === 'positivos') {
      filtered = filtered.filter(t => {
        // Verde/Positivo para minas - misma lógica que las tarjetas
        if (t.deQuienTipo === 'viaje') {
          return true; // Viajes siempre positivos (verdes)
        } else if (t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString()) {
          return true; // Desde esta mina = ingreso positivo (verde)
        } else if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
          return true; // Hacia RodMar/Banco = positivo (verde)
        }
        return false;
      });
    } else if (balanceFilter === 'negativos') {
      filtered = filtered.filter(t => {
        // Rojo/Negativo para minas - misma lógica que las tarjetas
        return t.deQuienTipo !== 'viaje' && 
               t.paraQuienTipo === 'mina' && 
               t.paraQuienId === minaId.toString() &&
               !(t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString());
      });
    }
    // Si balanceFilter === 'all', no filtrar por balance

    // Aplicar ordenamiento
    if (sortByFecha !== "ninguno") {
      filtered.sort((a, b) => {
        const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return sortByFecha === "asc" ? fechaA - fechaB : fechaB - fechaA;
      });
    } else if (sortByValor !== "ninguno") {
      filtered.sort((a, b) => {
        const valorA = Math.abs(parseFloat(a.valor || '0'));
        const valorB = Math.abs(parseFloat(b.valor || '0'));
        return sortByValor === "asc" ? valorA - valorB : valorB - valorA;
      });
    }

    return filtered;
  }, [todasTransacciones, filterType, searchTerm, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd, sortByFecha, sortByValor, filterTransaccionesByDate, balanceFilter]);

  // Aplicar filtros a viajes
  const viajesFiltrados = useMemo(() => {
    let filtered = filterViajesByDate(viajes, viajesFechaFilterType, viajesFechaFilterValue, viajesFechaFilterValueEnd);
    
    // Ordenar por fecha de cargue (más recientes primero)
    filtered.sort((a, b) => {
      const fechaA = a.fechaCargue ? new Date(a.fechaCargue).getTime() : 0;
      const fechaB = b.fechaCargue ? new Date(b.fechaCargue).getTime() : 0;
      return fechaB - fechaA; // Descendente (más recientes primero)
    });
    
    return filtered;
  }, [viajes, viajesFechaFilterType, viajesFechaFilterValue, viajesFechaFilterValueEnd, filterViajesByDate]);

  // Calcular balance de la mina (ESTÁTICO - usa todas las transacciones, no filtradas)
  // Balance de la mina (INCLUYE todas las transacciones y viajes, incluso ocultos)
  // Este balance NO debe cambiar al ocultar/mostrar transacciones
  const balanceMina = useMemo(() => {
    // Ingresos por viajes completados (lo que RodMar paga a la mina)
    // Usar TODOS los viajes (incluyendo ocultos) para el balance real
    const ingresosViajes = (todosViajesIncOcultos || [])
      .filter(v => v.fechaDescargue && v.estado === "completado")
      .reduce((sum, v) => sum + parseFloat(v.totalCompra || '0'), 0);

    // Transacciones netas (solo transacciones manuales, excluyendo viajes y pendientes)
    // Usar TODAS las transacciones (incluyendo ocultas) para el balance real
    // EXCLUIR transacciones pendientes (no afectan balances)
    const transaccionesNetas = (todasTransaccionesIncOcultas || [])
      .filter(t => t.tipo !== "Viaje" && t.estado !== 'pendiente') // Excluir transacciones de viajes y pendientes
      .reduce((sum, t) => {
        const valor = parseFloat(t.valor || '0');
        // Lógica estandarizada: Positivos (desde mina) - Negativos (hacia mina)
        if (t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString()) {
          return sum + valor; // Positivo: desde mina (origen)
        } else if (t.paraQuienTipo === 'mina' && t.paraQuienId === minaId.toString()) {
          return sum - valor; // Negativo: hacia mina (destino)
        }
        return sum;
      }, 0);

    return {
      ingresos: ingresosViajes,
      transacciones: transaccionesNetas,
      total: ingresosViajes + transaccionesNetas
    };
  }, [todosViajesIncOcultos, todasTransaccionesIncOcultas, minaId]);

  // Mutations para eliminar transacciones
  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      const response = await fetch(apiUrl(`/api/transacciones/${transactionId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/minas/${minaId}`] });
      toast({
        title: "Transacción eliminada",
        description: "La transacción ha sido eliminada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la transacción",
        variant: "destructive",
      });
    },
  });

  // Función para manejar eliminación múltiple
  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedTransactions).map(id => 
          deleteTransactionMutation.mutateAsync(parseInt(id))
        )
      );
      setSelectedTransactions(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      console.error('Error en eliminación múltiple:', error);
    }
  };

  // Función para crear transacción temporal
  const handleCreateTemporalTransaction = (data: any) => {
    // Generar ID temporal único
    const temporalId = `temporal-${Date.now()}`;
    
    // Crear fecha con hora interna fija a las 00:00:01
    const fechaTransaccion = new Date(data.fecha);
    const horaInternaFija = new Date(fechaTransaccion);
    horaInternaFija.setHours(0, 0, 1, 0); // 00:00:01
    
    // Crear transacción temporal con estructura completa
    const nuevaTransacionTemporal: TransaccionWithSocio = {
      id: temporalId,
      concepto: data.concepto,
      valor: data.valor.toString(),
      fecha: data.fecha,
      deQuienTipo: data.deQuienTipo,
      deQuienId: data.deQuienId,
      paraQuienTipo: data.paraQuienTipo,
      paraQuienId: data.paraQuienId,
      formaPago: data.formaPago,
      voucher: data.voucher || null,
      comentario: data.comentario || null,
      tipo: "Temporal" as const,
      esViajeCompleto: false,
      horaInterna: horaInternaFija,
      oculta: false,
      userId: "main_user",
      createdAt: new Date(),
      socioNombre: mina?.nombre || "",
      tipoSocio: "mina" as const,
      socioId: minaId
    };

    // Agregar a la lista de transacciones temporales
    setTransaccionesTemporales(prev => [...prev, nuevaTransacionTemporal]);
    
    // Cerrar modal
    setShowTemporalTransaction(false);
    
    // Mostrar notificación
    toast({
      title: "Transacción temporal creada",
      description: "La transacción temporal se ha agregado correctamente. Se eliminará al salir de la vista.",
      variant: "default"
    });
  };

  // Función para eliminar transacción temporal
  const handleDeleteTemporalTransaction = (temporalId: string) => {
    setTransaccionesTemporales(prev => prev.filter(t => t.id !== temporalId));
    toast({
      title: "Transacción temporal eliminada",
      description: "La transacción temporal se ha eliminado correctamente.",
    });
  };

  // Loading states
  if (minaLoading || !mina || typeof mina !== 'object' || !mina.nombre) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">Cargando información de la mina...</p>
        </div>
      </div>
    );
  }

  if (!mina) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Mina no encontrada</h1>
          <p className="mt-2 text-muted-foreground">La mina solicitada no existe.</p>
          <Button 
            onClick={() => setLocation("/dashboard")}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header compacto */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/minas")}
                className="h-7 px-2"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Volver al listado</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">{mina.nombre}</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Gestión de mina</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Balance</p>
              <p className={`text-sm sm:text-lg font-bold ${balanceMina.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {balanceMina.total >= 0 ? '+' : ''}{formatCurrency(balanceMina.total)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal compacto */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rodmar-tabs grid w-full grid-cols-3 gap-1 p-1">
            <TabsTrigger 
              value="viajes" 
              className="text-sm px-3 py-2"
            >
              Viajes
              <Badge variant="secondary" className="ml-1">
                {viajesFiltrados.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="transacciones"
              className="text-sm px-3 py-2"
            >
              Transacciones
              <Badge variant="secondary" className="ml-1">
                {transaccionesFiltradas.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="balance"
              className="text-sm px-3 py-2"
            >
              Balance
            </TabsTrigger>
          </TabsList>

          {/* Tab de Viajes */}
          <TabsContent value="viajes" className="space-y-3">
            {/* Encabezado elegante de viajes */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Truck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900">Viajes</h3>
                      <p className="text-sm text-blue-600">{viajes.length} viajes totales</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-700 font-medium">{viajesFiltrados.length} mostrados</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-green-700 font-bold">
                          {formatCurrency(viajesFiltrados.reduce((sum, viaje) => sum + parseFloat(viaje.totalCompra || "0"), 0))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => {/* TODO: Export Excel */}}
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-600 hover:bg-green-50 h-8 px-3 text-xs font-medium"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Excel
                      </Button>
                      <Button
                        onClick={() => setShowImagePreview(true)}
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-600 hover:bg-purple-50 h-8 px-3 text-xs font-medium"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Imagen
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filtros de fecha para viajes compactos */}
            <Card>
              <CardContent className="p-2 sm:p-3">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Select value={viajesFechaFilterType} onValueChange={(value: DateFilterType) => setViajesFechaFilterType(value)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Filtrar fecha" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
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
                  </div>

                  {(viajesFechaFilterType === "exactamente" || viajesFechaFilterType === "entre" || viajesFechaFilterType === "despues-de" || viajesFechaFilterType === "antes-de") && (
                    <Input
                      type="date"
                      value={viajesFechaFilterValue}
                      onChange={(e) => setViajesFechaFilterValue(e.target.value)}
                      className="w-32 h-7 text-xs"
                    />
                  )}

                  {viajesFechaFilterType === "entre" && (
                    <Input
                      type="date"
                      value={viajesFechaFilterValueEnd}
                      onChange={(e) => setViajesFechaFilterValueEnd(e.target.value)}
                      className="w-32 h-7 text-xs"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {viajesLoading ? (
              <div className="text-center py-8">Cargando viajes...</div>
            ) : viajesFiltrados.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {viajesFechaFilterType === "todos" ? 
                    "No hay viajes registrados para esta mina" :
                    "No hay viajes en el rango de fechas seleccionado"
                  }
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">ID</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">F. CARGUE</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">F. DESCARGUE</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">CONDUCTOR</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">TIPO CARRO</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">PLACA</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">PESO (Ton)</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">CUT</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">COMPRA</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wide">ESTADO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viajesFiltrados.map((viaje) => (
                        <TableRow key={viaje.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{viaje.id}</TableCell>
                          <TableCell>
                            {viaje.fechaCargue ? (() => {
                              const dateStr = viaje.fechaCargue.toString().split('T')[0];
                              const [year, month, day] = dateStr.split('-');
                              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                              return date.toLocaleDateString('es-ES', { 
                                weekday: 'short',
                                day: '2-digit', 
                                month: '2-digit', 
                                year: '2-digit' 
                              });
                            })() : '-'}
                          </TableCell>
                          <TableCell>
                            {viaje.fechaDescargue ? (() => {
                              const dateStr = viaje.fechaDescargue.toString().split('T')[0];
                              const [year, month, day] = dateStr.split('-');
                              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                              return date.toLocaleDateString('es-ES', { 
                                weekday: 'short',
                                day: '2-digit', 
                                month: '2-digit', 
                                year: '2-digit' 
                              });
                            })() : '-'}
                          </TableCell>
                          <TableCell>{viaje.conductor || '-'}</TableCell>
                          <TableCell>{viaje.tipoCarro || '-'}</TableCell>
                          <TableCell>{viaje.placa || '-'}</TableCell>
                          <TableCell>{viaje.peso ? `${viaje.peso} Ton` : '-'}</TableCell>
                          <TableCell>{viaje.cut ? formatCurrency(parseFloat(viaje.cut)) : '-'}</TableCell>
                          <TableCell>{viaje.totalCompra ? formatCurrency(parseFloat(viaje.totalCompra)) : '-'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={viaje.fechaDescargue ? "default" : "secondary"}
                              className={viaje.fechaDescargue ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"}
                            >
                              {viaje.fechaDescargue ? "completado" : "pendiente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab de Transacciones */}
          <TabsContent value="transacciones" className="space-y-3">
            {/* Encabezado compacto de transacciones optimizado para móviles */}
            <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
              <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col gap-2">
                  {/* Primera línea: Título y botones */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 sm:p-2 bg-emerald-100 rounded-lg">
                        <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-emerald-900">Transacciones</h3>
                        <p className="text-xs sm:text-sm text-emerald-600 hidden sm:block">Historial financiero completo</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Button
                        onClick={() => setShowTemporalTransaction(true)}
                        size="sm"
                        variant="outline"
                        className="text-orange-600 border-orange-600 hover:bg-orange-50 h-7 sm:h-8 px-2 sm:px-3 text-xs"
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Temporal</span>
                      </Button>
                      <Button
                        onClick={() => setShowTransaccionesImagePreview(true)}
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-600 hover:bg-purple-50 h-7 sm:h-8 px-2 sm:px-3 text-xs"
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Imagen</span>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Segunda línea: Contador de registros */}
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-emerald-700 font-medium text-xs sm:text-sm">{transaccionesFiltradas.length} registros</span>
                    {transaccionesTemporales.length > 0 && (
                      <span className="text-orange-600 font-medium text-xs ml-2">
                        ({transaccionesTemporales.length} temporales)
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Controles de filtros optimizados para móviles */}
            <Card>
              <CardContent className="p-2">
                <div className="space-y-2">
                  {/* Fila única compacta: Búsqueda, filtro de fecha y botones */}
                  <div className="flex gap-1 items-center">
                    {/* Búsqueda compacta */}
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                      <Input
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-7 h-8 text-xs pr-2"
                      />
                    </div>
                    
                    {/* Filtro de fecha compacto */}
                    <div className="w-24 sm:w-32">
                      <Select value={transaccionesFechaFilterType} onValueChange={(value: DateFilterType) => setTransaccionesFechaFilterType(value)}>
                        <SelectTrigger className="h-8 text-xs px-2">
                          <SelectValue placeholder="Fecha" />
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
                    </div>

                    {/* Botones de ordenamiento ultra-compactos */}
                    <div className="flex gap-0.5">
                      <Button
                        variant={sortByFecha !== "ninguno" ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-7 p-0 relative ${sortByFecha === "desc" ? 'bg-blue-600 hover:bg-blue-700' : sortByFecha === "asc" ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                        title={`Fecha: ${sortByFecha === "desc" ? "Reciente" : sortByFecha === "asc" ? "Antiguo" : "Normal"}`}
                        onClick={() => {
                          setSortByValor("ninguno");
                          setSortByFecha(
                            sortByFecha === "ninguno" ? "desc" : 
                            sortByFecha === "desc" ? "asc" : "ninguno"
                          );
                        }}
                      >
                        <CalendarDays className="w-3 h-3" />
                        {sortByFecha === "asc" && <ArrowUp className="w-1.5 h-1.5 absolute -bottom-0.5 -right-0.5" />}
                        {sortByFecha === "desc" && <ArrowDown className="w-1.5 h-1.5 absolute -bottom-0.5 -right-0.5" />}
                      </Button>

                      <Button
                        variant={sortByValor !== "ninguno" ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-7 p-0 relative ${sortByValor === "desc" ? 'bg-green-600 hover:bg-green-700' : sortByValor === "asc" ? 'bg-green-500 hover:bg-green-600' : ''}`}
                        title={`Valor: ${sortByValor === "desc" ? "Mayor" : sortByValor === "asc" ? "Menor" : "Normal"}`}
                        onClick={() => {
                          setSortByFecha("ninguno");
                          setSortByValor(
                            sortByValor === "ninguno" ? "desc" : 
                            sortByValor === "desc" ? "asc" : "ninguno"
                          );
                        }}
                      >
                        <DollarSign className="w-3 h-3" />
                        {sortByValor === "asc" && <ArrowUp className="w-1.5 h-1.5 absolute -bottom-0.5 -right-0.5" />}
                        {sortByValor === "desc" && <ArrowDown className="w-1.5 h-1.5 absolute -bottom-0.5 -right-0.5" />}
                      </Button>
                      
                      {/* Botón mostrar ocultas */}
                      {(() => {
                        const transaccionesOcultas = todasTransaccionesIncOcultas?.filter(t => t.oculta).length || 0;
                        // Usar todosViajesIncOcultos para contar viajes ocultos (similar a compradores y volqueteros)
                        const viajesOcultos = todosViajesIncOcultos?.filter((v: ViajeWithDetails) => v.oculta).length || 0;
                        const totalOcultos = transaccionesOcultas + viajesOcultos;
                        const hayElementosOcultos = totalOcultos > 0;
                        
                        return hayElementosOcultos ? (
                          <Button
                            onClick={() => showAllHiddenMutation.mutate()}
                            size="sm"
                            className="h-8 w-7 p-0 bg-blue-600 hover:bg-blue-700 text-xs"
                            disabled={showAllHiddenMutation.isPending}
                            title={`Mostrar ${totalOcultos} elementos ocultos`}
                          >
                            +{totalOcultos}
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Segunda fila solo cuando se necesiten inputs de fecha */}
                  {(transaccionesFechaFilterType === "exactamente" || transaccionesFechaFilterType === "entre" || transaccionesFechaFilterType === "despues-de" || transaccionesFechaFilterType === "antes-de") && (
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={transaccionesFechaFilterValue}
                        onChange={(e) => setTransaccionesFechaFilterValue(e.target.value)}
                        className="flex-1 h-8 text-xs"
                      />
                      {transaccionesFechaFilterType === "entre" && (
                        <Input
                          type="date"
                          value={transaccionesFechaFilterValueEnd}
                          onChange={(e) => setTransaccionesFechaFilterValueEnd(e.target.value)}
                          className="flex-1 h-8 text-xs"
                        />
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Balance dinámico basado en transacciones filtradas y visibles */}
            {(() => {
              // Excluir transacciones pendientes y ocultas del cálculo de balance
              const transaccionesVisibles = transaccionesFiltradas.filter(t => !t.oculta && t.estado !== 'pendiente');
              
              const positivos = transaccionesVisibles.filter(t => {
                // Verde/Positivo para minas - ORDEN CORRECTO:
                if (t.deQuienTipo === 'viaje') {
                  return true; // Viajes siempre positivos (verdes)
                } else if (t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString()) {
                  return true; // PRIMERO: Desde esta mina = ingreso positivo (verde)
                } else if (t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco') {
                  return true; // Hacia RodMar/Banco = positivo (verde)
                }
                return false;
              });
              
              const negativos = transaccionesVisibles.filter(t => {
                // Rojo/Negativo para minas - ORDEN CORRECTO:
                // Solo transacciones hacia esta mina específica (que no sean desde la misma mina)
                return t.deQuienTipo !== 'viaje' && 
                       t.paraQuienTipo === 'mina' && 
                       t.paraQuienId === minaId.toString() &&
                       !(t.deQuienTipo === 'mina' && t.deQuienId === minaId.toString());
              });

              const sumPositivos = positivos.reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0);
              const sumNegativos = negativos.reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0);
              const balance = sumPositivos - sumNegativos;

              const formatMoney = (value: number) => {
                return new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                }).format(Math.abs(value)).replace('COP', '$');
              };

              return (
                <Card className="border-gray-200 bg-gray-50">
                  <CardContent className="p-1.5 sm:p-2">
                    <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center">
                      <div 
                        className={`bg-green-50 rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${
                          balanceFilter === 'positivos' ? 'ring-2 ring-green-400 shadow-md' : ''
                        }`}
                        onClick={() => setBalanceFilter('positivos')}
                      >
                        <div className="text-green-600 text-xs font-medium">Positivos</div>
                        <div className="text-green-700 text-xs sm:text-sm font-semibold">
                          +{positivos.length} {formatMoney(sumPositivos)}
                        </div>
                      </div>
                      <div 
                        className={`bg-red-50 rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${
                          balanceFilter === 'negativos' ? 'ring-2 ring-red-400 shadow-md' : ''
                        }`}
                        onClick={() => setBalanceFilter('negativos')}
                      >
                        <div className="text-red-600 text-xs font-medium">Negativos</div>
                        <div className="text-red-700 text-xs sm:text-sm font-semibold">
                          -{negativos.length} {formatMoney(sumNegativos)}
                        </div>
                      </div>
                      <div 
                        className={`rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${
                          balance >= 0 ? 'bg-green-100' : 'bg-red-100'
                        } ${
                          balanceFilter === 'all' 
                            ? balance >= 0
                              ? 'ring-2 ring-green-400 shadow-md'
                              : 'ring-2 ring-red-400 shadow-md'
                            : ''
                        }`}
                        onClick={() => setBalanceFilter('all')}
                      >
                        <div className={`text-xs font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balance</div>
                        <div className={`text-xs sm:text-sm font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {balance >= 0 ? '+' : '-'}{formatMoney(Math.abs(balance))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Header de selección múltiple */}
            {selectedTransactions.size > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {selectedTransactions.size} transacción(es) seleccionada(s)
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={handleBulkDelete}
                        size="sm"
                        variant="destructive"
                        disabled={deleteTransactionMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedTransactions(new Set());
                          setIsSelectionMode(false);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {transaccionesLoading ? (
              <div className="text-center py-8">Cargando transacciones...</div>
            ) : transaccionesFiltradas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {filterType === "ocultas" 
                    ? "No hay transacciones ocultas" 
                    : "No hay transacciones registradas para esta mina"
                  }
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {transaccionesFiltradas.map((transaccion) => (
                  <Card 
                    key={transaccion.id} 
                    className={`transition-colors ${
                      transaccion.estado === 'pendiente'
                        ? 'bg-orange-50 border-2 border-orange-300 cursor-pointer hover:bg-orange-100'
                        : transaccion.tipo === "Temporal" 
                          ? "border border-gray-200 cursor-default hover:bg-orange-50" 
                          : "border border-gray-200 cursor-pointer hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (transaccion.tipo !== "Temporal") {
                        setSelectedTransaction(transaccion);
                        // Si es transacción pendiente, abrir modal de detalles de solicitud
                        if (transaccion.estado === 'pendiente') {
                          setShowPendingDetailModal(true);
                        } else {
                          setShowTransactionDetail(true);
                        }
                      }
                    }}
                  >
                    <CardContent className="p-2 sm:p-3">
                      <div className="flex items-center justify-between gap-2">
                        {/* Lado izquierdo: Fecha y concepto */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {(() => {
                                const dateStr = transaccion.fecha.toString().split('T')[0];
                                const [year, month, day] = dateStr.split('-');
                                const shortYear = year.slice(-2);
                                const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                                const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                const dayName = dayNames[date.getDay()];
                                const monthName = monthNames[parseInt(month) - 1];
                                return `${dayName}. ${day}/${month}/${shortYear}`;
                              })()}
                            </span>
                            {transaccion.deQuienTipo === 'viaje' ? (
                              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">V</Badge>
                            ) : transaccion.tipo === "Temporal" ? (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-orange-600 border-orange-600">T</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4">M</Badge>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-900 truncate pr-1">
                            {transaccion.concepto && transaccion.concepto.includes('data:image') ? 
                              '[Imagen]' : 
                              transaccion.tipo === "Temporal" ? 
                                `${transaccion.concepto} (Temporal)` :
                                transaccion.concepto
                            }
                          </div>
                          {/* Comentario compacto si existe */}
                          {transaccion.comentario && transaccion.comentario.trim() && (
                            <div className="text-xs text-gray-500 mt-0.5 leading-tight">
                              {transaccion.comentario.length > 50 ? 
                                `${transaccion.comentario.substring(0, 50)}...` : 
                                transaccion.comentario
                              }
                            </div>
                          )}
                        </div>

                        {/* Lado derecho: Valor y acción */}
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                            (() => {
                              // Transacciones pendientes = azul claro (no afectan balances)
                              if (transaccion.estado === 'pendiente') {
                                return 'text-blue-400'; // Azul claro para pendientes
                              } else if (transaccion.deQuienTipo === 'viaje') {
                                return 'text-green-600'; // Viajes siempre positivos (verdes)
                              } else if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId.toString()) {
                                return 'text-green-600'; // DESDE esta mina = ingreso positivo (verde)
                              } else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId.toString()) {
                                return 'text-red-600'; // HACIA esta mina = egreso negativo (rojo)
                              } else if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                                return 'text-green-600'; // Hacia RodMar/Banco = positivo (verde)
                              } else {
                                return 'text-gray-600'; // Fallback
                              }
                            })()
                          }`}>
                            {(() => {
                              const valor = parseFloat(transaccion.valor || '0');
                              
                              if (transaccion.deQuienTipo === 'viaje') {
                                return `+$ ${valor.toLocaleString()}`;
                              } else if (transaccion.deQuienTipo === 'mina' && transaccion.deQuienId === minaId.toString()) {
                                return `+$ ${valor.toLocaleString()}`; // DESDE esta mina = ingreso positivo
                              } else if (transaccion.paraQuienTipo === 'mina' && transaccion.paraQuienId === minaId.toString()) {
                                return `-$ ${valor.toLocaleString()}`; // HACIA esta mina = egreso negativo
                              } else if (transaccion.paraQuienTipo === 'rodmar' || transaccion.paraQuienTipo === 'banco') {
                                return `+$ ${valor.toLocaleString()}`; // Hacia RodMar/Banco = positivo
                              } else {
                                return `$ ${valor.toLocaleString()}`; // Fallback sin signo
                              }
                            })()}
                          </span>
                          
                          {transaccion.tipo === "Temporal" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-red-100 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemporalTransaction(transaccion.id as string);
                              }}
                              title="Eliminar transacción temporal"
                            >
                              <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500" />
                            </Button>
                          ) : transaccion.tipo === "Manual" ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-blue-100 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransaction(transaccion);
                                  // Si es transacción pendiente, abrir modal de editar pendiente
                                  if (transaccion.estado === 'pendiente') {
                                    setShowEditPendingTransaction(true);
                                  } else {
                                    setShowEditTransaction(true);
                                  }
                                }}
                                title="Editar transacción"
                              >
                                <Edit className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-red-100 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransaction(transaccion);
                                  // Si es transacción pendiente, abrir modal de confirmación de eliminación
                                  if (transaccion.estado === 'pendiente') {
                                    setShowDeletePendingConfirm(true);
                                  } else {
                                    setShowDeleteTransaction(true);
                                  }
                                }}
                                title="Eliminar transacción"
                              >
                                <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-gray-100 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hideTransactionMutation.mutate(transaccion.id);
                                }}
                                disabled={hideTransactionMutation.isPending}
                                title="Ocultar transacción"
                              >
                                <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                              </Button>
                            </div>
                          ) : transaccion.tipo === "Viaje" && (transaccion as any).viajeId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-gray-100 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                hideViajeMutation.mutate((transaccion as any).viajeId);
                              }}
                              disabled={hideViajeMutation.isPending}
                              title="Ocultar viaje de transacciones"
                            >
                              <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                            </Button>
                          ) : (
                            <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center shrink-0">
                              <span className="text-xs text-gray-400" title="No se puede ocultar esta transacción">
                                —
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab de Balance */}
          <TabsContent value="balance" className="space-y-3">
            {/* Encabezado compacto de balance optimizado para móviles */}
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1 sm:p-2 bg-amber-100 rounded-lg">
                    <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-amber-900">Resumen Financiero</h3>
                    <p className="text-sm text-amber-600">Estado actual de la mina</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-green-50 p-2 rounded-lg">
                    <div className="flex items-center space-x-1 mb-1">
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <p className="text-xs text-green-700 font-medium">Ingresos</p>
                    </div>
                    <p className="text-sm sm:text-lg font-bold text-green-600">
                      +{formatCurrency(balanceMina.ingresos)}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <div className="flex items-center space-x-1 mb-1">
                      <Receipt className="w-3 h-3 text-blue-600" />
                      <p className="text-xs text-blue-700 font-medium">Transacciones</p>
                    </div>
                    <p className={`text-sm sm:text-lg font-bold ${balanceMina.transacciones >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {balanceMina.transacciones >= 0 ? '+' : ''}{formatCurrency(balanceMina.transacciones)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center space-x-1 mb-1">
                      <DollarSign className="w-3 h-3 text-gray-600" />
                      <p className="text-xs text-gray-700 font-medium">Balance Total</p>
                    </div>
                    <p className={`text-sm sm:text-lg font-bold ${balanceMina.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {balanceMina.total >= 0 ? '+' : ''}{formatCurrency(balanceMina.total)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modales */}
      <NewTransactionModal
        open={showNewTransaction}
        onClose={() => setShowNewTransaction(false)}
      />

      {/* Modal para transacciones temporales */}
      <NewTransactionModal
        open={showTemporalTransaction}
        onClose={() => setShowTemporalTransaction(false)}
        onSuccess={handleCreateTemporalTransaction}
        isTemporalMode={true}
        minaActual={mina ? { id: mina.id, nombre: mina.nombre } : undefined}
      />

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

      {/* Modales para transacciones pendientes */}
      {selectedTransaction && selectedTransaction.estado === 'pendiente' && (
        <>
          <SolicitarTransaccionModal
            open={showEditPendingTransaction}
            onClose={() => {
              setShowEditPendingTransaction(false);
              setSelectedTransaction(null);
            }}
            initialData={{
              id: selectedTransaction.id,
              paraQuienTipo: selectedTransaction.paraQuienTipo || '',
              paraQuienId: selectedTransaction.paraQuienId || '',
              valor: selectedTransaction.valor || '',
              comentario: selectedTransaction.comentario || undefined,
              detalle_solicitud: selectedTransaction.detalle_solicitud || '',
            }}
          />
          <PendingDetailModal
            open={showPendingDetailModal}
            transaccion={{
              id: selectedTransaction.id,
              concepto: selectedTransaction.concepto || '',
              valor: selectedTransaction.valor || '',
              fecha: selectedTransaction.fecha?.toString() || '',
              codigo_solicitud: selectedTransaction.codigo_solicitud || null,
              detalle_solicitud: selectedTransaction.detalle_solicitud || null,
              paraQuienTipo: selectedTransaction.paraQuienTipo || null,
              paraQuienId: selectedTransaction.paraQuienId || null,
              comentario: selectedTransaction.comentario || null,
            }}
            onClose={() => {
              setShowPendingDetailModal(false);
              setSelectedTransaction(null);
            }}
            onEdit={(transaccion) => {
              setShowPendingDetailModal(false);
              setShowEditPendingTransaction(true);
            }}
            onComplete={(transaccion) => {
              setShowPendingDetailModal(false);
              setShowCompleteModal(true);
            }}
          />
          <CompleteTransactionModal
            open={showCompleteModal}
            onClose={() => {
              setShowCompleteModal(false);
              setSelectedTransaction(null);
            }}
            transaccionId={selectedTransaction.id}
            paraQuienTipo={selectedTransaction.paraQuienTipo || undefined}
            paraQuienId={selectedTransaction.paraQuienId || undefined}
          />
        </>
      )}

      {/* AlertDialog para confirmar eliminación de transacción pendiente */}
      <AlertDialog open={showDeletePendingConfirm} onOpenChange={setShowDeletePendingConfirm}>
        <AlertDialogContent className="border-2 border-red-300">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la transacción pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTransaction) {
                  deletePendingTransactionMutation.mutate(selectedTransaction.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePendingTransactionMutation.isPending}
            >
              {deletePendingTransactionMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransactionDetailModal
        open={showTransactionDetail}
        onOpenChange={(open) => {
          setShowTransactionDetail(open);
          if (!open) setSelectedTransaction(null);
        }}
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

      <ViajesImageModal
        open={showImagePreview}
        onOpenChange={(open) => setShowImagePreview(open)}
        mina={mina}
        viajes={viajesFiltrados}
        filterType={viajesFechaFilterType}
        filterValue={viajesFechaFilterValue}
        filterValueEnd={viajesFechaFilterValueEnd}
      />

      <TransaccionesImageModal
        open={showTransaccionesImagePreview}
        onOpenChange={(open) => setShowTransaccionesImagePreview(open)}
        transacciones={transaccionesFiltradas}
        mina={mina}
        filterLabel={(() => {
          // Función para formatear fecha en formato DD/MM/YYYY
          const formatDateForLabel = (dateString: string): string => {
            if (!dateString) return "";
            if (dateString.includes('-')) {
              const [year, month, day] = dateString.split('-');
              return `${day}/${month}/${year}`;
            }
            return dateString;
          };

          const formatValue = formatDateForLabel(transaccionesFechaFilterValue);
          const formatValueEnd = formatDateForLabel(transaccionesFechaFilterValueEnd);
          
          const filterLabels: Record<string, string> = {
            "todos": "Todas las Transacciones",
            "exactamente": `Fecha: ${formatValue}`,
            "entre": `Entre: ${formatValue} - ${formatValueEnd}`,
            "despues-de": `Después de ${formatValue}`,
            "antes-de": `Antes de ${formatValue}`,
            "hoy": "Hoy",
            "ayer": "Ayer",
            "esta-semana": "Esta Semana",
            "semana-pasada": "Semana Pasada",
            "este-mes": "Este Mes",
            "mes-pasado": "Mes Pasado",
            "este-año": "Este Año",
            "año-pasado": "Año Pasado"
          };
          
          return filterLabels[transaccionesFechaFilterType] || "Filtro Personalizado";
        })()}
      />

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
    </div>
  );
}