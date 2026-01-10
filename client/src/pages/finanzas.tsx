import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Plus, Download, Filter, Edit, Trash2, CheckSquare, Square, CalendarDays, DollarSign, ArrowUp, ArrowDown, Calculator, BarChart3, TrendingUp } from "lucide-react";
// Formateo de fechas se maneja directamente en el componente
import { formatDate, formatCurrency, highlightText, highlightValue } from "@/lib/utils";
import { getDateRangeFromFilter, type DateFilterType } from "@/lib/date-filter-utils";
import TransactionModal from "@/components/forms/transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { PendingDetailModal } from "@/components/pending-transactions/pending-detail-modal";
import { CompleteTransactionModal } from "@/components/modals/complete-transaction-modal";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/usePagination";
import { apiUrl } from "@/lib/api";
import { getAuthToken } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useVolqueterosBalance } from "@/hooks/useVolqueterosBalance";
import { useCompradoresBalance } from "@/hooks/useCompradoresBalance";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

import type { TransaccionWithSocio } from "@shared/schema";

interface FinanzasProps {
  onOpenTransaction?: () => void;
  hideBottomNav?: boolean; // Para ocultar navegación cuando se renderiza desde dashboard
}

export default function Finanzas({ onOpenTransaction, hideBottomNav = false }: FinanzasProps = {}) {
  const { has } = usePermissions();
  const [activeTab, setActiveTab] = useState<string>("transacciones");
  console.log('🎯 COMPONENTE FINANZAS (PAGES) - Iniciando render');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransaccionWithSocio | null>(null);
  const [showEditPendingTransaction, setShowEditPendingTransaction] = useState(false);
  const [showPendingDetailModal, setShowPendingDetailModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDeletePendingConfirm, setShowDeletePendingConfirm] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Paginación con memoria en localStorage
  const { currentPage, setCurrentPage, pageSize, setPageSize, getLimitForServer } = usePagination({
    storageKey: "transacciones-pageSize",
    defaultPageSize: 50,
  });

  const [valorFilterType, setValorFilterType] = useState<string>("todos");
  const [valorFilterValue, setValorFilterValue] = useState("");
  const [valorFilterValueEnd, setValorFilterValueEnd] = useState("");
  const [sortByValor, setSortByValor] = useState<"ninguno" | "asc" | "desc">("ninguno");
  const [sortByFecha, setSortByFecha] = useState<"ninguno" | "asc" | "desc">("desc");
  const [fechaFilterType, setFechaFilterType] = useState<string>("todos");
  const [fechaFilterValue, setFechaFilterValue] = useState("");
  const [fechaFilterValueEnd, setFechaFilterValueEnd] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');

  // Funciones para manejar los tres estados de ordenamiento (ninguno -> asc -> desc -> ninguno)
  const toggleSortFecha = () => {
    const cycle: Array<"ninguno" | "asc" | "desc"> = ["ninguno", "asc", "desc"];
    const currentIndex = cycle.indexOf(sortByFecha);
    const nextIndex = (currentIndex + 1) % cycle.length;
    setSortByFecha(cycle[nextIndex]);
  };

  const toggleSortValor = () => {
    const cycle: Array<"ninguno" | "asc" | "desc"> = ["ninguno", "asc", "desc"];
    const currentIndex = cycle.indexOf(sortByValor);
    const nextIndex = (currentIndex + 1) % cycle.length;
    setSortByValor(cycle[nextIndex]);
  };

  // Función para convertir valor formateado a número
  const parseFormattedValue = (formattedValue: string): string => {
    return formattedValue.replace(/[^\d]/g, '');
  };

  // Función para limpiar conceptos que contienen datos base64
  const cleanConcepto = (concepto: string): string => {
    if (!concepto) return concepto;
    
    // Si el concepto contiene "data:image" o muy largo, lo limpiamos
    if (concepto.includes('data:image') || concepto.includes('#IMAGE') || concepto.length > 150) {
      // Extraer solo la parte descriptiva antes de los datos base64
      const parts = concepto.split(' • ');
      if (parts.length > 0) {
        let cleanPart = parts[0].replace(/\s*#IMAGE.*$/, '').trim();
        // También limpiar si contiene data:image en la parte principal
        cleanPart = cleanPart.replace(/data:image[^,]*,[A-Za-z0-9+/=]+/g, '[Imagen]');
        return cleanPart || 'Transacción con imagen adjunta';
      }
      return 'Transacción con imagen adjunta';
    }
    return concepto;
  };

  // Función para limpiar nombres de socios que contienen datos base64
  const cleanSocioNombre = (nombre: string): string => {
    if (!nombre) return nombre;
    
    // Si el nombre contiene datos base64, limpiarlo
    if (nombre.includes('data:image') || nombre.length > 100) {
      return nombre.replace(/data:image[^,]*,[A-Za-z0-9+/=]+/g, '[Imagen]');
    }
    return nombre;
  };

  // Mutación para eliminar transacciones pendientes
  const deletePendingTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/transacciones/${id}`), {
        method: "DELETE",
        credentials: "include",
        headers,
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
      
      // Invalidar módulo general de transacciones
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      // React Query refetchea automáticamente si la query está activa
      
      // Invalidar y refetch queries del socio destino
      if (selectedTransaction?.paraQuienTipo && selectedTransaction?.paraQuienId) {
        if (selectedTransaction.paraQuienTipo === 'comprador') {
          const compradorId = typeof selectedTransaction.paraQuienId === 'string' ? parseInt(selectedTransaction.paraQuienId) : selectedTransaction.paraQuienId;
          queryClient.invalidateQueries({ queryKey: ["/api/transacciones/comprador", compradorId] });
          // React Query refetchea automáticamente si la query está activa
        }
        if (selectedTransaction.paraQuienTipo === 'mina') {
          const minaIdStr = String(selectedTransaction.paraQuienId);
          queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/transacciones/socio/mina/${minaIdStr}/all`] });
          // React Query refetchea automáticamente si la query está activa
        }
        if (selectedTransaction.paraQuienTipo === 'volquetero') {
          const volqueteroId = typeof selectedTransaction.paraQuienId === 'string' ? parseInt(selectedTransaction.paraQuienId) : selectedTransaction.paraQuienId;
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/volqueteros" &&
                queryKey[1] === volqueteroId &&
                queryKey[2] === "transacciones";
            },
          });
          // React Query refetchea automáticamente si la query está activa
        }
      }
      
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

  const handleEditTransaction = (transaction: TransaccionWithSocio) => {
    setSelectedTransaction(transaction);
    // Si es transacción pendiente, abrir modal de editar pendiente
    if (transaction.estado === 'pendiente') {
      setShowEditPendingTransaction(true);
    } else {
      setShowEditModal(true);
    }
  };

  const handleDeleteTransaction = (transaction: TransaccionWithSocio) => {
    setSelectedTransaction(transaction);
    // Si es transacción pendiente, abrir modal de confirmación de eliminación
    if (transaction.estado === 'pendiente') {
      setShowDeletePendingConfirm(true);
    } else {
      setShowDeleteModal(true);
    }
  };

  const toggleTransactionSelection = (transactionId: number) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredAndSortedTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredAndSortedTransactions.map(t => t.id)));
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedTransactions.size === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl('/api/transacciones/bulk-delete'), {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          ids: Array.from(selectedTransactions)
        }),
        credentials: 'include',
      });

      if (response.ok) {
        setSelectedTransactions(new Set());
        setIsMultiSelectMode(false);
        setShowBulkDeleteModal(false);
        queryClient.invalidateQueries({ queryKey: ['/api/transacciones'] });
      }
    } catch (error) {
      console.error('Error eliminando transacciones:', error);
    }
  };

  const handleTransactionDetailClick = (transaction: TransaccionWithSocio) => {
    // No abrir modal si está en modo selección múltiple
    if (isMultiSelectMode) return;
    
    setSelectedTransaction(transaction);
    // Si es transacción pendiente, abrir modal de detalles de solicitud
    if (transaction.estado === 'pendiente') {
      setShowPendingDetailModal(true);
    } else {
      setShowDetailModal(true);
    }
  };

  // Calcular fechaDesde y fechaHasta usando función centralizada
  // Para "entre": fechaFilterValue = inicio, fechaFilterValueEnd = fin
  // Para otros: fechaFilterValue = fecha específica
  const dateRange = useMemo(() => {
    if (fechaFilterType === "entre") {
      // Para "entre", necesitamos fechaFilterValue (inicio) y fechaFilterValueEnd (fin)
      return getDateRangeFromFilter(
        fechaFilterType as DateFilterType,
        fechaFilterValue, // inicio
        fechaFilterValueEnd // fin
      );
    } else {
      // Para otros tipos, fechaFilterValue es la fecha específica
      return getDateRangeFromFilter(
        fechaFilterType as DateFilterType,
        fechaFilterValue, // fecha específica
        undefined // no se necesita fecha fin
      );
    }
  }, [fechaFilterType, fechaFilterValue, fechaFilterValueEnd]);

  // Query paginada de transacciones (sin filtros - solo paginación)
  const { 
    data: transactionsData, 
    isLoading 
  } = useQuery<{
    data: TransaccionWithSocio[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: [
      "/api/transacciones", 
      currentPage, 
      pageSize
    ],
    queryFn: async () => {
      // Solo enviar paginación al servidor (sin filtros)
      const limit = getLimitForServer(transactionsData?.pagination?.total);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      
      // Ordenamiento por defecto (solo fecha desc)
      params.append('sortByFecha', 'desc');
      
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/transacciones?${params.toString()}`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const allTransactions = transactionsData?.data || [];
  const pagination = transactionsData?.pagination;

  // Filtrado client-side sobre la página activa
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Filtro de búsqueda (texto) - buscar en concepto, comentario y monto (valor)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const searchNumeric = searchTerm.replace(/[^\d]/g, ''); // Solo números para búsqueda en valor
      filtered = filtered.filter(t => {
        const concepto = cleanConcepto(t.concepto || '').toLowerCase();
        const comentario = (t.comentario || '').toLowerCase();
        const valor = String(t.valor || '').replace(/[^\d]/g, ''); // Solo números del valor
        const socioNombre = cleanSocioNombre(t.socioNombre || '').toLowerCase();
        const deQuien = (t.deQuien || '').toLowerCase();
        const paraQuien = (t.paraQuien || '').toLowerCase();
        return concepto.includes(searchLower) || 
               comentario.includes(searchLower) ||
               (searchNumeric && valor.includes(searchNumeric)) ||
               socioNombre.includes(searchLower) ||
               deQuien.includes(searchLower) ||
               paraQuien.includes(searchLower);
      });
    }

    // Filtro de fecha - Comparar solo la parte de fecha (sin hora) para evitar problemas de zona horaria
    if (dateRange) {
      filtered = filtered.filter(t => {
        // Extraer solo la parte de fecha como string (YYYY-MM-DD) de la transacción usando métodos locales
        let fechaTransStr: string;
        if (typeof t.fecha === 'string') {
          // Si es string ISO, tomar solo la parte de fecha
          fechaTransStr = t.fecha.split('T')[0];
        } else {
          // Si es Date, usar métodos locales para evitar problemas de zona horaria
          const date = new Date(t.fecha);
          fechaTransStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        
        // dateRange.start y dateRange.end ya son strings en formato YYYY-MM-DD
        const fechaInicio = dateRange.start;
        const fechaFin = dateRange.end;
        
        // Comparar strings directamente (YYYY-MM-DD) para evitar problemas de zona horaria
        return fechaTransStr >= fechaInicio && fechaTransStr <= fechaFin;
      });
    }

    // Filtro de valor
    if (valorFilterType && valorFilterType !== "todos" && valorFilterValue) {
      const valorNum = parseFloat(parseFormattedValue(valorFilterValue));
      filtered = filtered.filter(t => {
        const valorTrans = Math.abs(t.valor || 0);
        switch (valorFilterType) {
          case "mayor-que":
            return valorTrans > valorNum;
          case "menor-que":
            return valorTrans < valorNum;
          case "igual-a":
            return Math.abs(valorTrans - valorNum) < 0.01;
          case "entre":
            if (valorFilterValueEnd) {
              const valorFin = parseFloat(parseFormattedValue(valorFilterValueEnd));
              return valorTrans >= Math.min(valorNum, valorFin) && valorTrans <= Math.max(valorNum, valorFin);
            }
            return true;
          default:
            return true;
        }
      });
    }

    // Filtro de balance (positivos/negativos) - usando la misma lógica que balanceCalculations
    if (balanceFilter !== 'all') {
      filtered = filtered.filter(t => {
        const valor = Math.abs(t.valor || 0);
        const isFromPartner = t.deQuienTipo === 'mina' || 
                              t.deQuienTipo === 'comprador' || 
                              t.deQuienTipo === 'volquetero';
        const isToRodMar = t.paraQuienTipo === 'rodmar';
        const isToPartner = t.paraQuienTipo === 'mina' || 
                           t.paraQuienTipo === 'comprador' || 
                           t.paraQuienTipo === 'volquetero';
        const isToBanco = t.paraQuienTipo === 'banco';
        const isRodMarToRodMar = t.deQuienTipo === 'rodmar' && t.paraQuienTipo === 'rodmar';

        if (balanceFilter === 'positivos') {
          // Positivos: desde socios (mina/comprador/volquetero) o hacia RodMar (excepto RodMar→RodMar)
          return isFromPartner || (isToRodMar && !isRodMarToRodMar);
        } else if (balanceFilter === 'negativos') {
          // Negativos: hacia socios o banco (excepto desde socios o RodMar→RodMar)
          return (isToPartner || isToBanco) && !isFromPartner && !isRodMarToRodMar;
        }
        return true;
      });
    }

    // Ordenamiento
    if (sortByFecha !== "ninguno") {
      filtered.sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return sortByFecha === "asc" ? fechaA - fechaB : fechaB - fechaA;
      });
    }

    if (sortByValor !== "ninguno") {
      filtered.sort((a, b) => {
        const valorA = Math.abs(a.valor || 0);
        const valorB = Math.abs(b.valor || 0);
        return sortByValor === "asc" ? valorA - valorB : valorB - valorA;
      });
    }

    return filtered;
  }, [allTransactions, searchTerm, dateRange, valorFilterType, valorFilterValue, valorFilterValueEnd, sortByFecha, sortByValor, balanceFilter]);

  const transactions = filteredAndSortedTransactions;

  // Prefetching automático en segundo plano (solo si no está en modo "todo")
  useEffect(() => {
    if (pagination && currentPage === 1 && pagination.totalPages > 1 && pageSize !== "todo") {
      // Prefetch páginas siguientes en segundo plano (sin bloquear) - sin filtros
      const prefetchPages = Math.min(pagination.totalPages, 10); // Prefetch hasta 10 páginas
      setTimeout(() => {
        for (let page = 2; page <= prefetchPages; page++) {
          const limit = getLimitForServer();
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
          });
          params.append('sortByFecha', 'desc'); // Ordenamiento por defecto
          
          queryClient.prefetchQuery({
            queryKey: [
              "/api/transacciones", 
              page, 
              typeof pageSize === "number" ? pageSize : 999999
            ],
            queryFn: async () => {
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              
              if (token) {
                headers["Authorization"] = `Bearer ${token}`;
              }
              
              const response = await fetch(apiUrl(`/api/transacciones?${params.toString()}`), {
                credentials: "include",
                headers,
              });
              if (!response.ok) throw new Error('Error al obtener transacciones');
              return response.json();
            },
            staleTime: 300000,
          });
        }
      }, 100); // Pequeño delay para no bloquear la UI inicial
    }
  }, [pagination, currentPage, pageSize, queryClient, getLimitForServer]);
  
  console.log('🏦 FINANZAS (PAGES) - Total recibidas:', transactions.length);
  if (transactions.length > 0) {
    console.log('📅 PRIMERA TRANSACCIÓN - Fecha raw:', transactions[0].fecha);
    console.log('📅 PRIMERA TRANSACCIÓN - Tipo fecha:', typeof transactions[0].fecha);
  }

  // Limpiar valores cuando cambia el tipo de filtro
  useEffect(() => {
    if (valorFilterType === "todos") {
      setValorFilterValue("");
      setValorFilterValueEnd("");
    } else if (valorFilterType !== "entre") {
      // Si cambia de "entre" a otro tipo, limpiar el valor final
      setValorFilterValueEnd("");
    }
  }, [valorFilterType]);

  useEffect(() => {
    if (fechaFilterType === "todos") {
      setFechaFilterValue("");
      setFechaFilterValueEnd("");
    } else if (fechaFilterType !== "entre" && fechaFilterType !== "exactamente" && fechaFilterType !== "despues-de" && fechaFilterType !== "antes-de") {
      // Si es un filtro predefinido (hoy, ayer, etc.), limpiar valores de fecha
      setFechaFilterValue("");
      setFechaFilterValueEnd("");
    } else if (fechaFilterType !== "entre") {
      // Si cambia de "entre" a otro tipo, limpiar el valor final
      setFechaFilterValueEnd("");
    }
  }, [fechaFilterType]);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, valorFilterType, valorFilterValue, valorFilterValueEnd, fechaFilterType, fechaFilterValue, fechaFilterValueEnd, sortByValor, sortByFecha]);

  // OPTIMIZACIÓN: Eliminadas queries redundantes de minas/compradores/volqueteros
  // Los nombres ya vienen resueltos desde el backend en las transacciones

  // Lazy loading: solo cargar viajes cuando hay transacciones tipo "Viaje" seleccionadas
  // En este módulo normalmente no hay transacciones tipo "Viaje", pero mantenemos por compatibilidad
  const needsViajesData = selectedTransaction?.tipoTransaccion === "Viaje";
  const { data: viajes = [] } = useQuery<any[]>({
    queryKey: ["/api/viajes"],
    staleTime: 30000,
    enabled: needsViajesData, // Solo ejecutar cuando se necesite realmente
  });



  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  // Función para calcular el valor de visualización considerando la lógica de colores
  const getDisplayValue = (transaction: any) => {
    let valor = parseFloat(transaction.valor);
    
    // LÓGICA DE CODIFICACIÓN DE COLORES UNIFICADA:
    // 1. Transacciones desde mina/comprador/volquetero = Verde y positivo  
    // 2. Transacciones RodMar a RodMar = Azul y no afecta balance (neutral)
    
    const isFromPartner = transaction.deQuienTipo === 'mina' || 
                         transaction.deQuienTipo === 'comprador' || 
                         transaction.deQuienTipo === 'volquetero';
    
    const isRodMarToRodMar = transaction.deQuienTipo === 'rodmar' && transaction.paraQuienTipo === 'rodmar';
    
    if (isFromPartner) {
      // Regla 1: Origen desde socios = valor positivo (verde)
      valor = Math.abs(valor);
    } else if (isRodMarToRodMar) {
      // Regla 2: RodMar a RodMar = neutral (0) para no afectar ordenamiento/balance
      valor = 0;
    } else {
      // Lógica anterior para otros casos
      if (transaction.paraQuienTipo) {
        const isToPartner = transaction.paraQuienTipo === 'mina' || 
                          transaction.paraQuienTipo === 'comprador' || 
                          transaction.paraQuienTipo === 'volquetero';
        const isToBanco = transaction.paraQuienTipo === 'banco';
        
        if (isToPartner || isToBanco) {
          // Destino hacia socios o banco = valor negativo (rojo)
          valor = -Math.abs(valor);
        } else {
          // Destino hacia RodMar = valor positivo (verde)
          valor = Math.abs(valor);
        }
      } else if (transaction.deQuienTipo === 'rodmar') {
        // Origen desde RodMar = valor negativo (rojo)
        valor = -Math.abs(valor);
      }
    }
    
    return valor;
  };

  // OPTIMIZACIÓN: Memoizar cálculos de balance para evitar recálculos en cada render
  const balanceCalculations = useMemo(() => {
    let positivos = 0;
    let negativos = 0;
    let balance = 0;

    // Excluir transacciones pendientes del cálculo de balance
    filteredAndSortedTransactions.filter(t => t.estado !== 'pendiente').forEach((t) => {
      const isFromPartner = t.deQuienTipo === 'mina' || 
                           t.deQuienTipo === 'comprador' || 
                           t.deQuienTipo === 'volquetero';
      
      const isToPartner = t.paraQuienTipo === 'mina' || 
                         t.paraQuienTipo === 'comprador' || 
                         t.paraQuienTipo === 'volquetero';
      
      const isToBanco = t.paraQuienTipo === 'banco';
      const isToRodMar = t.paraQuienTipo === 'rodmar';
      const isRodMarToRodMar = t.deQuienTipo === 'rodmar' && t.paraQuienTipo === 'rodmar';
      
      const valor = Math.abs(parseFloat(t.valor));

      // Calcular positivos
      if (isFromPartner || (isToRodMar && !isRodMarToRodMar)) {
        positivos += valor;
      }

      // Calcular negativos
      if ((isToPartner || isToBanco) && !isFromPartner && !isRodMarToRodMar) {
        negativos += valor;
      }

      // Calcular balance total
      if (isRodMarToRodMar) {
        // No afecta balance
      } else if (isFromPartner) {
        balance += valor; // Positivo para origen desde socios
      } else {
        if (isToRodMar) {
          balance += valor; // Positivo para destino RodMar
        } else if (isToPartner || isToBanco) {
          balance -= valor; // Negativo para destino socios o banco
        }
      }
    });

    return {
      positivos,
      negativos,
      balance,
      balanceColorClass: balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-600'
    };
  }, [filteredAndSortedTransactions]);

  const handleExport = () => {
    console.log("Export functionality would go here");
  };

  // ========== QUERIES PARA PESTAÑAS BALANCES, ESTADO Y GANANCIAS ==========
  
  // Query para financialSummary (usado en Estado y Ganancias)
  const { data: financialSummary } = useQuery({
    queryKey: ["/api/financial-summary"],
    staleTime: 30000,
    enabled: activeTab === "estado" || activeTab === "ganancias",
  });

  // Query para cuentas RodMar (usado en Estado)
  const { data: cuentasRodMar = [] } = useQuery({
    queryKey: ["/api/rodmar-accounts"],
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: activeTab === "estado" || activeTab === "balances",
  });

  // Queries para balances (usado en Balances y Estado)
  const { data: minas = [] } = useQuery({
    queryKey: ["/api/minas"],
    staleTime: 30000,
    enabled: activeTab === "balances" || activeTab === "estado",
  });

  const { data: compradores = [] } = useQuery({
    queryKey: ["/api/compradores"],
    staleTime: 30000,
    enabled: activeTab === "balances" || activeTab === "estado",
  });

  const { data: viajesCompletos = [] } = useQuery({
    queryKey: ["/api/viajes"],
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: activeTab === "balances" || activeTab === "estado",
  });

  const { data: transaccionesCompletas = [] } = useQuery({
    queryKey: ["/api/transacciones"],
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: activeTab === "balances" || activeTab === "estado",
  });

  // Hooks para balances compartidos
  const { resumenFinanciero: resumenVolqueterosOriginal } = useVolqueterosBalance();
  const { resumenFinanciero: resumenCompradoresOriginal } = useCompradoresBalance();

  // ========== FUNCIONES DE CÁLCULO PARA PESTAÑAS BALANCES, ESTADO Y GANANCIAS ==========

  // Función para calcular balance neto de una mina (igual que en RodMar)
  const calcularBalanceNetoMina = (minaId: number): number => {
    if (!Array.isArray(viajesCompletos) || !Array.isArray(transaccionesCompletas)) {
      return 0;
    }

    const viajesCompletados = viajesCompletos.filter((v: any) => 
      v.fechaDescargue && v.minaId === minaId && v.estado === "completado" && !v.oculta
    );
    
    const transaccionesDinamicas = viajesCompletados.map((viaje: any) => {
      const totalCompra = parseFloat(viaje.totalCompra || "0");
      return {
        valor: totalCompra.toString(),
        isFromTrip: true
      };
    });

    const transaccionesManuales = transaccionesCompletas.filter((t: any) => {
      if (t.oculta) return false;
      if (t.tipo === "Viaje") return false;
      
      const tDeQuienId = parseInt(t.deQuienId) || 0;
      const tParaQuienId = parseInt(t.paraQuienId) || 0;
      
      return (t.deQuienTipo === "mina" && tDeQuienId === minaId) ||
             (t.paraQuienTipo === "mina" && tParaQuienId === minaId);
    });

    const ingresosViajes = transaccionesDinamicas.reduce((sum, t) => sum + parseFloat(t.valor), 0);
    
    const transaccionesNetas = transaccionesManuales.reduce((sum, t) => {
      const valor = parseFloat(t.valor || '0');
      const tDeQuienId = parseInt(t.deQuienId) || 0;
      const tParaQuienId = parseInt(t.paraQuienId) || 0;
      
      if (t.deQuienTipo === "mina" && tDeQuienId === minaId) {
        return sum + valor;
      } else if (t.paraQuienTipo === "mina" && tParaQuienId === minaId) {
        return sum - valor;
      } else if (t.paraQuienTipo === "rodmar" || t.paraQuienTipo === "banco") {
        return sum + valor;
      }
      return sum;
    }, 0);

    return ingresosViajes + transaccionesNetas;
  };

  // Calcular balance consolidado de minas (CON inversión de signos para perspectiva RodMar)
  const calcularBalanceMinas = () => {
    let totalPositivos = 0;
    let totalNegativos = 0;

    if (Array.isArray(minas)) {
      minas.forEach((mina: any) => {
        const balance = calcularBalanceNetoMina(mina.id);
        if (balance > 0) {
          totalNegativos += balance;
        } else {
          totalPositivos += Math.abs(balance);
        }
      });
    }

    return {
      positivos: totalPositivos,
      negativos: totalNegativos,
      balance: totalPositivos - totalNegativos
    };
  };

  // Calcular balance consolidado de compradores
  const calcularBalanceCompradores = () => {
    const balanceOriginal = resumenCompradoresOriginal;
    
    return {
      positivos: balanceOriginal.negativos,
      negativos: balanceOriginal.positivos,
      balance: -balanceOriginal.balance
    };
  };

  // Calcular balance consolidado de volqueteros
  const calcularBalanceVolqueteros = () => {
    const balanceOriginal = resumenVolqueterosOriginal;
    
    return {
      positivos: balanceOriginal.negativos,
      negativos: balanceOriginal.positivos,
      balance: -balanceOriginal.balance
    };
  };

  // Calcular balances
  const balanceMinas = calcularBalanceMinas();
  const balanceCompradores = calcularBalanceCompradores();
  const balanceVolqueteros = calcularBalanceVolqueteros();

  // Configuración para gráfico de barras (usado en Estado)
  const chartData = {
    labels: ['Ventas', 'Compras', 'Fletes', 'Ganancia'],
    datasets: [
      {
        data: [
          parseFloat(financialSummary?.totalVentas || '0'),
          parseFloat(financialSummary?.totalCompras || '0'),
          parseFloat(financialSummary?.totalFletes || '0'),
          parseFloat(financialSummary?.gananciaNeta || '0'),
        ],
        backgroundColor: [
          'hsl(142, 76%, 36%)',
          'hsl(0, 84%, 60%)',
          'hsl(32, 95%, 44%)',
          'hsl(207, 90%, 54%)',
        ],
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return new Intl.NumberFormat('es-CO', {
              style: 'currency',
              currency: 'COP',
              minimumFractionDigits: 0,
            }).format(value);
          },
        },
      },
    },
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[64px]">
      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full gap-1 sm:gap-0 p-1 grid-cols-4`}>
          <TabsTrigger value="transacciones" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
            Transacciones
          </TabsTrigger>
          {has("module.RODMAR.balances.view") && (
            <TabsTrigger value="balances" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
              Balances
            </TabsTrigger>
          )}
          {has("module.RODMAR.balances.view") && (
            <TabsTrigger value="estado" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
              Estado
            </TabsTrigger>
          )}
          {has("module.RODMAR.balances.view") && (
            <TabsTrigger value="ganancias" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
              Ganancias
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: Transacciones */}
        <TabsContent value="transacciones" className="mt-0">
          {/* Filters */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <h2 className="text-xs sm:text-sm font-medium text-foreground">Filtros</h2>
          <Button variant="ghost" size="sm" onClick={() => {
            setSearchTerm("");
            setValorFilterType("todos");
            setValorFilterValue("");
            setValorFilterValueEnd("");
            setSortByValor("ninguno");
            setSortByFecha("ninguno");
            setFechaFilterType("todos");
            setFechaFilterValue("");
            setFechaFilterValueEnd("");
          }} className="h-7 px-2 text-xs">
            Limpiar
          </Button>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          {/* Primera fila: Selects compactos siempre visibles - Sin labels en móvil */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {/* Filtro de valor - Select */}
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Valor</label>
              <Select value={valorFilterType} onValueChange={setValorFilterType}>
                <SelectTrigger className="h-7 sm:h-8 text-xs px-2">
                  <SelectValue placeholder="Valor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="igual-a">Igual a</SelectItem>
                  <SelectItem value="mayor-que">Mayor que</SelectItem>
                  <SelectItem value="menor-que">Menor que</SelectItem>
                  <SelectItem value="entre">Entre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de fecha - Select */}
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Fecha</label>
              <Select value={fechaFilterType} onValueChange={setFechaFilterType}>
                <SelectTrigger className="h-7 sm:h-8 text-xs px-2">
                  <SelectValue placeholder="Fecha" />
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

            {/* Búsqueda Global */}
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Búsqueda</label>
              <Input
                placeholder="Buscar..."
                className="h-7 sm:h-8 text-xs px-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Segunda fila: Inputs condicionales SOLO cuando requieren valores adicionales */}
          {((valorFilterType !== "todos" && (valorFilterType === "igual-a" || valorFilterType === "mayor-que" || valorFilterType === "menor-que" || valorFilterType === "entre")) ||
            (fechaFilterType !== "todos" && (fechaFilterType === "exactamente" || fechaFilterType === "entre" || fechaFilterType === "despues-de" || fechaFilterType === "antes-de"))) && (
            <div className="space-y-1.5 sm:space-y-2">
              {/* Inputs para filtro de valor - Solo si requiere input */}
              {valorFilterType !== "todos" && (valorFilterType === "igual-a" || valorFilterType === "mayor-que" || valorFilterType === "menor-que" || valorFilterType === "entre") && (
                <div>
                  {valorFilterType === "entre" ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Valor inicial</label>
                        <Input
                          type="text"
                          placeholder="Valor inicial"
                          className="h-7 sm:h-8 text-xs px-2"
                          value={valorFilterValue ? (() => {
                            const numVal = parseFloat(valorFilterValue);
                            return isNaN(numVal) ? valorFilterValue : formatCurrency(numVal);
                          })() : ''}
                          onChange={(e) => {
                            const rawValue = parseFormattedValue(e.target.value);
                            setValorFilterValue(rawValue);
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Valor final</label>
                        <Input
                          type="text"
                          placeholder="Valor final"
                          className="h-7 sm:h-8 text-xs px-2"
                          value={valorFilterValueEnd ? (() => {
                            const numVal = parseFloat(valorFilterValueEnd);
                            return isNaN(numVal) ? valorFilterValueEnd : formatCurrency(numVal);
                          })() : ''}
                          onChange={(e) => {
                            const rawValue = parseFormattedValue(e.target.value);
                            setValorFilterValueEnd(rawValue);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Valor</label>
                      <Input
                        type="text"
                        placeholder="Ingrese valor"
                        className="h-7 sm:h-8 text-xs px-2"
                        value={valorFilterValue ? (() => {
                          const numVal = parseFloat(valorFilterValue);
                          return isNaN(numVal) ? valorFilterValue : formatCurrency(numVal);
                        })() : ''}
                        onChange={(e) => {
                          const rawValue = parseFormattedValue(e.target.value);
                          setValorFilterValue(rawValue);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Inputs para filtro de fecha - Solo si requiere fecha específica */}
              {fechaFilterType !== "todos" && (fechaFilterType === "exactamente" || fechaFilterType === "entre" || fechaFilterType === "despues-de" || fechaFilterType === "antes-de") && (
                <div>
                  {fechaFilterType === "entre" ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Fecha inicial</label>
                        <Input
                          type="date"
                          className="h-7 sm:h-8 text-xs px-2"
                          value={fechaFilterValue}
                          onChange={(e) => setFechaFilterValue(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Fecha final</label>
                        <Input
                          type="date"
                          className="h-7 sm:h-8 text-xs px-2"
                          value={fechaFilterValueEnd}
                          onChange={(e) => setFechaFilterValueEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-0.5 hidden sm:block">Fecha</label>
                      <Input
                        type="date"
                        className="h-7 sm:h-8 text-xs px-2"
                        value={fechaFilterValue}
                        onChange={(e) => setFechaFilterValue(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tercera fila: Botones de ordenamiento compactos */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 pt-1">
            <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:inline">Orden:</span>
            
            {/* Botón ordenamiento por fecha */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSortFecha}
              className={`h-7 sm:h-8 px-1.5 sm:px-2 flex items-center space-x-0.5 sm:space-x-1 ${
                sortByFecha !== "ninguno" 
                  ? "bg-blue-100 hover:bg-blue-200 text-blue-700" 
                  : "text-gray-500"
              }`}
              title={
                sortByFecha === "ninguno" ? "Sin orden por fecha" :
                sortByFecha === "asc" ? "Más antiguo primero" : 
                "Más reciente primero"
              }
            >
              <CalendarDays className="w-3 h-3" />
              {sortByFecha === "ninguno" && <span className="text-[10px]">-</span>}
              {sortByFecha === "asc" && <ArrowUp className="w-3 h-3" />}
              {sortByFecha === "desc" && <ArrowDown className="w-3 h-3" />}
            </Button>

            {/* Botón ordenamiento por valor */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSortValor}
              className={`h-7 sm:h-8 px-1.5 sm:px-2 flex items-center space-x-0.5 sm:space-x-1 ${
                sortByValor !== "ninguno" 
                  ? "bg-green-100 hover:bg-green-200 text-green-700" 
                  : "text-gray-500"
              }`}
              title={
                sortByValor === "ninguno" ? "Sin orden por valor" :
                sortByValor === "asc" ? "Menor a mayor" : 
                "Mayor a menor"
              }
            >
              <DollarSign className="w-3 h-3" />
              {sortByValor === "ninguno" && <span className="text-[10px]">-</span>}
              {sortByValor === "asc" && <ArrowUp className="w-3 h-3" />}
              {sortByValor === "desc" && <ArrowDown className="w-3 h-3" />}
            </Button>
          </div>

        </div>
      </div>

      {/* Resumen Financiero - Compacto */}
      <div className="px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-base font-medium text-foreground">Transacciones</h2>
          <span className="text-xs sm:text-sm bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
            {pagination ? `${filteredAndSortedTransactions.length} de ${pagination.total}` : filteredAndSortedTransactions.length}
            {pagination && (searchTerm || fechaFilterType !== "todos" || valorFilterType !== "todos") && (
              <span className="text-xs text-muted-foreground ml-1.5">(filtradas)</span>
            )}
          </span>
        </div>
        
        {/* Balance General - Formato compacto con filtros clickeables */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div 
            className={`bg-green-50 dark:bg-green-950/20 rounded-lg p-1.5 border border-green-200 dark:border-green-800 cursor-pointer transition-all hover:shadow-md ${
              balanceFilter === 'positivos' ? 'ring-2 ring-green-400 shadow-md border-green-400 dark:ring-green-500' : ''
            }`}
            onClick={() => setBalanceFilter('positivos')}
          >
            <div className="text-muted-foreground text-[10px] mb-0.5 leading-tight">Positivos</div>
            <div className="text-green-600 dark:text-green-400 font-semibold break-words leading-tight text-xs sm:text-sm">
              ${formatCurrency(balanceCalculations.positivos.toString()).replace('$', '')}
            </div>
          </div>
          <div 
            className={`bg-red-50 dark:bg-red-950/20 rounded-lg p-1.5 border border-red-200 dark:border-red-800 cursor-pointer transition-all hover:shadow-md ${
              balanceFilter === 'negativos' ? 'ring-2 ring-red-400 shadow-md border-red-400 dark:ring-red-500' : ''
            }`}
            onClick={() => setBalanceFilter('negativos')}
          >
            <div className="text-muted-foreground text-[10px] mb-0.5 leading-tight">Negativos</div>
            <div className="text-red-600 dark:text-red-400 font-semibold break-words leading-tight text-xs sm:text-sm">
              ${formatCurrency(balanceCalculations.negativos.toString()).replace('$', '')}
            </div>
          </div>
          <div 
            className={`rounded-lg p-1.5 border cursor-pointer transition-all hover:shadow-md ${
              balanceCalculations.balance >= 0
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            } ${
              balanceFilter === 'all' 
                ? balanceCalculations.balance >= 0
                  ? 'ring-2 ring-green-400 shadow-md border-green-400 dark:ring-green-500'
                  : 'ring-2 ring-red-400 shadow-md border-red-400 dark:ring-red-500'
                : ''
            }`}
            onClick={() => setBalanceFilter('all')}
          >
            <div className="text-muted-foreground text-[10px] mb-0.5 leading-tight">Balance</div>
            <div className={`font-semibold break-words leading-tight text-xs sm:text-sm ${
              balanceCalculations.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}>
              {balanceCalculations.balance >= 0 ? "" : "-"}${formatCurrency(Math.abs(balanceCalculations.balance).toString()).replace('$', '')}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {isMultiSelectMode && selectedTransactions.size > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedTransactions.size} seleccionadas
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isMultiSelectMode && selectedTransactions.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteClick}
                className="h-8 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar ({selectedTransactions.size})
              </Button>
            )}
            <Button
              variant={isMultiSelectMode ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedTransactions(new Set());
              }}
              className="h-8 text-xs"
            >
              {isMultiSelectMode ? "Cancelar" : "Seleccionar"}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredAndSortedTransactions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No se encontraron transacciones</p>
              <Button onClick={() => setShowAddTransaction(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Transacción
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Header de selección múltiple */}
            {isMultiSelectMode && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="h-8 w-8 p-0"
                      >
                        {selectedTransactions.size === filteredAndSortedTransactions.length && filteredAndSortedTransactions.length > 0 ? 
                          <CheckSquare className="h-4 w-4" /> : 
                          <Square className="h-4 w-4" />
                        }
                      </Button>
                      <span className="text-sm font-medium">
                        {selectedTransactions.size} de {filteredAndSortedTransactions.length} seleccionadas
                      </span>
                    </div>
                    {selectedTransactions.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDeleteClick}
                        className="h-8"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar ({selectedTransactions.size})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de transacciones en formato de tarjetas */}
            {filteredAndSortedTransactions.map((transaction) => (
              <Card 
                key={transaction.id} 
                className={`hover:shadow-sm transition-shadow cursor-pointer ${
                  transaction.estado === 'pendiente'
                    ? 'bg-orange-50 border-2 border-orange-300 hover:bg-orange-100'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleTransactionDetailClick(transaction)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between min-w-0">
                    <div className="flex items-start gap-3 flex-1 min-w-0 overflow-hidden">
                      {/* Checkbox de selección múltiple */}
                      {isMultiSelectMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTransactionSelection(transaction.id);
                          }}
                          className="h-6 w-6 p-0 mt-1 shrink-0"
                        >
                          {selectedTransactions.has(transaction.id) ? 
                            <CheckSquare className="h-4 w-4" /> : 
                            <Square className="h-4 w-4" />
                          }
                        </Button>
                      )}

                      <div className="flex-1 min-w-0 overflow-hidden">
                        {/* Header compacto */}
                        <div className="flex items-center gap-2 mb-1 min-w-0 max-w-full">
                          <Badge variant="outline" className="text-xs px-1 py-0 h-5 shrink-0 flex-shrink-0">
                            {transaction.deQuienTipo === 'mina' ? 'Mina' : 
                             transaction.deQuienTipo === 'comprador' ? 'Comprador' : 
                             transaction.deQuienTipo === 'volquetero' ? 'Volquetero' : 
                             transaction.deQuienTipo === 'rodmar' ? 'RodMar' : 'Banco'}
                          </Badge>
                          <span className="text-sm font-medium text-foreground truncate min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {cleanSocioNombre(transaction.socioNombre || transaction.concepto)}
                          </span>
                        </div>
                        
                        {/* Concepto */}
                        <p className="text-sm text-muted-foreground mb-1 line-clamp-1">
                          {highlightText(cleanConcepto(transaction.concepto), searchTerm)}
                        </p>
                        {/* Comentario si existe */}
                        {transaction.comentario && (
                          <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                            {highlightText(transaction.comentario, searchTerm)}
                          </p>
                        )}
                        
                        {/* Información inferior compacta */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{(() => {
                            // Formateo simple de fecha para evitar problemas UTC
                            const fecha = transaction.fecha;
                            const fechaString = String(fecha);
                            if (fecha instanceof Date) {
                              // Si es Date, extraer componentes locales
                              const day = String(fecha.getDate()).padStart(2, '0');
                              const month = String(fecha.getMonth() + 1).padStart(2, '0');
                              const year = String(fecha.getFullYear()).slice(-2);
                              return `${day}/${month}/${year}`;
                            } else if (typeof fecha === 'string') {
                              // Si es string, extraer solo fecha (YYYY-MM-DD)
                              const dateStr = fechaString.includes('T') ? fechaString.split('T')[0] : fechaString;
                              const [year, month, day] = dateStr.split('-');
                              return `${day}/${month}/${year?.slice(-2) || ''}`;
                            }
                            return 'Fecha inválida';
                          })()}</span>
                          <span>•</span>
                          <span className="truncate">{transaction.formaPago}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Valor y Acciones */}
                    <div className="flex flex-col items-end ml-3 shrink-0 gap-1">
                      <div className={`text-base font-semibold ${(() => {
                        // Transacciones pendientes = azul claro (no afectan balances)
                        if (transaction.estado === 'pendiente') {
                          return 'text-blue-400'; // Azul claro para pendientes
                        }
                        
                        // NUEVAS REGLAS DE CODIFICACIÓN DE COLORES:
                        // 1. Transacciones desde mina/comprador/volquetero = Verde y positivo  
                        // 2. Transacciones RodMar a RodMar = Azul y no afecta balance
                        
                        const isFromPartner = transaction.deQuienTipo === 'mina' || 
                                             transaction.deQuienTipo === 'comprador' || 
                                             transaction.deQuienTipo === 'volquetero';
                        
                        const isRodMarToRodMar = transaction.deQuienTipo === 'rodmar' && transaction.paraQuienTipo === 'rodmar';
                        
                        if (isFromPartner) {
                          return 'text-green-600'; // VERDE para origen desde socios
                        } else if (isRodMarToRodMar) {
                          return 'text-blue-600'; // AZUL para RodMar a RodMar
                        } else {
                          // Lógica anterior para otros casos
                          const isToPartner = transaction.paraQuienTipo === 'mina' || 
                                            transaction.paraQuienTipo === 'comprador' || 
                                            transaction.paraQuienTipo === 'volquetero';
                          const isToBanco = transaction.paraQuienTipo === 'banco';
                          const isToRodMar = transaction.paraQuienTipo === 'rodmar';
                          
                          if (isToPartner || isToBanco) {
                            return 'text-red-600'; // ROJO para destino socios o banco
                          } else if (isToRodMar) {
                            return 'text-green-600'; // VERDE para destino RodMar
                          } else {
                            return 'text-gray-600';
                          }
                        }
                      })()}`}>
                        {(() => {
                          // NUEVAS REGLAS DE VISUALIZACIÓN DE VALORES:
                          // 1. Transacciones desde mina/comprador/volquetero = positivo  
                          // 2. Transacciones RodMar a RodMar = positivo (sin signo especial)
                          
                          const isFromPartner = transaction.deQuienTipo === 'mina' || 
                                               transaction.deQuienTipo === 'comprador' || 
                                               transaction.deQuienTipo === 'volquetero';
                          
                          const isRodMarToRodMar = transaction.deQuienTipo === 'rodmar' && transaction.paraQuienTipo === 'rodmar';
                          
                          let displayValue = parseFloat(transaction.valor);
                          
                          if (isFromPartner) {
                            displayValue = Math.abs(displayValue); // Positivo para origen desde socios
                          } else if (isRodMarToRodMar) {
                            displayValue = Math.abs(displayValue); // Positivo (neutro) para RodMar a RodMar
                          } else {
                            // Lógica anterior para otros casos
                            const isToPartner = transaction.paraQuienTipo === 'mina' || 
                                              transaction.paraQuienTipo === 'comprador' || 
                                              transaction.paraQuienTipo === 'volquetero';
                            
                            if (isToPartner) {
                              displayValue = -Math.abs(displayValue); // Negativo para destino socios
                            } else {
                              displayValue = Math.abs(displayValue); // Positivo para destino RodMar/Banco
                            }
                          }
                          
                          const valorText = formatCurrency(displayValue.toString());
                          return highlightValue(valorText, searchTerm);
                        })()}
                      </div>
                      
                      {/* Botones de acciones */}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTransaction(transaction);
                          }}
                          title="Editar transacción"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTransaction(transaction);
                          }}
                          title="Eliminar transacción"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Comentario si existe */}
                  {transaction.comentario && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-2 line-clamp-2">
                      {transaction.comentario}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Controles de paginación */}
        {pagination && (
          <PaginationControls
            page={currentPage}
            limit={pageSize}
            total={pageSize === "todo" ? transactions.length : pagination.total} // Si es "todo", usar total de transacciones filtradas
            totalPages={pageSize === "todo" ? 1 : pagination.totalPages} // Si es "todo", solo hay 1 página
            hasMore={pageSize === "todo" ? false : pagination.hasMore} // Si es "todo", no hay más páginas
            onPageChange={setCurrentPage}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit);
              if (newLimit === "todo") {
                setCurrentPage(1); // Resetear a página 1 cuando se selecciona "todo"
              }
            }}
            limitOptions={[10, 20, 50, 100, 200, 500, 1000]}
          />
        )}

      </div>

      <TransactionModal 
        open={showAddTransaction} 
        onClose={() => setShowAddTransaction(false)}
      />
      
      <EditTransactionModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />
      
      <DeleteTransactionModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
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

      {/* Modal de detalle de transacción */}
      <TransactionDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        transaction={selectedTransaction}
        relatedTrip={(() => {
          // Solo para transacciones automáticas de viajes (tipoTransaccion: "Viaje"), no para transacciones manuales
          if (selectedTransaction?.tipoTransaccion === "Viaje" && selectedTransaction?.concepto) {
            const viajeId = selectedTransaction.concepto.match(/Viaje\s+([A-Z]\d+)/i)?.[1];
            if (viajeId) {
              return viajes.find(v => v.id === viajeId);
            }
          }
          return null;
        })()}
      />

      {/* Modal de confirmación para eliminación masiva */}
      <AlertDialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar transacciones seleccionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente {selectedTransactions.size} transacciones seleccionadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar {selectedTransactions.size} transacciones
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

          {/* Navegación inferior fija - solo si no se renderiza desde dashboard */}
          {!hideBottomNav && <BottomNavigation />}
        </TabsContent>

        {/* Tab: Balances */}
        {has("module.RODMAR.balances.view") && (
          <TabsContent value="balances" className="mt-6 px-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-foreground">Balances Consolidados</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Balance de Minas */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                        Minas
                      </h4>
                      <Badge variant="outline" className="text-xs text-green-700">
                        {balanceMinas.balance >= 0 ? 'Positivo' : 'Negativo'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-green-600 font-medium">+${balanceMinas.positivos.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-600 font-medium">-${balanceMinas.negativos.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${
                          balanceMinas.balance > 0 ? 'text-green-600' : 
                          balanceMinas.balance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          ${balanceMinas.balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Balance de Compradores */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                        Compradores
                      </h4>
                      <Badge variant="outline" className="text-xs text-blue-700">
                        {balanceCompradores.balance >= 0 ? 'Positivo' : 'Negativo'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-green-600 font-medium">+${balanceCompradores.positivos.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-600 font-medium">-${balanceCompradores.negativos.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${
                          balanceCompradores.balance > 0 ? 'text-green-600' : 
                          balanceCompradores.balance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          ${balanceCompradores.balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Balance de Volqueteros */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                        Volqueteros
                      </h4>
                      <Badge variant="outline" className="text-xs text-yellow-700">
                        {balanceVolqueteros.balance >= 0 ? 'Positivo' : 'Negativo'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-green-600 font-medium">+${balanceVolqueteros.positivos.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-600 font-medium">-${balanceVolqueteros.negativos.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${
                          balanceVolqueteros.balance > 0 ? 'text-green-600' : 
                          balanceVolqueteros.balance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          ${balanceVolqueteros.balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {/* Tab: Estado */}
        {has("module.RODMAR.balances.view") && (
          <TabsContent value="estado" className="mt-6 px-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-foreground">Estado Financiero General</h3>
              </div>
              
              {/* Balance Consolidado */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    Balance Financiero Consolidado
                    <Badge variant="secondary" className="text-xs">
                      General
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="bg-green-50 p-2 rounded text-center">
                      <p className="text-xs text-green-700">Cuentas RodMar</p>
                      <p className="text-sm font-bold text-green-700">
                        {formatCurrency(cuentasRodMar.reduce((total: number, cuenta: any) => total + cuenta.balance, 0))}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <p className="text-xs text-blue-700">Socios</p>
                      <p className="text-sm font-bold text-blue-700">
                        {formatCurrency(balanceMinas.balance + balanceCompradores.balance + balanceVolqueteros.balance)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-2 rounded text-center">
                      <p className="text-xs text-purple-700">Balance Total</p>
                      <p className="text-sm font-bold text-purple-700">
                        {formatCurrency(cuentasRodMar.reduce((total: number, cuenta: any) => total + cuenta.balance, 0) + balanceMinas.balance + balanceCompradores.balance + balanceVolqueteros.balance)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <p className="text-xs text-gray-700">Cuentas</p>
                      <p className="text-sm font-bold text-gray-700">
                        {cuentasRodMar.length} activas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas Financieras */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Resumen de Operaciones
                    <Badge variant="outline" className="text-xs">
                      Totales
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-green-50 p-2 rounded text-center">
                      <p className="text-xs text-green-700">Ventas</p>
                      <p className="text-sm font-bold text-green-700">
                        ${parseFloat(financialSummary?.totalVentas || '0').toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-red-50 p-2 rounded text-center">
                      <p className="text-xs text-red-700">Compras</p>
                      <p className="text-sm font-bold text-red-700">
                        ${parseFloat(financialSummary?.totalCompras || '0').toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded text-center">
                      <p className="text-xs text-yellow-700">Fletes</p>
                      <p className="text-sm font-bold text-yellow-700">
                        ${parseFloat(financialSummary?.totalFletes || '0').toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <p className="text-xs text-blue-700">Ganancia</p>
                      <p className="text-sm font-bold text-blue-700">
                        ${parseFloat(financialSummary?.gananciaNeta || '0').toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico de Barras */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Análisis Visual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Bar data={chartData} options={chartOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Tab: Ganancias */}
        {has("module.RODMAR.balances.view") && (
          <TabsContent value="ganancias" className="mt-6 px-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-foreground">Análisis de Ganancias</h3>
              </div>

              {/* Resumen de Ganancias */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumen de Ganancias Netas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="bg-green-50 p-2 rounded text-center">
                      <p className="text-xs text-green-700">Ventas</p>
                      <p className="text-sm font-bold text-green-700">
                        ${parseFloat(financialSummary?.totalVentas || '0').toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-red-50 p-2 rounded text-center">
                      <p className="text-xs text-red-700">Gastos</p>
                      <p className="text-sm font-bold text-red-700">
                        ${(parseFloat(financialSummary?.totalCompras || '0') + parseFloat(financialSummary?.totalFletes || '0')).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <p className="text-xs text-blue-700">Ganancia</p>
                      <p className="text-sm font-bold text-blue-700">
                        ${parseFloat(financialSummary?.gananciaNeta || '0').toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded text-center">
                      <p className="text-xs text-yellow-700">Margen</p>
                      <p className="text-sm font-bold text-yellow-700">
                        {financialSummary?.totalVentas ? 
                          ((parseFloat(financialSummary.gananciaNeta || '0') / parseFloat(financialSummary.totalVentas)) * 100).toFixed(1) 
                          : '0.0'}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Desglose de Componentes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Desglose de Componentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 px-2 bg-green-50 rounded">
                      <span className="text-sm text-green-700">Total Ventas</span>
                      <span className="text-sm font-bold text-green-700">
                        ${parseFloat(financialSummary?.totalVentas || '0').toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2 bg-red-50 rounded">
                      <span className="text-sm text-red-700">Total Compras</span>
                      <span className="text-sm font-bold text-red-700">
                        -${parseFloat(financialSummary?.totalCompras || '0').toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2 bg-yellow-50 rounded">
                      <span className="text-sm text-yellow-700">Total Fletes</span>
                      <span className="text-sm font-bold text-yellow-700">
                        -${parseFloat(financialSummary?.totalFletes || '0').toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2 bg-blue-50 rounded border-2 border-blue-200">
                      <span className="text-sm text-blue-700 font-medium">Ganancia Neta</span>
                      <span className="text-sm font-bold text-blue-700">
                        ${parseFloat(financialSummary?.gananciaNeta || '0').toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Navegación inferior fija - solo si no se renderiza desde dashboard */}
      {!hideBottomNav && <BottomNavigation />}
    </div>
  );
}
