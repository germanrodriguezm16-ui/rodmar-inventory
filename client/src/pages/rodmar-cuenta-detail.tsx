import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/usePagination";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { getAuthToken } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, highlightText, highlightValue } from "@/lib/utils";
import { ArrowLeft, TrendingUp, TrendingDown, Filter, X, Download, Image, Plus, Edit, Search, Trash2, Eye } from "lucide-react";
import { TransaccionWithSocio } from "@shared/schema";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears } from "date-fns";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import { RodMarCuentasImageModal } from "@/components/modals/rodmar-cuentas-image-modal";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { EditInvestmentModal } from "@/components/forms/edit-investment-modal";
import { DeleteInvestmentModal } from "@/components/forms/delete-investment-modal";

// Función simple para formatear fechas con día de la semana
const formatDateWithDaySpanish = (date: Date) => {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const day = days[date.getDay()];
  const dayNum = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}. ${dayNum}/${month}/${year}`;
};

// Estado para filtros
interface TransaccionFiltrosState {
  fechaTipo: string;
  fechaEspecifica: string;
  fechaInicio: string;
  fechaFin: string;
}

interface RouteParams {
  cuentaSlug: string;
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

const slugToCuentaName = (slug: string) => {
  const map: Record<string, string> = {
    'bemovil': 'Bemovil',
    'corresponsal': 'Corresponsal',
    'efectivo': 'Efectivo',
    'cuentas-german': 'Cuentas German',
    'cuentas-jhon': 'Cuentas Jhon',
    'otros': 'Otros'
  };
  return map[slug] || slug;
};

const cuentaNameToId = (nombre: string) => {
  const map: Record<string, string> = {
    'Bemovil': 'bemovil',
    'Corresponsal': 'corresponsal',
    'Efectivo': 'efectivo',
    'Cuentas German': 'cuentas-german',
    'Cuentas Jhon': 'cuentas-jhon',
    'Otros': 'otros'
  };
  return map[nombre] || nombre.toLowerCase();
};

const getDateRange = (tipo: string, fechaEspecifica?: Date, fechaInicio?: Date, fechaFin?: Date) => {
  const hoy = new Date();
  
  switch (tipo) {
    case "exactamente":
      if (!fechaEspecifica) return null;
      return {
        inicio: startOfDay(fechaEspecifica),
        fin: endOfDay(fechaEspecifica)
      };
    case "entre":
      if (!fechaInicio || !fechaFin) return null;
      return {
        inicio: startOfDay(fechaInicio),
        fin: endOfDay(fechaFin)
      };
    case "despues-de":
      if (!fechaEspecifica) return null;
      return {
        inicio: startOfDay(fechaEspecifica),
        fin: new Date(2099, 11, 31)
      };
    case "antes-de":
      if (!fechaEspecifica) return null;
      return {
        inicio: new Date(1900, 0, 1),
        fin: endOfDay(fechaEspecifica)
      };
    case "hoy":
      return {
        inicio: startOfDay(hoy),
        fin: endOfDay(hoy)
      };
    case "ayer":
      const ayer = subDays(hoy, 1);
      return {
        inicio: startOfDay(ayer),
        fin: endOfDay(ayer)
      };
    case "esta-semana":
      return {
        inicio: startOfWeek(hoy, { weekStartsOn: 1 }),
        fin: endOfWeek(hoy, { weekStartsOn: 1 })
      };
    case "semana-pasada":
      const semanaAnterior = subWeeks(hoy, 1);
      return {
        inicio: startOfWeek(semanaAnterior, { weekStartsOn: 1 }),
        fin: endOfWeek(semanaAnterior, { weekStartsOn: 1 })
      };
    case "este-mes":
      return {
        inicio: startOfMonth(hoy),
        fin: endOfMonth(hoy)
      };
    case "mes-pasado":
      const mesAnterior = subMonths(hoy, 1);
      return {
        inicio: startOfMonth(mesAnterior),
        fin: endOfMonth(mesAnterior)
      };
    case "este-año":
      return {
        inicio: startOfYear(hoy),
        fin: endOfYear(hoy)
      };
    case "año-pasado":
      const añoAnterior = subYears(hoy, 1);
      return {
        inicio: startOfYear(añoAnterior),
        fin: endOfYear(añoAnterior)
      };
    default:
      return null;
  }
};

export default function RodMarCuentaDetail() {
  const params = useParams<RouteParams>();
  const [, setLocation] = useLocation();
  const cuentaSlug = params.cuentaSlug || '';
  const cuentaNombre = slugToCuentaName(cuentaSlug);
  

  
  // Estados para filtros
  const [filtros, setFiltros] = useState<TransaccionFiltrosState>({
    fechaTipo: "todos",
    fechaEspecifica: "",
    fechaInicio: "",
    fechaFin: "",
  });

  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para modal de detalles de transacciones
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Estado para modal de imagen de transacciones
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Estados para transacciones temporales
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<TransaccionWithSocio[]>([]);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);

  // Estados para inversiones
  const [selectedInversion, setSelectedInversion] = useState<any>(null);
  const [showEditInversion, setShowEditInversion] = useState(false);
  const [showDeleteInversion, setShowDeleteInversion] = useState(false);

  // Estados para editar y eliminar transacciones manuales
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [showDeleteTransaction, setShowDeleteTransaction] = useState(false);

  // Paginación con memoria en localStorage
  const { currentPage, setCurrentPage, pageSize, setPageSize, getLimitForServer } = usePagination({
    storageKey: `rodmar-cuenta-${cuentaSlug}-pageSize`,
    defaultPageSize: 50,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutación para ocultar transacciones individuales
  const hideTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/transacciones/${transactionId}/hide`), {
        method: 'PATCH',
        headers,
        credentials: "include",
      });
      if (!response.ok) throw new Error('Error al ocultar transacción');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/cuenta/${cuentaNombre}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/cuenta/${cuentaNombre}/all`] });
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      
      // Forzar refetch inmediato para actualización inmediata
      queryClient.refetchQueries({ 
        queryKey: [`/api/transacciones/cuenta/${cuentaNombre}`],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: [`/api/transacciones/cuenta/${cuentaNombre}/all`],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ["/api/rodmar-accounts"],
        type: 'active'
      });
      
      toast({
        title: "Transacción ocultada",
        description: "La transacción se ha ocultado correctamente"
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

  // Mutación para mostrar todas las transacciones ocultas
  const showAllHiddenMutation = useMutation({
    mutationFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/transacciones/show-all-hidden`), {
        method: 'PATCH',
        headers,
        credentials: "include",
      });
      if (!response.ok) throw new Error('Error al mostrar transacciones ocultas');
      return await response.json();
    },
    onSuccess: () => {
      toast({
        description: "Todas las transacciones ocultas ahora son visibles",
        duration: 2000,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/cuenta/${cuentaNombre}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transacciones/cuenta/${cuentaNombre}/all`] });
      queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
    },
    onError: () => {
      toast({
        description: "Error al mostrar transacciones ocultas",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  // Calcular fechaDesde y fechaHasta para enviar al servidor
  // IMPORTANTE: Crear fechas en hora local para evitar problemas de zona horaria (Colombia UTC-5)
  const dateRange = useMemo(() => {
    // Función helper para crear Date en hora local desde string YYYY-MM-DD
    const createLocalDate = (dateString: string): Date => {
      const [year, month, day] = dateString.split('-').map(Number);
      // Crear fecha en hora local (no UTC) usando new Date(year, month - 1, day)
      return new Date(year, month - 1, day);
    };
    
    const rango = getDateRange(
      filtros.fechaTipo,
      filtros.fechaEspecifica ? createLocalDate(filtros.fechaEspecifica) : undefined,
      filtros.fechaInicio ? createLocalDate(filtros.fechaInicio) : undefined,
      filtros.fechaFin ? createLocalDate(filtros.fechaFin) : undefined
    );
    if (!rango) return null;
    
    // Convertir Date objects a strings ISO (YYYY-MM-DD) usando métodos locales
    const formatDate = (date: Date): string => {
      // Usar getFullYear(), getMonth(), getDate() que devuelven valores en hora local
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    return {
      start: formatDate(rango.inicio),
      end: formatDate(rango.fin)
    };
  }, [filtros.fechaTipo, filtros.fechaEspecifica, filtros.fechaInicio, filtros.fechaFin]);

  // Obtener transacciones de esta cuenta específica con paginación del servidor (sin filtros)
  const { 
    data: transactionsData,
    isLoading: isLoadingTransactions
  } = useQuery<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
    hiddenCount?: number;
  }>({
    queryKey: [
      `/api/transacciones/cuenta/${cuentaNombre}`, 
      currentPage, 
      pageSize
    ],
    queryFn: async () => {
      // Solo enviar paginación al servidor (sin filtros)
      const limit = getLimitForServer();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/transacciones/cuenta/${cuentaNombre}?${params.toString()}`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Obtener TODAS las transacciones de esta cuenta (incluyendo ocultas) para contar ocultas
  const { data: todasTransaccionesIncOcultas = [] } = useQuery<any[]>({
    queryKey: [`/api/transacciones/cuenta/${cuentaNombre}/all`],
    enabled: !!cuentaNombre,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/transacciones/cuenta/${cuentaNombre}?includeHidden=true`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Error al obtener transacciones');
      const data = await response.json();
      // Cuando includeHidden=true, el servidor devuelve un array directo
      return Array.isArray(data) ? data : (data.data || []);
    },
  });

  const allTransaccionesReales = transactionsData?.data || [];
  const pagination = transactionsData?.pagination;
  const hiddenCuentaCount = todasTransaccionesIncOcultas?.filter((t: any) => t.oculta).length || 0;

  // Filtrado client-side sobre la página activa
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

    // Filtro de fecha - Comparar solo la parte de fecha (sin hora) para evitar problemas de zona horaria
    if (dateRange) {
      filtered = filtered.filter(t => {
        // Extraer solo la parte de fecha como string (YYYY-MM-DD) de la transacción
        const fechaTransStr = typeof t.fecha === 'string' 
          ? t.fecha.split('T')[0]  // Si es string ISO, tomar solo la parte de fecha
          : new Date(t.fecha).toISOString().split('T')[0]; // Si es Date, convertir a ISO y tomar solo fecha
        
        // dateRange.start y dateRange.end ya son strings en formato YYYY-MM-DD
        const fechaInicio = dateRange.start;
        const fechaFin = dateRange.end;
        
        // Comparar strings directamente (YYYY-MM-DD) para evitar problemas de zona horaria
        return fechaTransStr >= fechaInicio && fechaTransStr <= fechaFin;
      });
    }

    return filtered;
  }, [allTransaccionesReales, searchTerm, dateRange]);

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
          
          queryClient.prefetchQuery({
            queryKey: [
              `/api/transacciones/cuenta/${cuentaNombre}`, 
              page, 
              typeof pageSize === "number" ? pageSize : 999999
            ],
            queryFn: async () => {
              const response = await fetch(apiUrl(`/api/transacciones/cuenta/${cuentaNombre}?${params.toString()}`));
              if (!response.ok) throw new Error('Error al obtener transacciones');
              return response.json();
            },
            staleTime: 300000,
          });
        }
      }, 100); // Pequeño delay para no bloquear la UI inicial
    }
  }, [pagination, currentPage, pageSize, cuentaNombre, queryClient, getLimitForServer]);

  // Obtener inversiones relacionadas con esta cuenta
  const { data: inversionesReales = [] } = useQuery({
    queryKey: [`/api/inversiones/cuenta/${cuentaNameToId(cuentaNombre)}`],
  });

  // Combinar transacciones reales, temporales e inversiones
  const todasTransacciones = useMemo(() => {
    // Transacciones reales con tipo marcado
    const transaccionesRealesConTipo = transaccionesReales.map((t: any) => ({
      ...t,
      tipo: "Manual" as const,
      esTemporal: false,
      esInversion: false
    }));

    // Transacciones temporales con tipo marcado
    const transaccionesTemporalesConTipo = transaccionesTemporales.map(t => ({
      ...t,
      tipo: "Temporal" as const,
      esTemporal: true,
      esInversion: false
    }));

    // Convertir inversiones a formato de transacciones para visualización
    const inversionesComoDemostraciones = inversionesReales.map((inversion: any) => {
      const cuentaId = cuentaNameToId(cuentaNombre);
      
      // Determinar colores y dirección basado en origen/destino
      let tipo = "Inversión";
      let color = "amarillo"; // Color distintivo para inversiones
      let esPositiva = false;
      
      // Si la cuenta actual es el ORIGEN de la inversión → ROJO (egreso)
      // Si la cuenta actual es el DESTINO de la inversión → VERDE (ingreso)
      if (inversion.origen === 'rodmar' && inversion.origenDetalle === cuentaId) {
        color = "rojo";
        esPositiva = false;
      } else if (inversion.destino === 'rodmar' && inversion.destinoDetalle === cuentaId) {
        color = "verde";
        esPositiva = true;
      }

      return {
        id: `inv-${inversion.id}`,
        concepto: inversion.concepto,
        valor: inversion.valor,
        fecha: inversion.fecha,
        tipo: tipo,
        esTemporal: false,
        esInversion: true,
        colorInversion: color,
        esPositiva: esPositiva,
        voucher: inversion.voucher,
        observaciones: inversion.observaciones,
        // Campos necesarios para compatibilidad con el sistema existente
        deQuienTipo: inversion.origen === 'rodmar' && inversion.origenDetalle === cuentaId ? 'rodmar' : 'externa',
        deQuienId: inversion.origen === 'rodmar' ? inversion.origenDetalle : inversion.origen,
        paraQuienTipo: inversion.destino === 'rodmar' && inversion.destinoDetalle === cuentaId ? 'rodmar' : 'externa',
        paraQuienId: inversion.destino === 'rodmar' ? inversion.destinoDetalle : inversion.destino
      };
    });

    return [...transaccionesRealesConTipo, ...transaccionesTemporalesConTipo, ...inversionesComoDemostraciones]
      .sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        return fechaB.getTime() - fechaA.getTime();
      });
  }, [transaccionesReales, transaccionesTemporales, inversionesReales, cuentaNombre]);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtros.fechaTipo, filtros.fechaEspecifica, filtros.fechaInicio, filtros.fechaFin]);

  // Las transacciones ya vienen filtradas del servidor
  // Solo necesitamos combinar con temporales e inversiones
  const transaccionesFiltradas = todasTransacciones;

  // Calcular balances dinámicos
  const calcularBalances = () => {
    let positivos = 0;
    let negativos = 0;
    const cuentaId = cuentaNameToId(cuentaNombre);

    transaccionesFiltradas.forEach((transaccion: any) => {
      const valor = parseFloat(transaccion.valor.replace ? transaccion.valor.replace(/[$,]/g, '') : transaccion.valor);
      
      // Lógica específica para inversiones
      if (transaccion.esInversion) {
        if (transaccion.esPositiva) {
          positivos += valor;
        } else {
          negativos += valor;
        }
        return;
      }
      
      // Nueva lógica específica para cuentas RodMar individuales:
      // Si la transacción tiene DESTINO esta cuenta específica → positivo (ingreso)
      // Si la transacción tiene ORIGEN esta cuenta específica → negativo (egreso)
      
      const esIngresoACuenta = transaccion.paraQuienTipo === 'rodmar' && 
                               transaccion.paraQuienId && 
                               transaccion.paraQuienId === cuentaId;
      
      const esEgresoDeEstaCuenta = transaccion.deQuienTipo === 'rodmar' && 
                                   transaccion.deQuienId && 
                                   transaccion.deQuienId === cuentaId;
      
      // Para transacciones temporales: si el origen es esta cuenta, contar como egreso
      const esEgresoTemporal = transaccion.esTemporal && 
                               transaccion.deQuienTipo === 'rodmar' && 
                               transaccion.deQuienId === cuentaId;
      
      // Para transacciones temporales con origen en esta cuenta: siempre contar como negativo
      if (transaccion.esTemporal && transaccion.deQuienTipo === 'rodmar' && transaccion.deQuienId === cuentaId) {
        negativos += valor;
      } else if (esIngresoACuenta) {
        positivos += valor;
      } else if (esEgresoDeEstaCuenta) {
        negativos += valor;
      }
    });

    return {
      positivos,
      negativos,
      balance: positivos - negativos
    };
  };

  const balances = calcularBalances();

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
      paraQuienTipo: "rodmar",
      paraQuienId: cuentaNameToId(cuentaNombre),
      formaPago: transaccionData.formaPago || "Efectivo",
      voucher: transaccionData.voucher || null,
      comentario: transaccionData.comentario || null,
      horaInterna: new Date(new Date().setHours(0, 0, 1, 0)), // Hora fija 00:00:01
      oculta: false,
      userId: "main_user",
      createdAt: new Date(),
      socioNombre: cuentaNombre,
      tipoSocio: "rodmar" as const,
      socioId: cuentaNameToId(cuentaNombre),
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

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/rodmar")}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{cuentaNombre}</h1>
              <p className="text-sm text-muted-foreground">Historial de Transacciones</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImageModalOpen(true)}
              className="h-8 px-3 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
              disabled={transaccionesFiltradas.length === 0}
            >
              <Image className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Imagen</span>
              <span className="sm:hidden">Img</span>
            </Button>
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
              <div className="p-2">
                <p className="text-xs text-muted-foreground">Positivos</p>
                <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(balances.positivos)}</p>
              </div>
              <div className="p-2">
                <p className="text-xs text-muted-foreground">Negativos</p>
                <p className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(balances.negativos)}</p>
              </div>
              <div className="p-2">
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
                {hiddenCuentaCount > 0 ? (
                  <Button
                    onClick={() => showAllHiddenMutation.mutate()}
                    size="sm"
                    className="h-8 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={showAllHiddenMutation.isPending}
                    title={`Mostrar ${hiddenCuentaCount} transacciones ocultas`}
                  >
                    +{hiddenCuentaCount}
                  </Button>
                ) : null}
                <Button
                  onClick={() => setShowTemporalTransaction(true)}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                >
                  <Plus className="w-2.5 h-2.5 mr-1" />
                  Temporal
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

      {/* Lista de Transacciones - Formato idéntico a minas */}
      <div className="px-4 space-y-2">
        {transaccionesFiltradas.map((transaccion: any) => {
          const valor = parseFloat(transaccion.valor.replace(/[$,]/g, ''));
          const cuentaId = cuentaNameToId(cuentaNombre);
          
          // Nueva lógica específica para cuentas RodMar individuales:
          // Verde: dinero que entra a esta cuenta específica
          // Rojo: dinero que sale de esta cuenta específica
          const esIngresoACuenta = transaccion.paraQuienTipo === 'rodmar' && 
                                   transaccion.paraQuienId && 
                                   transaccion.paraQuienId === cuentaId;
          
          const esEgresoDeEstaCuenta = transaccion.deQuienTipo === 'rodmar' && 
                                       transaccion.deQuienId && 
                                       transaccion.deQuienId === cuentaId;
          
          // Para transacciones temporales: si el origen es esta cuenta, mostrar como egreso (rojo/negativo)
          const esEgresoTemporal = transaccion.esTemporal && 
                                   transaccion.deQuienTipo === 'rodmar' && 
                                   transaccion.deQuienId === cuentaId;
          
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
                      
                      {/* Badges de tipo - Idéntico a minas */}
                      {transaccion.esTemporal ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-orange-600 border-orange-600">T</Badge>
                      ) : transaccion.esInversion ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-yellow-600 border-yellow-600">I</Badge>
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
                      // Lógica para inversiones
                      transaccion.esInversion ? (
                        transaccion.colorInversion === 'verde' ? 'text-green-600' : 
                        transaccion.colorInversion === 'rojo' ? 'text-red-600' : 'text-yellow-600'
                      ) :
                      // Para transacciones temporales: si origen = esta cuenta → rojo/negativo
                      (transaccion.esTemporal && transaccion.deQuienTipo === 'rodmar' && transaccion.deQuienId === cuentaId) ? 'text-red-600' :
                      esIngresoACuenta ? 'text-green-600' : 
                      (esEgresoDeEstaCuenta || esEgresoTemporal) ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {(() => {
                        // Lógica para inversiones
                        if (transaccion.esInversion) {
                          return (transaccion.esPositiva ? '+' : '-') + '$ ' + valor.toLocaleString();
                        }
                        // Para transacciones temporales: si origen = esta cuenta → signo negativo
                        if (transaccion.esTemporal && transaccion.deQuienTipo === 'rodmar' && transaccion.deQuienId === cuentaId) {
                          return `-$ ${valor.toLocaleString()}`;
                        }
                        return esIngresoACuenta ? `+$ ${valor.toLocaleString()}` : 
                               (esEgresoDeEstaCuenta || esEgresoTemporal) ? `-$ ${valor.toLocaleString()}` : 
                               `$ ${valor.toLocaleString()}`;
                      })()}
                    </span>

                    {/* Botones de acción compactos */}
                    {transaccion.esTemporal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminarTransaccionTemporal(transaccion.id);
                        }}
                        className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                        title="Eliminar transacción temporal"
                      >
                        <X className="w-2.5 h-2.5 text-red-600" />
                      </button>
                    )}
                    {transaccion.esInversion && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInversion(transaccion);
                            setShowEditInversion(true);
                          }}
                          className="w-4 h-4 rounded-full bg-yellow-100 hover:bg-yellow-200 flex items-center justify-center transition-colors"
                          title="Editar inversión"
                        >
                          <Edit className="w-2.5 h-2.5 text-yellow-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInversion(transaccion);
                            setShowDeleteInversion(true);
                          }}
                          className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                          title="Eliminar inversión"
                        >
                          <X className="w-2.5 h-2.5 text-red-600" />
                        </button>
                      </div>
                    )}
                    {!transaccion.esTemporal && !transaccion.esInversion && transaccion.tipo === "Manual" && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const realTransaction = transaccionesReales.find((t: any) => t.id.toString() === transaccion.id.toString());
                            if (realTransaction) {
                              setSelectedTransaction(realTransaction);
                              setShowEditTransaction(true);
                            }
                          }}
                          className="w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors"
                          title="Editar transacción"
                        >
                          <Edit className="w-2.5 h-2.5 text-blue-600" />
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
                          className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                          title="Eliminar transacción"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-red-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const realTransaction = transaccionesReales.find((t: any) => t.id.toString() === transaccion.id.toString());
                            if (realTransaction) {
                              hideTransactionMutation.mutate(realTransaction.id);
                            }
                          }}
                          className="w-4 h-4 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          disabled={hideTransactionMutation.isPending}
                          title="Ocultar transacción"
                        >
                          <Eye className="w-2.5 h-2.5 text-gray-500" />
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

      {/* Controles de paginación */}
      {pagination && (
        <div className="px-4 py-4">
          <PaginationControls
            page={currentPage}
            limit={pageSize}
            total={transaccionesReales.length} // Mostrar total de transacciones filtradas en la página actual
            totalPages={pagination.totalPages}
            hasMore={pagination.hasMore}
            onPageChange={(newPage) => {
              setCurrentPage(newPage);
              // Scroll al inicio de la lista
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit);
            }}
            limitOptions={[10, 20, 50, 100, 200, 500, 1000]}
          />
        </div>
      )}

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

      {/* Modal de imagen de transacciones */}
      <RodMarCuentasImageModal
        open={isImageModalOpen}
        onOpenChange={setIsImageModalOpen}
        transacciones={transaccionesFiltradas}
        cuentaNombre={cuentaNombre}
        filtroAplicado={filtros.fechaTipo === "todos" ? "Todas" : 
          FILTROS_FECHA.find(f => f.value === filtros.fechaTipo)?.label || "Personalizado"}
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

      {/* Modales de inversión */}
      <EditInvestmentModal
        isOpen={showEditInversion}
        onClose={() => {
          setShowEditInversion(false);
          setSelectedInversion(null);
        }}
        inversion={selectedInversion}
      />

      <DeleteInvestmentModal
        isOpen={showDeleteInversion}
        onClose={() => {
          setShowDeleteInversion(false);
          setSelectedInversion(null);
        }}
        inversion={selectedInversion}
      />

    </div>
  );
}