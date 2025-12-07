import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeftRight, Plus, Download, Filter, Edit, Trash2, CheckSquare, Square, CalendarDays, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
// Formateo de fechas se maneja directamente en el componente
import { formatDate } from "@/lib/utils";
import TransactionModal from "@/components/forms/transaction-modal";
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
import BottomNavigation from "@/components/layout/bottom-navigation";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/usePagination";
import { apiUrl } from "@/lib/api";

import type { TransaccionWithSocio } from "@shared/schema";

interface TransaccionesProps {
  onOpenTransaction?: () => void;
  hideBottomNav?: boolean; // Para ocultar navegación cuando se renderiza desde dashboard
}

export default function Transacciones({ onOpenTransaction, hideBottomNav = false }: TransaccionesProps = {}) {
  console.log('🎯 COMPONENTE TRANSACCIONES (PAGES) - Iniciando render');
  
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
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
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
      const response = await fetch(apiUrl('/api/transacciones/bulk-delete'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Helper function to get date ranges for filtering (retorna strings ISO para el servidor)
  const getDateRange = (type: string, fechaEspecifica?: string, fechaInicio?: string, fechaFin?: string): { start: string; end: string } | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const formatDate = (date: Date): string => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    switch (type) {
      case "hoy":
        return { start: formatDate(today), end: formatDate(today) };
      case "ayer":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: formatDate(yesterday), end: formatDate(yesterday) };
      case "esta-semana":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { start: formatDate(startOfWeek), end: formatDate(today) };
      case "semana-pasada":
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return { start: formatDate(startOfLastWeek), end: formatDate(endOfLastWeek) };
      case "este-mes":
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatDate(startOfMonth), end: formatDate(today) };
      case "mes-pasado":
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) };
      case "este-año":
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        return { start: formatDate(startOfYear), end: formatDate(today) };
      case "año-pasado":
        const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
        return { start: formatDate(startOfLastYear), end: formatDate(endOfLastYear) };
      case "exactamente":
        return fechaEspecifica ? { start: fechaEspecifica, end: fechaEspecifica } : null;
      case "entre":
        return fechaInicio && fechaFin ? { start: fechaInicio, end: fechaFin } : null;
      case "despues-de":
        return fechaEspecifica ? { start: fechaEspecifica, end: "9999-12-31" } : null;
      case "antes-de":
        return fechaEspecifica ? { start: "1900-01-01", end: fechaEspecifica } : null;
      default:
        return null;
    }
  };

  // Calcular fechaDesde y fechaHasta para enviar al servidor
  const dateRange = useMemo(() => {
    return getDateRange(fechaFilterType, fechaFilterValue, fechaFilterValue, fechaFilterValueEnd);
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
      
      const response = await fetch(apiUrl(`/api/transacciones?${params.toString()}`));
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

    // Filtro de búsqueda (texto)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        const concepto = cleanConcepto(t.concepto || '').toLowerCase();
        const socioNombre = cleanSocioNombre(t.socioNombre || '').toLowerCase();
        const deQuien = (t.deQuien || '').toLowerCase();
        const paraQuien = (t.paraQuien || '').toLowerCase();
        return concepto.includes(searchLower) || 
               socioNombre.includes(searchLower) ||
               deQuien.includes(searchLower) ||
               paraQuien.includes(searchLower);
      });
    }

    // Filtro de fecha
    if (dateRange) {
      filtered = filtered.filter(t => {
        const fechaTrans = new Date(t.fecha);
        const fechaInicio = new Date(dateRange.start);
        const fechaFin = new Date(dateRange.end);
        return fechaTrans >= fechaInicio && fechaTrans <= fechaFin;
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
  }, [allTransactions, searchTerm, dateRange, valorFilterType, valorFilterValue, valorFilterValueEnd, sortByFecha, sortByValor]);

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
              const response = await fetch(apiUrl(`/api/transacciones?${params.toString()}`));
              if (!response.ok) throw new Error('Error al obtener transacciones');
              return response.json();
            },
            staleTime: 300000,
          });
        }
      }, 100); // Pequeño delay para no bloquear la UI inicial
    }
  }, [pagination, currentPage, pageSize, queryClient, getLimitForServer]);
  
  console.log('🏦 TRANSACCIONES (PAGES) - Total recibidas:', transactions.length);
  if (transactions.length > 0) {
    console.log('📅 PRIMERA TRANSACCIÓN - Fecha raw:', transactions[0].fecha);
    console.log('📅 PRIMERA TRANSACCIÓN - Tipo fecha:', typeof transactions[0].fecha);
  }

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

    filteredAndSortedTransactions.forEach((t) => {
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
      {/* Filters */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-foreground">Filtros</h2>
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
          }}>
            Limpiar
          </Button>
        </div>

        <div className="space-y-2">
          {/* Primera fila: Filtros principales - Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Filtro de valor */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Filtrar por Valor</label>
              <div className="flex gap-1 flex-wrap">
                <Select value={valorFilterType} onValueChange={setValorFilterType}>
                  <SelectTrigger className="h-8 text-xs min-w-[100px] flex-shrink-0">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="exactamente">Exacto</SelectItem>
                    <SelectItem value="mayor">Mayor</SelectItem>
                    <SelectItem value="menor">Menor</SelectItem>
                    <SelectItem value="entre">Entre</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="text"
                  placeholder="Valor"
                  className="h-8 text-xs flex-1 min-w-[80px]"
                  value={valorFilterValue ? formatCurrency(parseFloat(valorFilterValue)) : ''}
                  onChange={(e) => setValorFilterValue(parseFormattedValue(e.target.value))}
                  disabled={!valorFilterType || valorFilterType === "todos"}
                />

                {valorFilterType === "entre" && (
                  <Input
                    type="text"
                    placeholder="Final"
                    className="h-8 text-xs flex-1 min-w-[80px]"
                    value={valorFilterValueEnd ? formatCurrency(parseFloat(valorFilterValueEnd)) : ''}
                    onChange={(e) => setValorFilterValueEnd(parseFormattedValue(e.target.value))}
                  />
                )}
              </div>
            </div>

            {/* Búsqueda */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Búsqueda Global</label>
              <Input
                placeholder="Nombre, concepto, voucher..."
                className="h-8 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Segunda fila: Filtro de fecha y botones de ordenamiento - Responsive */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
            {/* Filtro de fecha */}
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-600 mb-1 block">Filtrar por Fecha</label>
              <div className="flex gap-1 flex-wrap">
                <Select value={fechaFilterType} onValueChange={setFechaFilterType}>
                  <SelectTrigger className="h-8 text-xs min-w-[120px] flex-shrink-0">
                    <SelectValue placeholder="Período" />
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

                {(fechaFilterType === "exactamente" || fechaFilterType === "despues-de" || fechaFilterType === "antes-de") && (
                  <Input
                    type="date"
                    className="h-8 text-xs flex-1 min-w-[120px]"
                    value={fechaFilterValue}
                    onChange={(e) => setFechaFilterValue(e.target.value)}
                  />
                )}

                {fechaFilterType === "entre" && (
                  <>
                    <Input
                      type="date"
                      placeholder="Desde"
                      className="h-8 text-xs flex-1 min-w-[120px]"
                      value={fechaFilterValue}
                      onChange={(e) => setFechaFilterValue(e.target.value)}
                    />
                    <Input
                      type="date"
                      placeholder="Hasta"
                      className="h-8 text-xs flex-1 min-w-[120px]"
                      value={fechaFilterValueEnd}
                      onChange={(e) => setFechaFilterValueEnd(e.target.value)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Botones de ordenamiento compactos - Apilados en móviles */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              <span className="text-xs text-gray-600 hidden sm:inline">Orden:</span>
              
              {/* Botón ordenamiento por fecha */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSortFecha}
                className={`h-8 px-2 flex items-center space-x-1 ${
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
                {sortByFecha === "ninguno" && <span className="text-xs">-</span>}
                {sortByFecha === "asc" && <ArrowUp className="w-3 h-3" />}
                {sortByFecha === "desc" && <ArrowDown className="w-3 h-3" />}
              </Button>

              {/* Botón ordenamiento por valor */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSortValor}
                className={`h-8 px-2 flex items-center space-x-1 ${
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
                {sortByValor === "ninguno" && <span className="text-xs">-</span>}
                {sortByValor === "asc" && <ArrowUp className="w-3 h-3" />}
                {sortByValor === "desc" && <ArrowDown className="w-3 h-3" />}
              </Button>
            </div>
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
        
        {/* Balance General - Formato compacto */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-1.5 border border-green-200 dark:border-green-800">
            <div className="text-muted-foreground text-[10px] mb-0.5 leading-tight">Positivos</div>
            <div className="text-green-600 dark:text-green-400 font-semibold break-words leading-tight text-xs sm:text-sm">
              ${formatCurrency(balanceCalculations.positivos.toString()).replace('$', '')}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-1.5 border border-red-200 dark:border-red-800">
            <div className="text-muted-foreground text-[10px] mb-0.5 leading-tight">Negativos</div>
            <div className="text-red-600 dark:text-red-400 font-semibold break-words leading-tight text-xs sm:text-sm">
              ${formatCurrency(balanceCalculations.negativos.toString()).replace('$', '')}
            </div>
          </div>
          <div className={`rounded-lg p-1.5 border ${
            balanceCalculations.balance >= 0
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}>
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
                          {cleanConcepto(transaction.concepto)}
                        </p>
                        
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
                          
                          return formatCurrency(displayValue.toString());
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
    </div>
  );
}
