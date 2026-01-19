import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/usePagination";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { getAuthToken } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useHiddenTransactions } from "@/hooks/useHiddenTransactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, highlightText } from "@/lib/utils";
import { calculateTerceroBalance } from "@/lib/calculations";
import { ArrowLeft, X, Image, Plus, Edit, Search, Trash2, Eye, Percent, CalendarClock } from "lucide-react";
import { TransaccionWithSocio } from "@shared/schema";
import { getDateRangeFromFilter, filterTransactionsByDateRange } from "@/lib/date-filter-utils";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { GestionarTransaccionesModal } from "@/components/modals/gestionar-transacciones-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { PendingListModal } from "@/components/pending-transactions/pending-list-modal";
import { TerceroTransaccionesImageModal } from "@/components/modals/tercero-transacciones-image-modal";

// Estado para filtros
interface TransaccionFiltrosState {
  fechaTipo: string;
  fechaEspecifica: string;
  fechaInicio: string;
  fechaFin: string;
}

const FILTROS_FECHA = [
  { value: "todos", label: "Todos" },
  { value: "exactamente", label: "Exactamente" },
  { value: "entre", label: "Entre" },
  { value: "despues-de", label: "Después de" },
  { value: "antes-de", label: "Antes de" },
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "esta-semana", label: "Esta semana" },
  { value: "semana-pasada", label: "Semana pasada" },
  { value: "este-mes", label: "Este mes" },
  { value: "mes-pasado", label: "Mes pasado" },
  { value: "este-año", label: "Este año" },
  { value: "año-pasado", label: "Año pasado" },
];

// Usar función centralizada de date-filter-utils (ya no necesitamos date-fns)

export default function TerceroDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const terceroId = parseInt(params?.id || "0");
  const { has } = usePermissions();
  
  // Estados para filtros
  const [filtros, setFiltros] = useState<TransaccionFiltrosState>({
    fechaTipo: "todos",
    fechaEspecifica: "",
    fechaInicio: "",
    fechaFin: "",
  });

  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');

  // Estado para modal de detalles de transacciones
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Estado para modal de imagen de transacciones
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Estados para transacciones temporales
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<TransaccionWithSocio[]>([]);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Estados para editar y eliminar transacciones manuales
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [showDeleteTransaction, setShowDeleteTransaction] = useState(false);

  // Préstamos (MVP)
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [loanRatePercent, setLoanRatePercent] = useState("5");
  const [loanDayOfMonth, setLoanDayOfMonth] = useState("1");
  const [loanDirection, setLoanDirection] = useState<"pay" | "receive">("pay");
  const [loanPrincipalTransactionId, setLoanPrincipalTransactionId] = useState("");
  const [loanNotes, setLoanNotes] = useState("");

  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [showLoanHistory, setShowLoanHistory] = useState(false);

  const [showApplyPayment, setShowApplyPayment] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState("");
  const [applyInterestValue, setApplyInterestValue] = useState("");
  const [applyPrincipalValue, setApplyPrincipalValue] = useState("");

  // Paginación con memoria en localStorage
  const { currentPage, setCurrentPage, pageSize, setPageSize, getLimitForServer } = usePagination({
    storageKey: `tercero-${terceroId}-pageSize`,
    defaultPageSize: 50,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook para manejar transacciones ocultas de forma local y temporal
  const {
    hiddenTransactions,
    hideTransaction: hideTransactionLocal,
    showAllHidden: showAllHiddenLocal,
    getHiddenCount: getHiddenTransactionsCount,
  } = useHiddenTransactions(`tercero-${terceroId}`);

  // Obtener tercero
  const { data: terceros = [] } = useQuery({
    queryKey: ["/api/terceros"],
  });

  const tercero = (terceros as any[]).find((t: any) => t.id === terceroId);

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: [`/api/terceros/${terceroId}/loans`],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(apiUrl(`/api/terceros/${terceroId}/loans`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Error al cargar préstamos");
      return response.json();
    },
    enabled: terceroId > 0,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: loanHistory } = useQuery({
    queryKey: [`/api/terceros/${terceroId}/loans/${selectedLoan?.id}/history`],
    queryFn: async () => {
      if (!selectedLoan?.id) return null;
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(apiUrl(`/api/terceros/${terceroId}/loans/${selectedLoan.id}/history`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Error al cargar historial del préstamo");
      return response.json();
    },
    enabled: !!selectedLoan?.id && showLoanHistory,
  });

  const createLoanMutation = useMutation({
    mutationFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(apiUrl(`/api/terceros/${terceroId}/loans`), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          name: loanName.trim(),
          principalTransactionId: Number(loanPrincipalTransactionId),
          ratePercent: Number(loanRatePercent),
          dayOfMonth: Number(loanDayOfMonth),
          direction: loanDirection,
          notes: loanNotes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo crear el préstamo");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/terceros/${terceroId}/loans`] });
      setShowLoanModal(false);
      setLoanName("");
      setLoanRatePercent("5");
      setLoanDayOfMonth("1");
      setLoanDirection("pay");
      setLoanPrincipalTransactionId("");
      setLoanNotes("");
      toast({ title: "Préstamo creado", description: "Se creó el préstamo correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateInterestMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(apiUrl(`/api/terceros/${terceroId}/loans/${loanId}/generate-interest`), {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo generar interés");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/terceros/${terceroId}/loans`] });
      if (selectedLoan?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/terceros/${terceroId}/loans/${selectedLoan.id}/history`] });
      }
      toast({ title: "Interés generado", description: "Se creó la transacción de interés" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const applyPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLoan?.id) throw new Error("Selecciona un préstamo");
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(apiUrl(`/api/terceros/${terceroId}/loans/${selectedLoan.id}/apply-payment`), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          paymentTransactionId: Number(paymentTransactionId),
          appliedInterest: applyInterestValue ? Number(applyInterestValue) : undefined,
          appliedPrincipal: applyPrincipalValue ? Number(applyPrincipalValue) : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo aplicar el pago");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/terceros/${terceroId}/loans`] });
      if (selectedLoan?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/terceros/${terceroId}/loans/${selectedLoan.id}/history`] });
      }
      setShowApplyPayment(false);
      setPaymentTransactionId("");
      setApplyInterestValue("");
      setApplyPrincipalValue("");
      toast({ title: "Pago aplicado", description: "El pago se aplicó al préstamo" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Función para ocultar transacciones localmente (sin llamar a la API)
  const handleHideTransaction = (transactionId: number) => {
    hideTransactionLocal(transactionId);
    toast({
      title: "Transacción ocultada",
      description: "La transacción se ha ocultado correctamente"
    });
  };

  // Función para mostrar todas las transacciones ocultas localmente
  const handleShowAllHidden = () => {
    showAllHiddenLocal();
    toast({
      description: "Todas las transacciones ocultas ahora son visibles",
      duration: 2000,
    });
  };

  // Calcular fechaDesde y fechaHasta usando función centralizada (ya devuelve strings YYYY-MM-DD)
  const dateRange = useMemo(() => {
    if (filtros.fechaTipo === "entre") {
      // Para "entre", usar fechaInicio (inicio) y fechaFin (fin)
      return getDateRangeFromFilter(
        filtros.fechaTipo as any,
        filtros.fechaInicio || undefined,
        filtros.fechaFin || undefined
      );
    } else {
      // Para otros tipos, usar fechaEspecifica
      return getDateRangeFromFilter(
        filtros.fechaTipo as any,
        filtros.fechaEspecifica || undefined,
        undefined
      );
    }
  }, [filtros.fechaTipo, filtros.fechaEspecifica, filtros.fechaInicio, filtros.fechaFin]);

  // Obtener transacciones de este tercero
  const { 
    data: transaccionesData = [],
    isLoading: isLoadingTransactions
  } = useQuery<any[]>({
    queryKey: [`/api/terceros/${terceroId}/transacciones`],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/terceros/${terceroId}/transacciones`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    enabled: terceroId > 0,
    staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const allTransaccionesReales = transaccionesData || [];
  const terceroIdStr = terceroId.toString();

  const transaccionesPrestamo = useMemo(() => {
    return allTransaccionesReales.filter((t: any) => typeof t.id === "number");
  }, [allTransaccionesReales]);

  const transaccionesPago = useMemo(() => {
    return allTransaccionesReales.filter((t: any) =>
      t.paraQuienTipo === "tercero" && t.paraQuienId === terceroIdStr
    );
  }, [allTransaccionesReales, terceroIdStr]);
  // Contar transacciones ocultas localmente (solo visual)
  const hiddenTerceroCount = getHiddenTransactionsCount();

  // Filtrado client-side
  const transaccionesReales = useMemo(() => {
    let filtered = [...allTransaccionesReales];

    // Filtro de búsqueda (texto) - buscar en concepto, comentario y monto (valor)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const searchNumeric = searchTerm.replace(/[^\d]/g, ''); // Solo números para búsqueda en valor
      filtered = filtered.filter(t => {
        const concepto = (t.concepto || '').toLowerCase();
        const comentario = (t.comentario || '').toLowerCase();
        const valor = String(t.valor || '').replace(/[^\d]/g, ''); // Solo números del valor
        const deQuien = (t.deQuien || '').toLowerCase();
        const paraQuien = (t.paraQuien || '').toLowerCase();
        return concepto.includes(searchLower) || 
               comentario.includes(searchLower) ||
               (searchNumeric && valor.includes(searchNumeric)) ||
               deQuien.includes(searchLower) ||
               paraQuien.includes(searchLower);
      });
    }

    // Filtro de fecha usando función centralizada
    if (dateRange) {
      filtered = filterTransactionsByDateRange(filtered, dateRange);
    }

    return filtered;
  }, [allTransaccionesReales, searchTerm, dateRange]);

  // Combinar transacciones reales y temporales
  const todasTransacciones = useMemo(() => {
    // Transacciones reales con tipo marcado
    const transaccionesRealesConTipo = transaccionesReales.map((t: any) => ({
      ...t,
      tipo: "Manual" as const,
      esTemporal: false,
    }));

    // Transacciones temporales con tipo marcado
    const transaccionesTemporalesConTipo = transaccionesTemporales.map(t => ({
      ...t,
      tipo: "Temporal" as const,
      esTemporal: true,
    }));

    return [...transaccionesRealesConTipo, ...transaccionesTemporalesConTipo]
      .sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        return fechaB.getTime() - fechaA.getTime();
      });
  }, [transaccionesReales, transaccionesTemporales]);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtros.fechaTipo, filtros.fechaEspecifica, filtros.fechaInicio, filtros.fechaFin]);

  // Filtrar transacciones ocultas localmente (solo visual, no afecta BD)
  const transaccionesFiltradas = useMemo(() => {
    let filtered = todasTransacciones.filter(t => {
      // Solo filtrar transacciones manuales (las temporales se mantienen visibles)
      if (t.tipo === "Manual" && typeof t.id === 'number') {
        return !hiddenTransactions.has(t.id);
      }
      return true; // Mantener temporales visibles
    });

    // Filtro de balance (positivos/negativos) - usando la misma lógica que calculateTerceroBalance
    if (balanceFilter !== 'all') {
      filtered = filtered.filter((transaccion: any) => {
        if (balanceFilter === 'positivos') {
          // Positivos: desde tercero (origen)
          return transaccion.deQuienTipo === 'tercero' && transaccion.deQuienId === terceroId.toString();
        } else if (balanceFilter === 'negativos') {
          // Negativos: hacia tercero (destino)
          return transaccion.paraQuienTipo === 'tercero' && transaccion.paraQuienId === terceroId.toString();
        }
        return true;
      });
    }

    return filtered;
  }, [todasTransacciones, hiddenTransactions, balanceFilter, terceroId]);

  // Calcular balances dinámicos usando función centralizada
  const balances = useMemo(() => {
    return calculateTerceroBalance(transaccionesFiltradas, terceroId);
  }, [transaccionesFiltradas, terceroId]);

  const limpiarFiltros = () => {
    setFiltros({
      fechaTipo: "todos",
      fechaEspecifica: "",
      fechaInicio: "",
      fechaFin: "",
    });
  };

  const tienesFiltrosActivos = filtros.fechaTipo !== "todos";

  const needsDateInput = ['exactamente', 'despues-de', 'antes-de'].includes(filtros.fechaTipo);
  const needsDateRange = filtros.fechaTipo === 'entre';

  // Funciones para transacciones temporales
  const crearTransaccionTemporal = (transaccionData: any) => {
    const nuevaTransaccionTemporal: TransaccionWithSocio = {
      id: `temp-${Date.now()}`,
      concepto: transaccionData.concepto,
      valor: transaccionData.valor,
      fecha: transaccionData.fecha,
      deQuienTipo: transaccionData.deQuienTipo,
      deQuienId: transaccionData.deQuienId,
      paraQuienTipo: transaccionData.paraQuienTipo,
      paraQuienId: transaccionData.paraQuienId,
      formaPago: transaccionData.formaPago || "Efectivo",
      voucher: transaccionData.voucher || null,
      comentario: transaccionData.comentario || null,
      horaInterna: new Date(new Date().setHours(0, 0, 1, 0)), // Hora fija 00:00:01
      oculta: false,
      userId: "main_user",
      createdAt: new Date(),
      socioNombre: tercero?.nombre || "",
      tipoSocio: "tercero" as const,
      socioId: terceroId.toString(),
      tipo: "Temporal" as const,
      esTemporal: true
    };

    setTransaccionesTemporales(prev => [...prev, nuevaTransaccionTemporal]);
  };

  const eliminarTransaccionTemporal = (transaccionId: string) => {
    setTransaccionesTemporales(prev => 
      prev.filter(t => t.id !== transaccionId)
    );
  };

  if (!tercero) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Tercero no encontrado</p>
          <Button onClick={() => setLocation("/rodmar?tab=terceros")} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/rodmar?tab=terceros")}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{tercero.nombre}</h1>
              <p className="text-sm text-muted-foreground">Historial de Transacciones</p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Resumido */}
      <div className="p-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
              <div className="p-2">
                <p className="text-xs text-muted-foreground">Transacciones</p>
                <p className="text-sm sm:text-lg font-bold text-blue-600">{transaccionesFiltradas.length}</p>
              </div>
              <div 
                className={`p-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  balanceFilter === 'positivos' ? 'ring-2 ring-green-400 shadow-md bg-green-50' : ''
                }`}
                onClick={() => setBalanceFilter('positivos')}
              >
                <p className="text-xs text-muted-foreground">Positivos</p>
                <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(balances.positivos)}</p>
              </div>
              <div 
                className={`p-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  balanceFilter === 'negativos' ? 'ring-2 ring-red-400 shadow-md bg-red-50' : ''
                }`}
                onClick={() => setBalanceFilter('negativos')}
              >
                <p className="text-xs text-muted-foreground">Negativos</p>
                <p className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(balances.negativos)}</p>
              </div>
              <div 
                className={`p-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  balanceFilter === 'all' 
                    ? balances.balance > 0
                      ? 'ring-2 ring-green-400 shadow-md bg-green-50'
                      : balances.balance < 0
                      ? 'ring-2 ring-red-400 shadow-md bg-red-50'
                      : ''
                    : ''
                }`}
                onClick={() => setBalanceFilter('all')}
              >
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`text-sm sm:text-lg font-bold ${
                  balances.balance > 0 ? 'text-green-600' : 
                  balances.balance < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {formatCurrency(balances.balance)}
                </p>
              </div>
            </div>
            {tienesFiltrosActivos && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Período: {FILTROS_FECHA.find(f => f.value === filtros.fechaTipo)?.label}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Préstamos */}
      <div className="px-4 pb-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Préstamos</CardTitle>
              <Button size="sm" onClick={() => setShowLoanModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nuevo préstamo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {loans.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Aún no hay préstamos configurados para este tercero.
              </div>
            ) : (
              loans.map((loan) => (
                <Card key={loan.id} className="border border-blue-100">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{loan.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Percent className="h-3 w-3" />
                          {Number(loan.rate) * 100}% mensual ·
                          <CalendarClock className="h-3 w-3 ml-1" />
                          Día {loan.dayOfMonth}
                        </div>
                      </div>
                      <Badge variant={loan.direction === "pay" ? "destructive" : "default"}>
                        {loan.direction === "pay" ? "Yo debo" : "Me deben"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <p className="text-muted-foreground">Capital pendiente</p>
                        <p className="font-semibold text-blue-700">{formatCurrency(loan.principalPending)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-orange-50">
                        <p className="text-muted-foreground">Interés pendiente</p>
                        <p className="font-semibold text-orange-700">{formatCurrency(loan.interestPending)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50">
                        <p className="text-muted-foreground">Total deuda</p>
                        <p className="font-semibold text-emerald-700">{formatCurrency(loan.totalDue)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50">
                        <p className="text-muted-foreground">Principal inicial</p>
                        <p className="font-semibold text-slate-700">{formatCurrency(loan.principalAmount)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLoan(loan);
                          setShowLoanHistory(true);
                        }}
                      >
                        Historial
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateInterestMutation.mutate(loan.id)}
                        disabled={generateInterestMutation.isPending}
                      >
                        Generar interés
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedLoan(loan);
                          setShowApplyPayment(true);
                        }}
                      >
                        Aplicar pago
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="px-4 pb-4">
        <Card>
          <CardContent className="p-4">
            {/* Campo de búsqueda */}
            <div className="mb-3 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar en concepto, valor o comentarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Select
                  value={filtros.fechaTipo}
                  onValueChange={(value) => setFiltros(prev => ({ ...prev, fechaTipo: value }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Filtrar por fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTROS_FECHA.map((filtro) => (
                      <SelectItem key={filtro.value} value={filtro.value}>
                        {filtro.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                {tienesFiltrosActivos && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={limpiarFiltros}
                    className="h-8 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                )}
                {/* Botón mostrar ocultas */}
                {hiddenTerceroCount > 0 ? (
                  <Button
                    onClick={() => handleShowAllHidden()}
                    size="sm"
                    className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs"
                    disabled={false}
                    title={`Mostrar ${hiddenTerceroCount} transacciones ocultas`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {hiddenTerceroCount}
                  </Button>
                ) : null}
                <Button
                  onClick={() => setIsImageModalOpen(true)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1"
                  disabled={transaccionesFiltradas.length === 0}
                  title={`Descargar imagen (máx. 200 de ${transaccionesFiltradas.length} transacciones)`}
                >
                  <Image className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Imagen</span>
                  <span className="sm:hidden">IMG</span>
                </Button>
                <Button
                  onClick={() => setShowTemporalTransaction(true)}
                  variant="outline"
                  size="sm"
                  className="bg-orange-50 hover:bg-orange-100 border-orange-600 text-orange-600 h-8 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>TEMP</span>
                </Button>
              </div>
            </div>

            {/* Campos de fecha dinámicos */}
            {needsDateInput && (
              <div className="mb-3">
                <Input
                  type="date"
                  value={filtros.fechaEspecifica}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fechaEspecifica: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {needsDateRange && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Input
                  type="date"
                  placeholder="Fecha inicio"
                  value={filtros.fechaInicio}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fechaInicio: e.target.value }))}
                  className="h-8 text-xs"
                />
                <Input
                  type="date"
                  placeholder="Fecha fin"
                  value={filtros.fechaFin}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fechaFin: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Lista de Transacciones */}
      <div className="px-4 space-y-2">
        {transaccionesFiltradas.map((transaccion: any) => {
          const valor = parseFloat(transaccion.valor.replace(/[$,]/g, ''));
          
          // Lógica para terceros (igual que minas/compradores):
          // Verde: dinero desde tercero (RodMar le debe al tercero)
          // Rojo: dinero hacia tercero (el tercero le debe a RodMar)
          const esPositivo = transaccion.deQuienTipo === 'tercero' && transaccion.deQuienId === terceroId.toString();
          const esNegativo = transaccion.paraQuienTipo === 'tercero' && transaccion.paraQuienId === terceroId.toString();
          
          return (
            <Card 
              key={transaccion.id} 
              className="hover:shadow-md transition-shadow cursor-pointer" 
              onClick={() => {
                setSelectedTransaction(transaccion);
                setIsTransactionModalOpen(true);
              }}
            >
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center justify-between gap-2">
                  {/* Lado izquierdo: Fecha, badges y concepto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1">
                      <div className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">
                        {(() => {
                          // Manejar tanto Date objects como strings con formato Jue. 09/01/25
                          let fechaStr: string;
                          if (typeof transaccion.fecha === 'string') {
                            fechaStr = transaccion.fecha.includes('T') 
                              ? transaccion.fecha.split('T')[0] 
                              : transaccion.fecha;
                          } else {
                            // Es un objeto Date
                            const date = new Date(transaccion.fecha);
                            fechaStr = date.getFullYear() + '-' + 
                              String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                              String(date.getDate()).padStart(2, '0');
                          }
                          
                          const [year, month, day] = fechaStr.split('-');
                          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                          const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                          const dayName = dayNames[dateObj.getDay()];
                          
                          // Formato Jue. 09/01/25
                          const shortYear = year.slice(-2);
                          return `${dayName}. ${day}/${month}/${shortYear}`;
                        })()}
                      </div>
                      
                      {/* Badges de tipo */}
                      {transaccion.esTemporal ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-orange-600 border-orange-600">T</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">M</Badge>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-900 truncate pr-1">
                      {(() => {
                        const conceptoText = transaccion.concepto && transaccion.concepto.includes('data:image') ? 
                          '[Imagen]' : 
                          transaccion.esTemporal ? 
                            `${transaccion.concepto} (Temporal)` :
                            transaccion.concepto;
                        return highlightText(conceptoText, searchTerm);
                      })()}
                    </div>
                    {/* Comentario compacto si existe */}
                    {transaccion.comentario && transaccion.comentario.trim() && (
                      <div className="text-xs text-gray-500 mt-0.5 leading-tight">
                        {(() => {
                          const comentarioText = transaccion.comentario.length > 50 ? 
                            `${transaccion.comentario.substring(0, 50)}...` : 
                            transaccion.comentario;
                          return highlightText(comentarioText, searchTerm);
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Lado derecho: Valor y botones de acción */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                      esPositivo ? 'text-green-600' : 
                      esNegativo ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {esPositivo ? `+$ ${valor.toLocaleString()}` : 
                       esNegativo ? `-$ ${valor.toLocaleString()}` : 
                       `$ ${valor.toLocaleString()}`}
                    </span>

                    {/* Botones de acción compactos */}
                    {transaccion.esTemporal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminarTransaccionTemporal(transaccion.id);
                        }}
                        className="w-8 h-8 sm:w-4 sm:h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors touch-manipulation"
                        title="Eliminar transacción temporal"
                      >
                        <X className="w-4 h-4 sm:w-2.5 sm:h-2.5 text-red-600" />
                      </button>
                    )}
                    {!transaccion.esTemporal && transaccion.tipo === "Manual" && (
                      <div className="flex gap-1 sm:gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const realTransaction = transaccionesReales.find((t: any) => t.id.toString() === transaccion.id.toString());
                            if (realTransaction) {
                              setSelectedTransaction(realTransaction);
                              setShowEditTransaction(true);
                            }
                          }}
                          className="w-8 h-8 sm:w-4 sm:h-4 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors touch-manipulation"
                          title="Editar transacción"
                        >
                          <Edit className="w-4 h-4 sm:w-2.5 sm:h-2.5 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const realTransaction = transaccionesReales.find((t: any) => t.id.toString() === transaccion.id.toString());
                            if (realTransaction) {
                              setSelectedTransaction(realTransaction);
                              setShowDeleteTransaction(true);
                            }
                          }}
                          className="w-8 h-8 sm:w-4 sm:h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors touch-manipulation"
                          title="Eliminar transacción"
                        >
                          <Trash2 className="w-4 h-4 sm:w-2.5 sm:h-2.5 text-red-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const realTransaction = transaccionesReales.find((t: any) => t.id.toString() === transaccion.id.toString());
                            if (realTransaction) {
                              handleHideTransaction(realTransaction.id);
                            }
                          }}
                          className="w-8 h-8 sm:w-4 sm:h-4 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors touch-manipulation"
                          disabled={false}
                          title="Ocultar transacción"
                        >
                          <Eye className="w-4 h-4 sm:w-2.5 sm:h-2.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {transaccionesFiltradas.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay transacciones para mostrar</p>
            {tienesFiltrosActivos && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={limpiarFiltros}
                className="mt-2"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modal de detalles de transacciones */}
      <TransactionDetailModal
        open={isTransactionModalOpen}
        onOpenChange={setIsTransactionModalOpen}
        transaction={selectedTransaction}
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

      {/* Modal: Crear préstamo */}
      <Dialog open={showLoanModal} onOpenChange={setShowLoanModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear préstamo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                placeholder="Ej: Préstamo Danitza Dic-2026"
                value={loanName}
                onChange={(e) => setLoanName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Transacción base (desembolso)</label>
              <Select value={loanPrincipalTransactionId} onValueChange={setLoanPrincipalTransactionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar transacción" />
                </SelectTrigger>
                <SelectContent>
                  {transaccionesPrestamo.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {new Date(t.fecha).toLocaleDateString("es-CO")} · {t.concepto} · {formatCurrency(t.valor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tasa mensual (%)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={loanRatePercent}
                  onChange={(e) => setLoanRatePercent(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Día de generación</label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={loanDayOfMonth}
                  onChange={(e) => setLoanDayOfMonth(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Dirección del interés</label>
              <Select value={loanDirection} onValueChange={(v) => setLoanDirection(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pay">Yo debo (interés a favor del tercero)</SelectItem>
                  <SelectItem value="receive">Me deben (interés a mi favor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Input
                placeholder="Observaciones"
                value={loanNotes}
                onChange={(e) => setLoanNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoanModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createLoanMutation.mutate()}
              disabled={!loanName.trim() || !loanPrincipalTransactionId || createLoanMutation.isPending}
            >
              Crear préstamo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial de préstamo */}
      <Dialog open={showLoanHistory} onOpenChange={setShowLoanHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial · {selectedLoan?.name || ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            {loanHistory?.events?.length ? (
              loanHistory.events.map((event: any, idx: number) => (
                <div key={`${event.type}-${idx}`} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{event.label}</span>
                    <span className="text-sm font-semibold">{formatCurrency(event.amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(event.date).toLocaleDateString("es-CO")}
                    {event.rate !== undefined && ` · Tasa ${(event.rate * 100).toFixed(2)}%`}
                  </div>
                  {event.appliedInterest !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      Aplicado a interés: {formatCurrency(event.appliedInterest)} ·
                      capital: {formatCurrency(event.appliedPrincipal)}
                    </div>
                  )}
                  {event.transaction?.concepto && (
                    <div className="text-xs text-muted-foreground">“{event.transaction.concepto}”</div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sin historial aún.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Aplicar pago */}
      <Dialog open={showApplyPayment} onOpenChange={setShowApplyPayment}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aplicar pago · {selectedLoan?.name || ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Transacción de pago</label>
              <Select value={paymentTransactionId} onValueChange={setPaymentTransactionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar transacción" />
                </SelectTrigger>
                <SelectContent>
                  {transaccionesPago.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {new Date(t.fecha).toLocaleDateString("es-CO")} · {t.concepto} · {formatCurrency(t.valor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Aplicar a interés (opcional)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={applyInterestValue}
                  onChange={(e) => setApplyInterestValue(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Aplicar a capital (opcional)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={applyPrincipalValue}
                  onChange={(e) => setApplyPrincipalValue(e.target.value)}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Si dejas los campos vacíos, se aplica automáticamente (interés → capital).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyPayment(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => applyPaymentMutation.mutate()}
              disabled={!paymentTransactionId || applyPaymentMutation.isPending}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botón flotante para gestionar transacciones - Solo visible si tiene permisos */}
      {(has("action.TRANSACCIONES.create") || 
        has("action.TRANSACCIONES.solicitar") || 
        has("action.TRANSACCIONES.completePending")) && (
        <Button
          size="icon"
          className="fixed bottom-24 right-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg z-40"
          onClick={() => setShowGestionarModal(true)}
          aria-label="Gestionar transacciones"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      )}

      {/* Modal de gestionar transacciones */}
      <GestionarTransaccionesModal
        open={showGestionarModal}
        onClose={() => setShowGestionarModal(false)}
        onCrear={() => setShowNewTransaction(true)}
        onSolicitar={() => setShowSolicitarModal(true)}
        onCompletar={() => setShowPendingModal(true)}
      />

      {/* Modal de solicitar transacción */}
      <SolicitarTransaccionModal
        open={showSolicitarModal}
        onClose={() => setShowSolicitarModal(false)}
      />

      {/* Modal de transacciones pendientes */}
      <PendingListModal
        open={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        onSelectTransaction={(transaction) => {
          setSelectedTransaction(transaction);
          setShowPendingModal(false);
        }}
      />

      {/* Modal para nueva transacción */}
      <NewTransactionModal
        open={showNewTransaction}
        onClose={() => setShowNewTransaction(false)}
      />

      {/* Modal para nueva transacción temporal */}
      <NewTransactionModal
        open={showTemporalTransaction}
        onClose={() => setShowTemporalTransaction(false)}
        onSuccess={(transaccionData) => {
          crearTransaccionTemporal(transaccionData);
          setShowTemporalTransaction(false);
        }}
        isTemporalMode={true}
      />

      {/* Modal de imagen descargable */}
      {tercero && (
        <TerceroTransaccionesImageModal
          open={isImageModalOpen}
          onOpenChange={setIsImageModalOpen}
          transacciones={transaccionesFiltradas}
          tercero={tercero}
          filterLabel={FILTROS_FECHA.find(f => f.value === filtros.fechaTipo)?.label || "Todas"}
          terceroId={terceroId}
        />
      )}

    </div>
  );
}
