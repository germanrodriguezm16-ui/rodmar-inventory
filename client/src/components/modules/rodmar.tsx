
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useCallback, memo, lazy, Suspense, useEffect } from "react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/usePagination";
import { apiUrl } from "@/lib/api";
import { getAuthToken, removeAuthToken } from "@/hooks/useAuth";
import { parseJsonWithDateInterception } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { User, Calculator, Building2, ShoppingCart, DollarSign, Banknote, Search, CalendarDays, ArrowUp, ArrowDown, ImageIcon, Plus, X, BarChart3, TrendingUp, ChevronRight, Edit, Trash2, Eye } from "lucide-react";

import { formatDateWithDaySpanish } from "@/lib/date-utils";
import { highlightText, highlightValue } from "@/lib/utils";
import { getDateRangeFromFilter, filterTransactionsByDateRange, type DateFilterType as SharedDateFilterType } from "@/lib/date-filter-utils";
import { usePermissions } from "@/hooks/usePermissions";

// Usar el tipo DateFilterType de date-filter-utils
type DateFilterType = SharedDateFilterType;

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
import { InvestmentModal } from "@/components/forms/investment-modal";
import { useVolqueterosBalance } from "@/hooks/useVolqueterosBalance";
import { useCompradoresBalance } from "@/hooks/useCompradoresBalance";
import { RodmarTransaccionesImageModal } from "@/components/modals/rodmar-transacciones-image-modal";
import { useToast } from "@/hooks/use-toast";
import { NewTransactionModal } from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import { useMutation } from "@tanstack/react-query";
import { useHiddenTransactions } from "@/hooks/useHiddenTransactions";
import AddTerceroModal from "@/components/modals/add-tercero-modal";
import EditTerceroModal from "@/components/modals/edit-tercero-modal";
import DeleteTerceroModal from "@/components/modals/delete-tercero-modal";
import AddRodmarCuentaModal from "@/components/modals/add-rodmar-cuenta-modal";
import EditRodmarCuentaModal from "@/components/modals/edit-rodmar-cuenta-modal";
import DeleteRodmarCuentaModal from "@/components/modals/delete-rodmar-cuenta-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Función helper para formatear moneda fuera del componente
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
};

export default function RodMar() {
  const [, setLocation] = useLocation();
  const { has } = usePermissions();
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [selectedSubAccount, setSelectedSubAccount] = useState<string>("");
  const [showAddTerceroModal, setShowAddTerceroModal] = useState(false);
  const [showEditTerceroModal, setShowEditTerceroModal] = useState(false);
  const [showDeleteTerceroModal, setShowDeleteTerceroModal] = useState(false);
  const [selectedTercero, setSelectedTercero] = useState<any>(null);
  
  // Estados para modales de cuentas RodMar
  const [showAddCuentaModal, setShowAddCuentaModal] = useState(false);
  const [showEditCuentaModal, setShowEditCuentaModal] = useState(false);
  const [showDeleteCuentaModal, setShowDeleteCuentaModal] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);

  // Leer el query parameter 'tab' de la URL para determinar qué tab mostrar
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    // Validar que el tab existe y el usuario tiene permisos
    if (tabParam === 'terceros' && has("module.RODMAR.tab.TERCEROS.view")) {
      return 'terceros';
    }
    if (tabParam === 'cuentas' && has("module.RODMAR.accounts.view")) {
      return 'cuentas';
    }
    if (tabParam === 'lcdm' && has("module.RODMAR.LCDM.view")) {
      return 'lcdm';
    }
    if (tabParam === 'banco' && has("module.RODMAR.Banco.view")) {
      return 'banco';
    }
    if (tabParam === 'postobon' && has("module.RODMAR.Postobon.view")) {
      return 'postobon';
    }
    // Default: cuentas si tiene permisos, sino el primero disponible
    return has("module.RODMAR.accounts.view") ? 'cuentas' : (has("module.RODMAR.tab.TERCEROS.view") ? 'terceros' : (has("module.RODMAR.LCDM.view") ? 'lcdm' : (has("module.RODMAR.Banco.view") ? 'banco' : 'postobon')));
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());






  
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    staleTime: 30000,
  });

  const { data: financialSummary } = useQuery({
    queryKey: ["/api/financial-summary"],
    staleTime: 30000,
  });

  // Obtener datos para balances generales
  const { data: minas = [] } = useQuery({
    queryKey: ["/api/minas"],
    staleTime: 30000,
  });

  const { data: compradores = [] } = useQuery({
    queryKey: ["/api/compradores"],
    staleTime: 30000,
  });

  const { data: terceros = [] } = useQuery({
    queryKey: ["/api/terceros"],
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo (consistente con otros módulos)
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
    enabled: activeTab === 'terceros' || has("module.RODMAR.tab.TERCEROS.view"), // Solo cargar cuando se necesita
  });

  // Usar hooks compartidos para balances
  const { resumenFinanciero: resumenVolqueterosOriginal } = useVolqueterosBalance();
  const { resumenFinanciero: resumenCompradoresOriginal } = useCompradoresBalance();

  const { data: viajes = [] } = useQuery({
    queryKey: ["/api/viajes"],
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  const { data: transacciones = [] } = useQuery({
    queryKey: ["/api/transacciones"],
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
  });

  // Obtener transacciones específicas de LCDM
  const { data: lcdmTransactionsData } = useQuery({
    queryKey: ["/api/transacciones/lcdm?includeHidden=true"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[0] as string;
      const fullUrl = apiUrl(url);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        console.warn('[LCDM] ⚠️ No token available!');
        removeAuthToken();
        throw new Error('No autenticado');
      }
      
      const response = await fetch(fullUrl, {
        credentials: "include",
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          removeAuthToken();
          throw new Error('No autenticado');
        }
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await parseJsonWithDateInterception(response);
      // El backend devuelve { data: [...], pagination: {...} } o directamente un array si includeHidden=true
      return Array.isArray(data) ? data : (data.data || []);
    },
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: has("module.RODMAR.LCDM.view"), // Solo cargar si tiene permiso
  });
  const lcdmTransactions = lcdmTransactionsData || [];

  // Obtener transacciones específicas de Banco
  const { data: bancoTransactionsData } = useQuery({
    queryKey: ["/api/transacciones/banco?includeHidden=true"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[0] as string;
      const fullUrl = apiUrl(url);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        console.warn('[Banco] ⚠️ No token available!');
        removeAuthToken();
        throw new Error('No autenticado');
      }
      
      const response = await fetch(fullUrl, {
        credentials: "include",
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          removeAuthToken();
          throw new Error('No autenticado');
        }
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await parseJsonWithDateInterception(response);
      // El backend devuelve { data: [...], pagination: {...} } o directamente un array si includeHidden=true
      return Array.isArray(data) ? data : (data.data || []);
    },
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: has("module.RODMAR.Banco.view"), // Solo cargar si tiene permiso
  });

  const bancoTransactions = bancoTransactionsData || [];

  // Obtener transacciones específicas de Postobón
  const { data: postobonTransactionsData } = useQuery({
    queryKey: ["/api/transacciones/postobon?filterType=todas&includeHidden=true"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[0] as string;
      const fullUrl = apiUrl(url);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        console.warn('[Postobón] ⚠️ No token available!');
        removeAuthToken();
        throw new Error('No autenticado');
      }
      
      const response = await fetch(fullUrl, {
        credentials: "include",
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          removeAuthToken();
          throw new Error('No autenticado');
        }
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await parseJsonWithDateInterception(response);
      // El backend devuelve { data: [...], pagination: {...} } o directamente un array si includeHidden=true
      return Array.isArray(data) ? data : (data.data || []);
    },
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: has("module.RODMAR.Postobon.view"), // Solo cargar si tiene permiso
  });
  const postobonTransactions = postobonTransactionsData || [];

  // Obtener cuentas RodMar con balances calculados
  const { data: cuentasRodMar = [], isLoading: isLoadingCuentas, error: errorCuentas } = useQuery({
    queryKey: ["/api/rodmar-accounts"],
    staleTime: 300000, // 5 minutos - datos frescos por más tiempo (consistente con otros módulos)
    refetchOnMount: false, // No recargar al montar
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña
    enabled: activeTab === 'cuentas' || has("module.RODMAR.accounts.view"), // Solo cargar cuando se necesita
  });

  // Debug: verificar qué cuentas se están cargando
  useEffect(() => {
    if (cuentasRodMar) {
      console.log('🔍 [RODMAR] Cuentas cargadas:', cuentasRodMar.length, cuentasRodMar);
    }
    if (errorCuentas) {
      console.error('❌ [RODMAR] Error al cargar cuentas:', errorCuentas);
    }
  }, [cuentasRodMar, errorCuentas]);

  // Función para calcular balance neto de una mina (igual que en minas.tsx)
  const calcularBalanceNetoMina = (minaId: number): number => {
    if (!Array.isArray(viajes) || !Array.isArray(transacciones)) {
      return 0;
    }

    const viajesCompletados = viajes.filter((v: any) => 
      v.fechaDescargue && v.minaId === minaId && v.estado === "completado" && !v.oculta
    );
    
    const transaccionesDinamicas = viajesCompletados.map((viaje: any) => {
      const totalCompra = parseFloat(viaje.totalCompra || "0");
      return {
        valor: totalCompra.toString(),
        isFromTrip: true
      };
    });

    // Obtener transacciones manuales (igual que backend)
    const transaccionesManuales = transacciones.filter((t: any) => {
      if (t.oculta) return false;
      if (t.tipo === "Viaje") return false; // Excluir viajes para evitar doble contabilización
      
      // Comparar como números para consistencia
      const tDeQuienId = parseInt(t.deQuienId) || 0;
      const tParaQuienId = parseInt(t.paraQuienId) || 0;
      
      return (t.deQuienTipo === "mina" && tDeQuienId === minaId) ||
             (t.paraQuienTipo === "mina" && tParaQuienId === minaId);
    });

    // Calcular ingresos de viajes
    const ingresosViajes = transaccionesDinamicas.reduce((sum, t) => sum + parseFloat(t.valor), 0);
    
    // Calcular transacciones netas (igual que backend)
    const transaccionesNetas = transaccionesManuales.reduce((sum, t) => {
      const valor = parseFloat(t.valor || '0');
      const tDeQuienId = parseInt(t.deQuienId) || 0;
      const tParaQuienId = parseInt(t.paraQuienId) || 0;
      
      if (t.deQuienTipo === "mina" && tDeQuienId === minaId) {
        // Transacciones DESDE la mina = ingresos positivos
        return sum + valor;
      } else if (t.paraQuienTipo === "mina" && tParaQuienId === minaId) {
        // Transacciones HACIA la mina = egresos negativos
        return sum - valor;
      } else if (t.paraQuienTipo === "rodmar" || t.paraQuienTipo === "banco") {
        // Transacciones hacia RodMar/Banco = ingresos positivos
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
        // Inversión de perspectiva: lo que es positivo para la mina es negativo para RodMar y viceversa
        if (balance > 0) {
          totalNegativos += balance; // Balance positivo de mina = negativo para RodMar
        } else {
          totalPositivos += Math.abs(balance); // Balance negativo de mina = positivo para RodMar
        }
      });
    }

    return {
      positivos: totalPositivos,
      negativos: totalNegativos,
      balance: totalPositivos - totalNegativos
    };
  };

  // Calcular balance consolidado de compradores (USANDO HOOK COMPARTIDO CON INVERSIÓN DE PERSPECTIVA)
  const calcularBalanceCompradores = () => {
    // Usar exactamente el mismo cálculo del módulo compradores pero con perspectiva invertida
    const balanceOriginal = resumenCompradoresOriginal;
    
    return {
      // Inversión de perspectiva: lo que es positivo para comprador es negativo para RodMar y viceversa
      positivos: balanceOriginal.negativos, // Lo que compradores deben a RodMar = positivo para RodMar
      negativos: balanceOriginal.positivos, // Lo que RodMar debe a compradores = negativo para RodMar
      balance: -balanceOriginal.balance // Inversión simple del balance total
    };
  };

  // Calcular balance consolidado de volqueteros (USANDO HOOK COMPARTIDO CON INVERSIÓN DE PERSPECTIVA)
  const calcularBalanceVolqueteros = () => {
    // Usar exactamente el mismo cálculo del módulo volqueteros pero con perspectiva invertida
    const balanceOriginal = resumenVolqueterosOriginal;
    
    return {
      // Inversión de perspectiva: lo que es positivo para volquetero es negativo para RodMar y viceversa
      positivos: balanceOriginal.negativos, // Lo que volqueteros deben a RodMar = positivo para RodMar
      negativos: balanceOriginal.positivos, // Lo que RodMar debe a volqueteros = negativo para RodMar
      balance: -balanceOriginal.balance // Inversión simple del balance total
    };
  };

  // Calcular balances
  const balanceMinas = calcularBalanceMinas();
  const balanceCompradores = calcularBalanceCompradores();
  const balanceVolqueteros = calcularBalanceVolqueteros();
  
  console.log('=== BALANCE DEBUG ===');
  console.log('Balance original del módulo volqueteros:', resumenVolqueterosOriginal);
  console.log('Balance calculado para RodMar volqueteros (invertido):', balanceVolqueteros);
  console.log('Balance original del módulo compradores:', resumenCompradoresOriginal);
  console.log('Balance calculado para RodMar compradores (invertido):', balanceCompradores);

  if (!stats) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Cargando estadísticas...</div>
      </div>
    );
  }

  // Configuración para gráfico de barras
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

  return (
    <div className="px-4 py-6">


      {/* Header Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <User className="text-primary-foreground w-8 h-8" />
            </div>
            <div>
              <CardTitle className="text-xl">RodMar</CardTitle>
              <p className="text-muted-foreground">Panel de Administración</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`rodmar-tabs grid w-full gap-1 sm:gap-0 p-1 ${
              (() => {
                const visibleTabs = [
                  has("module.RODMAR.accounts.view"), // cuentas
                  has("module.RODMAR.tab.TERCEROS.view"), // terceros
                  has("module.RODMAR.LCDM.view"),
                  has("module.RODMAR.Banco.view"),
                  has("module.RODMAR.Postobon.view"),
                ].filter(Boolean).length;
                return visibleTabs === 1 ? "grid-cols-1" :
                       visibleTabs === 2 ? "grid-cols-2" :
                       visibleTabs === 3 ? "grid-cols-3" :
                       visibleTabs === 4 ? "grid-cols-4" :
                       visibleTabs === 5 ? "grid-cols-5" : "grid-cols-6";
              })()
            }`}>
              {has("module.RODMAR.accounts.view") && (
                <>
                  <TabsTrigger value="cuentas" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
                    Cuentas
                  </TabsTrigger>
                  <TabsTrigger value="terceros" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
                    Terceros
                  </TabsTrigger>
                </>
              )}
              {has("module.RODMAR.LCDM.view") && (
                <TabsTrigger value="lcdm" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
                  LCDM
                </TabsTrigger>
              )}
              {has("module.RODMAR.Banco.view") && (
                <TabsTrigger value="banco" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
                  Banco
                </TabsTrigger>
              )}
              {has("module.RODMAR.Postobon.view") && (
                <TabsTrigger value="postobon" className="text-xs sm:text-sm px-2 py-1.5 sm:px-4 sm:py-2">
                  Postobón
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab: Cuentas */}
            <TabsContent value="cuentas" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Cuentas RodMar</h3>
                  </div>
                  {has("module.RODMAR.accounts.view") && (
                    <Button 
                      onClick={() => setShowAddCuentaModal(true)} 
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nueva Cuenta
                    </Button>
                  )}
                </div>
                
                {/* Lista de Cuentas - Formato Compacto y Uniforme */}
                <div className="space-y-2">
                  {cuentasRodMar.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No hay cuentas registradas</p>
                      </CardContent>
                    </Card>
                  ) : (
                    cuentasRodMar.map((cuenta: any) => (
                      <ContextMenu key={cuenta.id || cuenta.cuenta}>
                        <ContextMenuTrigger asChild>
                          <Card className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                onClick={() => {
                                  // Usar ID si está disponible, sino usar nombre legacy
                                  const cuentaId = cuenta.id || cuenta.cuenta.toLowerCase().replace(/\s+/g, '-');
                                  setLocation(`/rodmar/cuenta/${encodeURIComponent(cuentaId)}`);
                                }}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-blue-600" />
                                  <h4 className="font-medium text-foreground text-sm">{cuenta.cuenta || cuenta.nombre}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <p className={`text-sm font-bold ${
                                      (cuenta.balance || 0) > 0 ? 'text-green-600' : 
                                      (cuenta.balance || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                      {formatCurrency(cuenta.balance || 0)}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCuenta(cuenta);
                              setShowEditCuentaModal(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar nombre
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCuenta(cuenta);
                              setShowDeleteCuentaModal(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Terceros */}
            <TabsContent value="terceros" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Terceros</h3>
                  </div>
                  {has("module.RODMAR.accounts.view") && (
                    <Button 
                      onClick={() => setShowAddTerceroModal(true)} 
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nuevo Tercero
                    </Button>
                  )}
                </div>
                
                {/* Lista de Terceros - Formato Compacto y Uniforme */}
                <div className="space-y-2">
                  {terceros.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No hay terceros registrados</p>
                      </CardContent>
                    </Card>
                  ) : (
                    terceros.map((tercero: any) => (
                      <ContextMenu key={tercero.id}>
                        <ContextMenuTrigger asChild>
                          <Card className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                onClick={() => setLocation(`/terceros/${tercero.id}`)}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-blue-600" />
                                  <h4 className="font-medium text-foreground text-sm">{tercero.nombre}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <p className={`text-sm font-bold ${
                                      (tercero.balance || 0) > 0 ? 'text-green-600' : 
                                      (tercero.balance || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                      {formatCurrency(tercero.balance || 0)}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTercero(tercero);
                              setShowEditTerceroModal(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar nombre
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTercero(tercero);
                              setShowDeleteTerceroModal(true);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: LCDM */}
            <TabsContent value="lcdm" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-foreground">La Casa del Motero</h3>
                </div>

                {/* Subpestañas de LCDM */}
                <Tabs defaultValue="transacciones" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
                    <TabsTrigger value="balance">Balance</TabsTrigger>
                  </TabsList>

                  {/* Subpestaña: Transacciones LCDM */}
                  <TabsContent value="transacciones" className="mt-4">
                    <LcdmTransactionsTab transactions={lcdmTransactions || []} />
                  </TabsContent>

                  {/* Subpestaña: Balance LCDM */}
                  <TabsContent value="balance" className="mt-4">
                    <LcdmBalanceTab transactions={lcdmTransactions || []} />
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>

            {/* Tab: Banco */}
            {has("module.RODMAR.Banco.view") && (
              <TabsContent value="banco" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Banknote className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Banco</h3>
                  </div>

                  {/* Transacciones Banco (sin subpestañas) */}
                  <BancoTransactionsTab transactions={bancoTransactions || []} />
                </div>
              </TabsContent>
            )}

            {/* Tab: Postobón */}
            <TabsContent value="postobon" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-foreground">Postobón</h3>
                </div>

                {/* Subpestañas de Postobón */}
                <Tabs defaultValue="todas" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="todas">Todas</TabsTrigger>
                    <TabsTrigger value="santa-rosa">Santa Rosa</TabsTrigger>
                    <TabsTrigger value="cimitarra">Cimitarra</TabsTrigger>
                    <TabsTrigger value="balance">Balance</TabsTrigger>
                  </TabsList>

                  {/* Subpestaña: Todas las cuentas Postobón */}
                  <TabsContent value="todas" className="mt-4">
                    <PostobonTransactionsTab 
                      title="Todas las Cuentas Postobón"
                      filterType="todas"
                      transactions={postobonTransactions || []}
                    />
                  </TabsContent>

                  {/* Subpestaña: Santa Rosa */}
                  <TabsContent value="santa-rosa" className="mt-4">
                    <PostobonTransactionsTab 
                      title="Santa Rosa"
                      filterType="santa-rosa"
                      transactions={postobonTransactions || []}
                      onOpenInvestmentModal={(subpestana) => {
                        setSelectedSubAccount(subpestana);
                        setShowInvestmentModal(true);
                      }}
                    />
                  </TabsContent>

                  {/* Subpestaña: Cimitarra */}
                  <TabsContent value="cimitarra" className="mt-4">
                    <PostobonTransactionsTab 
                      title="Cimitarra"
                      filterType="cimitarra"
                      transactions={postobonTransactions || []}
                      onOpenInvestmentModal={(subpestana) => {
                        setSelectedSubAccount(subpestana);
                        setShowInvestmentModal(true);
                      }}
                    />
                  </TabsContent>

                  {/* Subpestaña: Balance General */}
                  <TabsContent value="balance" className="mt-4">
                    <PostobonBalanceTab transactions={postobonTransactions || []} />
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>

      {/* Modal de Inversiones */}
      <InvestmentModal
        isOpen={showInvestmentModal}
        onClose={() => {
          setShowInvestmentModal(false);
          setSelectedSubAccount("");
        }}
        subpestana={selectedSubAccount}
      />

      {/* Modal para crear nuevo tercero */}
      <AddTerceroModal 
        open={showAddTerceroModal} 
        onOpenChange={setShowAddTerceroModal}
      />

      {/* Modal para editar tercero */}
      <EditTerceroModal
        open={showEditTerceroModal}
        onOpenChange={setShowEditTerceroModal}
        tercero={selectedTercero}
      />

      {/* Modal para eliminar tercero */}
      <DeleteTerceroModal
        open={showDeleteTerceroModal}
        onOpenChange={setShowDeleteTerceroModal}
        tercero={selectedTercero}
      />

      {/* Modales para cuentas RodMar */}
      <AddRodmarCuentaModal
        open={showAddCuentaModal}
        onOpenChange={setShowAddCuentaModal}
      />

      <EditRodmarCuentaModal
        open={showEditCuentaModal}
        onOpenChange={setShowEditCuentaModal}
        cuenta={selectedCuenta}
      />

      <DeleteRodmarCuentaModal
        open={showDeleteCuentaModal}
        onOpenChange={setShowDeleteCuentaModal}
        cuenta={selectedCuenta}
      />
    </div>
  );
}

// Componente para mostrar transacciones de Postobón filtradas por cuenta con diseño idéntico a Minas
function PostobonTransactionsTab({ title, filterType, transactions, onOpenInvestmentModal }: {
  title: string;
  filterType: 'todas' | 'santa-rosa' | 'cimitarra';
  transactions: any[];
  onOpenInvestmentModal?: (subpestana: string) => void;
}) {
  // Estados de filtrado idénticos a LCDM y Minas
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaFilterType, setFechaFilterType] = useState<DateFilterType>("todos");
  const [fechaFilterValue, setFechaFilterValue] = useState("");
  const [fechaFilterValueEnd, setFechaFilterValueEnd] = useState("");
  const [sortByFecha, setSortByFecha] = useState<"ninguno" | "asc" | "desc">("desc");
  const [sortByValor, setSortByValor] = useState<"ninguno" | "asc" | "desc">("ninguno");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');

  // Estado para modal de imagen
  const [showImageModal, setShowImageModal] = useState(false);

  // Paginación con memoria en localStorage
  const { currentPage, setCurrentPage, pageSize, setPageSize, getLimitForServer } = usePagination({
    storageKey: "postobon-transactions-pageSize",
    defaultPageSize: 50,
  });

  // Estados para transacciones temporales - Como en LCDM
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<any[]>([]);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook para manejar transacciones ocultas de forma local y temporal
  const {
    hideTransaction: hideTransactionLocal,
    showAllHidden: showAllHiddenLocal,
    getHiddenCount: getHiddenTransactionsCount,
    filterVisible: filterVisibleTransactions,
  } = useHiddenTransactions(`postobon-${filterType}`);

  // Estados para modales de acciones
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Función para obtener rangos de fecha (debe estar antes de su uso en useMemo)
  const getDateRange = useCallback((type: DateFilterType, value?: string, valueEnd?: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (type) {
      case "hoy":
        return { start: todayStr, end: todayStr };
      case "ayer":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return { start: yesterdayStr, end: yesterdayStr };
      case "esta-semana":
        const startOfWeek = new Date(today);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        return { start: startOfWeek.toISOString().split('T')[0], end: todayStr };
      case "semana-pasada":
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        return { start: lastWeekStart.toISOString().split('T')[0], end: lastWeekEnd.toISOString().split('T')[0] };
      case "este-mes":
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: startOfMonth.toISOString().split('T')[0], end: todayStr };
      case "mes-pasado":
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: lastMonthStart.toISOString().split('T')[0], end: lastMonthEnd.toISOString().split('T')[0] };
      case "este-año":
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        return { start: startOfYear.toISOString().split('T')[0], end: todayStr };
      case "año-pasado":
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        return { start: lastYearStart.toISOString().split('T')[0], end: lastYearEnd.toISOString().split('T')[0] };
      case "exactamente":
        return value ? { start: value, end: value } : null;
      case "entre":
        return value && valueEnd ? { start: value, end: valueEnd } : null;
      case "despues-de":
        return value ? { start: value, end: "9999-12-31" } : null;
      case "antes-de":
        return value ? { start: "1900-01-01", end: value } : null;
      default:
        return null;
    }
  }, []);

  // Calcular fechaDesde y fechaHasta para filtrado client-side
  const dateRange = useMemo(() => {
    if (fechaFilterType === "exactamente" && fechaFilterValue) {
      return { start: fechaFilterValue, end: fechaFilterValue };
    } else if (fechaFilterType === "entre" && fechaFilterValue && fechaFilterValueEnd) {
      return { start: fechaFilterValue, end: fechaFilterValueEnd };
    } else if (fechaFilterType === "despues-de" && fechaFilterValue) {
      return { start: fechaFilterValue, end: "9999-12-31" };
    } else if (fechaFilterType === "antes-de" && fechaFilterValue) {
      return { start: "1900-01-01", end: fechaFilterValue };
    } else if (fechaFilterType !== "todos") {
      const range = getDateRange(fechaFilterType);
      if (range) {
        // Si range ya devuelve strings, usarlos directamente
        if (typeof range.start === 'string' && typeof range.end === 'string') {
          return range;
        }
        // Si devuelve Date objects, formatearlos
        const formatDate = (date: Date): string => {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };
        return {
          start: formatDate(range.start),
          end: formatDate(range.end)
        };
      }
    }
    return null;
  }, [fechaFilterType, fechaFilterValue, fechaFilterValueEnd, getDateRange]);

  // Obtener transacciones de Postobón con paginación del servidor (sin filtros)
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
      "/api/transacciones/postobon", 
      currentPage, 
      pageSize,
      filterType // Mantener filterType porque es específico de Postobón (todas, santa-rosa, cimitarra)
    ],
    queryFn: async () => {
      // Solo enviar paginación y filterType al servidor (sin otros filtros)
      const limit = getLimitForServer();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        filterType: filterType,
      });
      
      const url = apiUrl(`/api/transacciones/postobon?${params.toString()}`);
      console.log('[Postobón] Fetching transactions from:', url);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        credentials: "include",
        headers,
      });
      console.log('[Postobón] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('[Postobón] Error response:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Postobón] Transactions received:', data?.data?.length || 0);
      return data;
    },
    staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const allBaseFilteredTransactions = transactionsData?.data || [];
  const pagination = transactionsData?.pagination;
  const hiddenPostobonCount = getHiddenTransactionsCount();

  // Filtrado client-side sobre la página activa
  const baseFilteredTransactions = useMemo(() => {
    let filtered = [...allBaseFilteredTransactions];

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

    // Filtro de fecha
    if (dateRange) {
      filtered = filtered.filter(t => {
        const fechaTrans = new Date(t.fecha);
        const fechaInicio = new Date(dateRange.start);
        const fechaFin = new Date(dateRange.end);
        return fechaTrans >= fechaInicio && fechaTrans <= fechaFin;
      });
    }

    // Filtro de balance (positivos/negativos) - Postobón: positivos = desde Postobón, negativos = hacia Postobón
    if (balanceFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (balanceFilter === 'positivos') {
          return t.deQuienTipo === 'postobon';
        } else if (balanceFilter === 'negativos') {
          return t.paraQuienTipo === 'postobon';
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
  }, [allBaseFilteredTransactions, searchTerm, dateRange, sortByFecha, sortByValor, balanceFilter]);

  // Prefetching automático en segundo plano (solo si no está en modo "todo")
  useEffect(() => {
    if (pagination && currentPage === 1 && pagination.totalPages > 1 && pageSize !== "todo") {
      const prefetchPages = Math.min(pagination.totalPages, 10);
      setTimeout(() => {
        for (let page = 2; page <= prefetchPages; page++) {
          const limit = getLimitForServer();
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            filterType: filterType,
          });
          
          queryClient.prefetchQuery({
            queryKey: [
              "/api/transacciones/postobon", 
              page, 
              typeof pageSize === "number" ? pageSize : 999999,
              filterType
            ],
            queryFn: async () => {
              const { getAuthToken } = await import('@/hooks/useAuth');
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
              const response = await fetch(apiUrl(`/api/transacciones/postobon?${params.toString()}`), {
                credentials: "include",
                headers,
              });
              if (!response.ok) throw new Error('Error al obtener transacciones');
              return response.json();
            },
            staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
          });
        }
      }, 100);
    }
  }, [pagination, currentPage, pageSize, filterType, queryClient, searchTerm, fechaFilterType]);

  // Función para manejar envío de transacción temporal (idéntica a LCDM)
  const handleTemporalSubmit = (formData: any) => {
    const nuevaTransacionTemporal = {
      id: `temporal-${Date.now()}`,
      fecha: formData.fecha || new Date().toISOString().split('T')[0],
      concepto: formData.concepto,
      valor: formData.valor,
      deQuienTipo: formData.deQuienTipo,
      deQuienId: formData.deQuienId,
      paraQuienTipo: formData.paraQuienTipo,
      paraQuienId: formData.paraQuienId,
      comentario: formData.comentario || "",
      tipo: "Temporal",
      voucher: formData.voucher || "",
      formaPago: formData.formaPago || "",
      createdAt: new Date().toISOString(),
      horaInterna: new Date().toISOString(),
      tipoSocio: "postobon" as const,
      socioId: "postobon"
    };

    setTransaccionesTemporales(prev => [...prev, nuevaTransacionTemporal]);
    setShowTemporalTransaction(false);
    
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

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fechaFilterType, fechaFilterValue, fechaFilterValueEnd, filterType]);

  // Combinar transacciones normales con temporales y filtrar las ocultas localmente
  const todasLasTransacciones = useMemo(() => {
    return [...baseFilteredTransactions, ...transaccionesTemporales];
  }, [baseFilteredTransactions, transaccionesTemporales]);

  // Filtrar transacciones ocultas localmente
  const transaccionesFiltradas = useMemo(() => {
    return filterVisibleTransactions(todasLasTransacciones);
  }, [todasLasTransacciones, filterVisibleTransactions]);

  return (
    <div className="space-y-3">
      {/* Encabezado compacto de transacciones optimizado para móviles - Estilo idéntico a Minas */}
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
        <CardContent className="p-2 sm:p-4">
          <div className="flex flex-col gap-2">
            {/* Primera línea: Título e icono */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 sm:p-2 bg-yellow-100 rounded-lg">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-yellow-900">Transacciones {title}</h3>
                  <p className="text-xs sm:text-sm text-yellow-600 hidden sm:block">Historial financiero Postobón</p>
                </div>
              </div>
            </div>
            
            {/* Segunda línea: Contador de registros y botones adicionales */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-yellow-700 font-medium text-xs sm:text-sm">{transaccionesFiltradas.length} registros</span>
              </div>
              
              {/* Botones de inversión, imagen y temporal en segunda línea */}
              <div className="flex items-center gap-1">
                {/* Botón de inversión solo para Santa Rosa y Cimitarra */}
                {(filterType === 'santa-rosa' || filterType === 'cimitarra') && onOpenInvestmentModal && (
                  <Button 
                    size="sm" 
                    onClick={() => onOpenInvestmentModal(filterType)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white flex items-center gap-1"
                  >
                    <Banknote className="w-3 h-3" />
                    <span className="hidden sm:inline">Nueva Inversión</span>
                    <span className="sm:hidden">Inv</span>
                  </Button>
                )}

                {/* Botón de imagen */}
                <Button
                  size="sm"
                  onClick={() => setShowImageModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1"
                  title={`Descargar imagen de transacciones (máximo 100)`}
                >
                  <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Imagen</span>
                  <span className="sm:hidden">IMG</span>
                </Button>

                {/* Botón de transacción temporal - Como en LCDM */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemporalTransaction(true)}
                  className="bg-orange-50 hover:bg-orange-100 border-orange-600 text-orange-600 h-8 px-3 text-xs flex items-center gap-1"
                  title="Agregar transacción temporal"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>TEMP</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controles de filtros optimizados para móviles - Idéntico a Minas */}
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
                <Select value={fechaFilterType} onValueChange={(value: DateFilterType) => setFechaFilterType(value)}>
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

                {/* Botón mostrar ocultas - Postobón */}
                {hiddenPostobonCount > 0 ? (
                  <Button
                    onClick={handleShowAllHidden}
                    size="sm"
                    className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs"
                    title={`Mostrar ${hiddenPostobonCount} transacciones ocultas`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {hiddenPostobonCount}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Segunda fila solo cuando se necesiten inputs de fecha */}
            {(fechaFilterType === "exactamente" || fechaFilterType === "entre" || fechaFilterType === "despues-de" || fechaFilterType === "antes-de") && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={fechaFilterValue}
                  onChange={(e) => setFechaFilterValue(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                {fechaFilterType === "entre" && (
                  <Input
                    type="date"
                    value={fechaFilterValueEnd}
                    onChange={(e) => setFechaFilterValueEnd(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Balance dinámico basado en transacciones filtradas - CORREGIDO: considerar origen Postobón como positivo */}
      {(() => {
        const positivos = transaccionesFiltradas.filter(t => t.deQuienTipo === 'postobon');
        const negativos = transaccionesFiltradas.filter(t => t.paraQuienTipo === 'postobon');

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
                  className={`rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${balance >= 0 ? 'bg-green-100' : 'bg-red-100'} ${
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

      {/* Lista de transacciones con tarjetas - Estilo idéntico a Minas */}
      {transaccionesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ShoppingCart className="mx-auto h-12 w-12 mb-2" />
            <p>No hay transacciones para {title}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transaccionesFiltradas.map((transaccion) => (
            <Card 
              key={transaccion.id} 
              className="border border-gray-200 transition-colors cursor-pointer hover:bg-gray-50"
              onClick={() => {
                if (transaccion.tipo !== "Temporal") {
                  setSelectedTransaction(transaccion);
                  setShowDetailModal(true);
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
                      {transaccion.tipo === "Temporal" ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-orange-600 border-orange-600">T</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">M</Badge>
                      )}
                      {transaccion.postobonCuenta && (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                          {transaccion.postobonCuenta === 'santa-rosa' ? 'SR' : 
                           transaccion.postobonCuenta === 'cimitarra' ? 'CIM' : 'OTR'}
                        </Badge>
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

                  {/* Lado derecho: Valor y botones de acción */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                      transaccion.paraQuienTipo === 'postobon' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(() => {
                        const valor = parseFloat(transaccion.valor || '0');
                        const valorText = transaccion.paraQuienTipo === 'postobon' ? 
                          `-$ ${valor.toLocaleString()}` : 
                          `+$ ${valor.toLocaleString()}`;
                        return highlightValue(valorText, searchTerm);
                      })()}
                    </span>

                    {/* Botones de acción para transacciones manuales */}
                    {transaccion.tipo !== "Temporal" && typeof transaccion.id === 'number' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-blue-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransaction(transaccion);
                            setShowEditModal(true);
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
                            setShowDeleteModal(true);
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
                            if (typeof transaccion.id === 'number') {
                              handleHideTransaction(transaccion.id);
                            }
                          }}
                          title="Ocultar transacción"
                        >
                          <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                        </Button>
                      </div>
                    ) : transaccion.tipo === "Temporal" ? (
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className="bg-orange-50 border-orange-200 text-orange-700 text-xs px-1 py-0 h-4"
                        >
                          T
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemporalTransaction(transaccion.id);
                          }}
                          className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                          title="Eliminar transacción temporal"
                        >
                          <X className="w-2.5 h-2.5 text-red-600" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Controles de paginación - Mostrar siempre, incluso con filtros */}
      {pagination && (
        <div className="py-4">
          <PaginationControls
            page={currentPage}
            limit={pageSize}
            total={transaccionesFiltradas.length} // Mostrar total de transacciones filtradas en la página actual
            totalPages={pagination.totalPages}
            hasMore={pagination.hasMore}
            onPageChange={(newPage) => {
              setCurrentPage(newPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit);
            }}
            limitOptions={[10, 20, 50, 100, 200, 500, 1000]}
          />
        </div>
      )}

      {/* Modal de imagen descargable */}
      <RodmarTransaccionesImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        transactions={transaccionesFiltradas.slice(0, 100)}
        title={`Transacciones ${title}`}
        subtitle={(() => {
          if (fechaFilterType === 'todos') return 'Todas las transacciones';
          if (fechaFilterType === 'hoy') return 'Transacciones de hoy';
          if (fechaFilterType === 'ayer') return 'Transacciones de ayer';
          if (fechaFilterType === 'esta-semana') return 'Transacciones de esta semana';
          if (fechaFilterType === 'semana-pasada') return 'Transacciones de la semana pasada';
          if (fechaFilterType === 'este-mes') return 'Transacciones de este mes';
          if (fechaFilterType === 'mes-pasado') return 'Transacciones del mes pasado';
          if (fechaFilterType === 'este-año') return 'Transacciones de este año';
          if (fechaFilterType === 'año-pasado') return 'Transacciones del año pasado';
          if (fechaFilterType === 'exactamente' && fechaFilterValue) return `Transacciones del ${fechaFilterValue}`;
          if (fechaFilterType === 'entre' && fechaFilterValue && fechaFilterValueEnd) return `Transacciones entre ${fechaFilterValue} y ${fechaFilterValueEnd}`;
          if (fechaFilterType === 'despues-de' && fechaFilterValue) return `Transacciones después del ${fechaFilterValue}`;
          if (fechaFilterType === 'antes-de' && fechaFilterValue) return `Transacciones antes del ${fechaFilterValue}`;
          return 'Transacciones filtradas';
        })()}
        accountType="postobon"
      />

      {/* Modal de Nueva Transacción Temporal - Como en LCDM */}
      <NewTransactionModal
        open={showTemporalTransaction}
        onClose={() => setShowTemporalTransaction(false)}
        onTemporalSubmit={handleTemporalSubmit}
        isTemporalMode={true}
      />

      {/* Modales de acciones */}
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

      <TransactionDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        transaction={selectedTransaction}
      />
    </div>
  );
}

// Componente para mostrar balance consolidado de todas las cuentas Postobón
function PostobonBalanceTab({ transactions }: { transactions: any[] }) {
  const postobonTransactions = transactions.filter(transaction => 
    transaction.deQuienTipo === 'postobon' || transaction.paraQuienTipo === 'postobon'
  );

  // Separar por cuenta
  const santaRosaTransactions = postobonTransactions.filter(t => t.postobonCuenta === 'santa-rosa');
  const cimitarraTransactions = postobonTransactions.filter(t => t.postobonCuenta === 'cimitarra');
  const otrasTransactions = postobonTransactions.filter(t => t.postobonCuenta === 'otras');

  // Función para calcular balance de una cuenta - CORREGIDO: considerar todas las transacciones con origen Postobón como positivas
  const calculateBalance = (txs: any[]) => {
    const positivos = txs
      .filter(t => t.deQuienTipo === 'postobon')
      .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
    const negativos = txs
      .filter(t => t.paraQuienTipo === 'postobon')
      .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
    return { positivos, negativos, balance: positivos - negativos, total: txs.length };
  };

  const santaRosa = calculateBalance(santaRosaTransactions);
  const cimitarra = calculateBalance(cimitarraTransactions);
  const otras = calculateBalance(otrasTransactions);
  const total = calculateBalance(postobonTransactions);

  return (
    <div className="space-y-4">
      {/* Balance Total Consolidado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            Balance Consolidado Postobón
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="bg-green-50 p-2 rounded text-center">
              <p className="text-xs text-green-700">Positivos</p>
              <p className="text-sm font-bold text-green-700">+{formatCurrency(total.positivos)}</p>
            </div>
            <div className="bg-red-50 p-2 rounded text-center">
              <p className="text-xs text-red-700">Negativos</p>
              <p className="text-sm font-bold text-red-700">-{formatCurrency(total.negativos)}</p>
            </div>
            <div className="bg-blue-50 p-2 rounded text-center">
              <p className="text-xs text-blue-700">Balance</p>
              <p className="text-sm font-bold text-blue-700">{formatCurrency(total.balance)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded text-center">
              <p className="text-xs text-gray-700">Total</p>
              <p className="text-sm font-bold text-gray-700">{total.total} transacciones</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desglose por Cuenta */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Desglose por Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Santa Rosa */}
            <div className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Santa Rosa</h4>
                <Badge variant="outline">{santaRosa.total} transacciones</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-green-700">+{formatCurrency(santaRosa.positivos)}</p>
                </div>
                <div className="text-center">
                  <p className="text-red-700">-{formatCurrency(santaRosa.negativos)}</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-700 font-bold">{formatCurrency(santaRosa.balance)}</p>
                </div>
              </div>
            </div>

            {/* Cimitarra */}
            <div className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Cimitarra</h4>
                <Badge variant="outline">{cimitarra.total} transacciones</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-green-700">+{formatCurrency(cimitarra.positivos)}</p>
                </div>
                <div className="text-center">
                  <p className="text-red-700">-{formatCurrency(cimitarra.negativos)}</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-700 font-bold">{formatCurrency(cimitarra.balance)}</p>
                </div>
              </div>
            </div>

            {/* Otras */}
            <div className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Otras</h4>
                <Badge variant="outline">{otras.total} transacciones</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-green-700">+{formatCurrency(otras.positivos)}</p>
                </div>
                <div className="text-center">
                  <p className="text-red-700">-{formatCurrency(otras.negativos)}</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-700 font-bold">{formatCurrency(otras.balance)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente para mostrar transacciones de LCDM con controles idénticos a Minas
function LcdmTransactionsTab({ transactions }: { transactions: any[] }) {
  // Estados para filtros y ordenamiento idénticos a Minas
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaFilterType, setFechaFilterType] = useState<DateFilterType>("todos");
  const [fechaFilterValue, setFechaFilterValue] = useState("");
  const [fechaFilterValueEnd, setFechaFilterValueEnd] = useState("");
  const [sortByFecha, setSortByFecha] = useState<"asc" | "desc" | "ninguno">("desc");
  const [sortByValor, setSortByValor] = useState<"asc" | "desc" | "ninguno">("ninguno");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');
  
  // Paginación con memoria en localStorage
  const { currentPage, setCurrentPage, pageSize, setPageSize, getLimitForServer } = usePagination({
    storageKey: "lcdm-transactions-pageSize",
    defaultPageSize: 50,
  });
  
  // Estado para modal de imagen
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Estados para transacciones temporales - Como en minas
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<any[]>([]);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook para manejar transacciones ocultas de forma local y temporal
  const {
    hideTransaction: hideTransactionLocal,
    showAllHidden: showAllHiddenLocal,
    getHiddenCount: getHiddenTransactionsCount,
    filterVisible: filterVisibleTransactions,
  } = useHiddenTransactions('lcdm');

  // Estados para modales de acciones
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Usar función centralizada directamente (ya devuelve strings YYYY-MM-DD)
  const dateRange = useMemo(() => {
    return getDateRangeFromFilter(fechaFilterType, fechaFilterValue, fechaFilterValueEnd);
  }, [fechaFilterType, fechaFilterValue, fechaFilterValueEnd]);

  // Obtener transacciones de LCDM con paginación del servidor (sin filtros)
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
      "/api/transacciones/lcdm", 
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
      
      const url = apiUrl(`/api/transacciones/lcdm?${params.toString()}`);
      console.log('[LCDM] Fetching transactions from:', url);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        credentials: "include",
        headers,
      });
      console.log('[LCDM] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('[LCDM] Error response:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[LCDM] Transactions received:', data?.data?.length || 0);
      return data;
    },
    staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const allLcdmTransactions = transactionsData?.data || [];
  const pagination = transactionsData?.pagination;
  const hiddenLcdmCount = getHiddenTransactionsCount();

  // Filtrado client-side sobre la página activa
  const lcdmTransactions = useMemo(() => {
    let filtered = [...allLcdmTransactions];

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

    // Filtro de balance (positivos/negativos) - LCDM: positivos = desde LCDM, negativos = hacia LCDM
    if (balanceFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (balanceFilter === 'positivos') {
          return t.deQuienTipo === 'lcdm';
        } else if (balanceFilter === 'negativos') {
          return t.paraQuienTipo === 'lcdm';
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
  }, [allLcdmTransactions, searchTerm, dateRange, sortByFecha, sortByValor, balanceFilter]);

  // Prefetching automático en segundo plano (solo si no está en modo "todo")
  useEffect(() => {
    if (pagination && currentPage === 1 && pagination.totalPages > 1 && pageSize !== "todo") {
      const prefetchPages = Math.min(pagination.totalPages, 10);
      setTimeout(() => {
        for (let page = 2; page <= prefetchPages; page++) {
          const limit = getLimitForServer();
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
          });
          
          queryClient.prefetchQuery({
            queryKey: [
              "/api/transacciones/lcdm", 
              page, 
              typeof pageSize === "number" ? pageSize : 999999
            ],
            queryFn: async () => {
              const { getAuthToken } = await import('@/hooks/useAuth');
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
              const response = await fetch(apiUrl(`/api/transacciones/lcdm?${params.toString()}`), {
                credentials: "include",
                headers,
              });
              if (!response.ok) throw new Error('Error al obtener transacciones');
              return response.json();
            },
            staleTime: 300000,
          });
        }
      }, 100);
    }
  }, [pagination, currentPage, pageSize, queryClient, getLimitForServer]);

  // Función para manejar transacciones temporales - Como en minas
  const handleTemporalSubmit = (formData: any) => {
    const nuevaTransacionTemporal = {
      id: `temporal-${Date.now()}`,
      fecha: formData.fecha,
      concepto: formData.concepto || "Transacción temporal",
      valor: formData.valor,
      deQuienTipo: formData.deQuienTipo,
      deQuienId: formData.deQuienId,
      paraQuienTipo: formData.paraQuienTipo,
      paraQuienId: formData.paraQuienId,
      comentario: formData.comentario || "",
      tipo: "Temporal",
      voucher: formData.voucher || "",
      formaPago: formData.formaPago || "",
      createdAt: new Date().toISOString(),
      horaInterna: new Date().toISOString(),
      tipoSocio: "lcdm" as const,
      socioId: "lcdm"
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


  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fechaFilterType, fechaFilterValue, fechaFilterValueEnd]);

  // Combinar transacciones normales con temporales y filtrar las ocultas localmente
  const todasLasTransacciones = useMemo(() => {
    return [...lcdmTransactions, ...transaccionesTemporales];
  }, [lcdmTransactions, transaccionesTemporales]);

  // Filtrar transacciones ocultas localmente
  const transaccionesFiltradas = useMemo(() => {
    return filterVisibleTransactions(todasLasTransacciones);
  }, [todasLasTransacciones, filterVisibleTransactions]);

  return (
    <div className="space-y-3">
      {/* Encabezado compacto de transacciones optimizado para móviles - Estilo idéntico a Minas */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-2 sm:p-4">
          <div className="flex flex-col gap-2">
            {/* Primera línea: Título */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 sm:p-2 bg-emerald-100 rounded-lg">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-emerald-900">Transacciones LCDM</h3>
                  <p className="text-xs sm:text-sm text-emerald-600 hidden sm:block">Historial financiero con La Casa del Motero</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Botón de descarga de imagen */}
              <Button
                onClick={() => setShowImageModal(true)}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1"
                title={`Descargar imagen (máx. 100 de ${transaccionesFiltradas.length} transacciones)`}
              >
                <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Imagen</span>
                <span className="sm:hidden">IMG</span>
              </Button>

                {/* Botón de transacción temporal - Como en minas */}
                <Button
                  onClick={() => setShowTemporalTransaction(true)}
                  size="sm"
                  variant="outline"
                  className="bg-orange-50 hover:bg-orange-100 border-orange-600 text-orange-600 h-8 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>TEMP</span>
                </Button>
              </div>
            </div>
            
            {/* Segunda línea: Contador de registros */}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-emerald-700 font-medium text-xs sm:text-sm">{transaccionesFiltradas.length} registros</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controles de filtros optimizados para móviles - Idéntico a Minas */}
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
                <Select value={fechaFilterType} onValueChange={(value: DateFilterType) => setFechaFilterType(value)}>
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

                {/* Botón mostrar ocultas - LCDM */}
                {hiddenLcdmCount > 0 ? (
                  <Button
                    onClick={handleShowAllHidden}
                    size="sm"
                    className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs"
                    title={`Mostrar ${hiddenLcdmCount} transacciones ocultas`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {hiddenLcdmCount}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Segunda fila solo cuando se necesiten inputs de fecha */}
            {(fechaFilterType === "exactamente" || fechaFilterType === "entre" || fechaFilterType === "despues-de" || fechaFilterType === "antes-de") && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={fechaFilterValue}
                  onChange={(e) => setFechaFilterValue(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                {fechaFilterType === "entre" && (
                  <Input
                    type="date"
                    value={fechaFilterValueEnd}
                    onChange={(e) => setFechaFilterValueEnd(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Balance dinámico basado en transacciones filtradas - CORREGIDO: considerar origen LCDM como positivo */}
      {(() => {
        const positivos = transaccionesFiltradas.filter(t => t.deQuienTipo === 'lcdm');
        const negativos = transaccionesFiltradas.filter(t => t.paraQuienTipo === 'lcdm');

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
                  className={`rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${balance >= 0 ? 'bg-green-100' : 'bg-red-100'} ${
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

      {/* Lista de transacciones con tarjetas - Estilo idéntico a Minas */}
      {transaccionesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="mx-auto h-12 w-12 mb-2" />
            <p>No hay transacciones con LCDM</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transaccionesFiltradas.map((transaccion) => (
            <Card 
              key={transaccion.id} 
              className="border border-gray-200 transition-colors cursor-pointer hover:bg-gray-50"
              onClick={() => {
                if (transaccion.tipo !== "Temporal") {
                  setSelectedTransaction(transaccion);
                  setShowDetailModal(true);
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
                      {transaccion.tipo === "Temporal" ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-orange-600 border-orange-600">T</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">M</Badge>
                      )}
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                        {transaccion.deQuienTipo === 'lcdm' ? 'L→R' : 'R→L'}
                      </Badge>
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

                  {/* Lado derecho: Valor y botones de acción */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                      transaccion.paraQuienTipo === 'lcdm' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(() => {
                        const valor = parseFloat(transaccion.valor || '0');
                        const valorText = transaccion.paraQuienTipo === 'lcdm' ? 
                          `-$ ${valor.toLocaleString()}` : 
                          `+$ ${valor.toLocaleString()}`;
                        return highlightValue(valorText, searchTerm);
                      })()}
                    </span>

                    {/* Botones de acción para transacciones manuales */}
                    {transaccion.tipo !== "Temporal" && typeof transaccion.id === 'number' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-blue-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransaction(transaccion);
                            setShowEditModal(true);
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
                            setShowDeleteModal(true);
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
                            if (typeof transaccion.id === 'number') {
                              handleHideTransaction(transaccion.id);
                            }
                          }}
                          title="Ocultar transacción"
                        >
                          <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                        </Button>
                      </div>
                    ) : transaccion.tipo === "Temporal" ? (
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className="bg-orange-50 border-orange-200 text-orange-700 text-xs px-1 py-0 h-4"
                        >
                          T
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemporalTransaction(transaccion.id);
                          }}
                          className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                          title="Eliminar transacción temporal"
                        >
                          <X className="w-2.5 h-2.5 text-red-600" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Controles de paginación - Mostrar siempre, incluso con filtros */}
      {pagination && (
        <div className="py-4">
          <PaginationControls
            page={currentPage}
            limit={pageSize}
            total={transaccionesFiltradas.length} // Mostrar total de transacciones filtradas en la página actual
            totalPages={pagination.totalPages}
            hasMore={pagination.hasMore}
            onPageChange={(newPage) => {
              setCurrentPage(newPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit);
            }}
            limitOptions={[10, 20, 50, 100, 200, 500, 1000]}
          />
        </div>
      )}

      {/* Modal de descarga de imagen específico para RodMar */}
      <RodmarTransaccionesImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        transactions={transaccionesFiltradas}
        title="Transacciones LCDM"
        subtitle={(() => {
          if (fechaFilterType === 'todos') return 'Todas las transacciones';
          if (fechaFilterType === 'hoy') return 'Transacciones de hoy';
          if (fechaFilterType === 'ayer') return 'Transacciones de ayer';
          if (fechaFilterType === 'esta-semana') return 'Transacciones de esta semana';
          if (fechaFilterType === 'semana-pasada') return 'Transacciones de la semana pasada';
          if (fechaFilterType === 'este-mes') return 'Transacciones de este mes';
          if (fechaFilterType === 'mes-pasado') return 'Transacciones del mes pasado';
          if (fechaFilterType === 'este-año') return 'Transacciones de este año';
          if (fechaFilterType === 'año-pasado') return 'Transacciones del año pasado';
          if (fechaFilterType === 'exactamente' && fechaFilterValue) return `Transacciones del ${fechaFilterValue}`;
          if (fechaFilterType === 'entre' && fechaFilterValue && fechaFilterValueEnd) return `Transacciones entre ${fechaFilterValue} y ${fechaFilterValueEnd}`;
          if (fechaFilterType === 'despues-de' && fechaFilterValue) return `Transacciones después del ${fechaFilterValue}`;
          if (fechaFilterType === 'antes-de' && fechaFilterValue) return `Transacciones antes del ${fechaFilterValue}`;
          return 'Transacciones filtradas';
        })()}
        accountType="lcdm"
      />

      {/* Modal de transacción temporal - Como en minas */}
      <NewTransactionModal
        open={showTemporalTransaction}
        onClose={() => setShowTemporalTransaction(false)}
        onTemporalSubmit={handleTemporalSubmit}
        isTemporalMode={true}
      />

      {/* Modales de acciones */}
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

      <TransactionDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        transaction={selectedTransaction}
      />
    </div>
  );
}

// Componente para mostrar transacciones de Banco
function BancoTransactionsTab({ transactions }: { transactions: any[] }) {
  // Estados para filtros y ordenamiento idénticos a LCDM
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaFilterType, setFechaFilterType] = useState<DateFilterType>("todos");
  const [fechaFilterValue, setFechaFilterValue] = useState("");
  const [fechaFilterValueEnd, setFechaFilterValueEnd] = useState("");
  const [sortByFecha, setSortByFecha] = useState<"asc" | "desc" | "ninguno">("desc");
  const [sortByValor, setSortByValor] = useState<"asc" | "desc" | "ninguno">("ninguno");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');
  
  // Paginación con memoria en localStorage
  const { currentPage, setCurrentPage, pageSize, setPageSize, getLimitForServer } = usePagination({
    storageKey: "banco-transactions-pageSize",
    defaultPageSize: 50,
  });
  
  // Estado para modal de imagen
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Estados para transacciones temporales - Como en LCDM
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<any[]>([]);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook para manejar transacciones ocultas de forma local y temporal
  const {
    hideTransaction: hideTransactionLocal,
    showAllHidden: showAllHiddenLocal,
    getHiddenCount: getHiddenTransactionsCount,
    filterVisible: filterVisibleTransactions,
  } = useHiddenTransactions('banco');

  // Estados para modales de acciones
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Usar función centralizada directamente (ya devuelve strings YYYY-MM-DD)
  const dateRange = useMemo(() => {
    return getDateRangeFromFilter(fechaFilterType, fechaFilterValue, fechaFilterValueEnd);
  }, [fechaFilterType, fechaFilterValue, fechaFilterValueEnd]);

  // Obtener transacciones de Banco con paginación del servidor (sin filtros)
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
      "/api/transacciones/banco", 
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
      
      const url = apiUrl(`/api/transacciones/banco?${params.toString()}`);
      console.log('[Banco] Fetching transactions from:', url);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        credentials: "include",
        headers,
      });
      console.log('[Banco] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('[Banco] Error response:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Banco] Transactions received:', data?.data?.length || 0);
      return data;
    },
    staleTime: 300000, // 5 minutos - cache persistente (WebSockets actualiza en tiempo real)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const allBancoTransactions = transactionsData?.data || [];
  const pagination = transactionsData?.pagination;
  const hiddenBancoCount = getHiddenTransactionsCount();

  // Filtrado client-side sobre la página activa
  const bancoTransactions = useMemo(() => {
    let filtered = [...allBancoTransactions];

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

    // Filtro de balance (positivos/negativos) - Banco: positivos = desde Banco, negativos = hacia Banco
    if (balanceFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (balanceFilter === 'positivos') {
          return t.deQuienTipo === 'banco';
        } else if (balanceFilter === 'negativos') {
          return t.paraQuienTipo === 'banco';
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
  }, [allBancoTransactions, searchTerm, dateRange, sortByFecha, sortByValor, balanceFilter]);

  // Prefetching automático en segundo plano (solo si no está en modo "todo")
  useEffect(() => {
    if (pagination && currentPage === 1 && pagination.totalPages > 1 && pageSize !== "todo") {
      const prefetchPages = Math.min(pagination.totalPages, 10);
      setTimeout(() => {
        for (let page = 2; page <= prefetchPages; page++) {
          const limit = getLimitForServer();
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
          });
          
          queryClient.prefetchQuery({
            queryKey: [
              "/api/transacciones/banco", 
              page, 
              typeof pageSize === "number" ? pageSize : 999999
            ],
            queryFn: async () => {
              const { getAuthToken } = await import('@/hooks/useAuth');
              const token = getAuthToken();
              const headers: Record<string, string> = {};
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
              const response = await fetch(apiUrl(`/api/transacciones/banco?${params.toString()}`), {
                credentials: "include",
                headers,
              });
              if (!response.ok) throw new Error('Error al obtener transacciones');
              return response.json();
            },
            staleTime: 300000,
          });
        }
      }, 100);
    }
  }, [pagination, currentPage, pageSize, queryClient, getLimitForServer]);

  // Función para manejar transacciones temporales - Como en LCDM
  const handleTemporalSubmit = (formData: any) => {
    const nuevaTransacionTemporal = {
      id: `temporal-${Date.now()}`,
      fecha: formData.fecha,
      concepto: formData.concepto || "Transacción temporal",
      valor: formData.valor,
      deQuienTipo: formData.deQuienTipo,
      deQuienId: formData.deQuienId,
      paraQuienTipo: formData.paraQuienTipo,
      paraQuienId: formData.paraQuienId,
      comentario: formData.comentario || "",
      tipo: "Temporal",
      voucher: formData.voucher || "",
      formaPago: formData.formaPago || "",
      createdAt: new Date().toISOString(),
      horaInterna: new Date().toISOString(),
      tipoSocio: "banco" as const,
      socioId: "banco"
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


  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fechaFilterType, fechaFilterValue, fechaFilterValueEnd]);

  // Combinar transacciones normales con temporales y filtrar las ocultas localmente
  const todasLasTransacciones = useMemo(() => {
    return [...bancoTransactions, ...transaccionesTemporales];
  }, [bancoTransactions, transaccionesTemporales]);

  // Filtrar transacciones ocultas localmente
  const transaccionesFiltradas = useMemo(() => {
    return filterVisibleTransactions(todasLasTransacciones);
  }, [todasLasTransacciones, filterVisibleTransactions]);

  return (
    <div className="space-y-3">
      {/* Encabezado compacto de transacciones optimizado para móviles - Estilo idéntico a LCDM */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-2 sm:p-4">
          <div className="flex flex-col gap-2">
            {/* Primera línea: Título */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 sm:p-2 bg-blue-100 rounded-lg">
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-blue-900">Transacciones Banco</h3>
                  <p className="text-xs sm:text-sm text-blue-600 hidden sm:block">Historial financiero bancario</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Botón de descarga de imagen */}
              <Button
                onClick={() => setShowImageModal(true)}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1"
                title={`Descargar imagen (máx. 100 de ${transaccionesFiltradas.length} transacciones)`}
              >
                <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Imagen</span>
                <span className="sm:hidden">IMG</span>
              </Button>

                {/* Botón de transacción temporal - Como en LCDM */}
                <Button
                  onClick={() => setShowTemporalTransaction(true)}
                  size="sm"
                  variant="outline"
                  className="bg-orange-50 hover:bg-orange-100 border-orange-600 text-orange-600 h-8 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>TEMP</span>
                </Button>
              </div>
            </div>
            
            {/* Segunda línea: Contador de registros */}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-blue-700 font-medium text-xs sm:text-sm">{transaccionesFiltradas.length} registros</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controles de filtros optimizados para móviles - Idéntico a LCDM */}
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
                <Select value={fechaFilterType} onValueChange={(value: DateFilterType) => setFechaFilterType(value)}>
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

                {/* Botón mostrar ocultas - Banco */}
                {hiddenBancoCount > 0 ? (
                  <Button
                    onClick={handleShowAllHidden}
                    size="sm"
                    className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs"
                    title={`Mostrar ${hiddenBancoCount} transacciones ocultas`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {hiddenBancoCount}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Segunda fila solo cuando se necesiten inputs de fecha */}
            {(fechaFilterType === "exactamente" || fechaFilterType === "entre" || fechaFilterType === "despues-de" || fechaFilterType === "antes-de") && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={fechaFilterValue}
                  onChange={(e) => setFechaFilterValue(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                {fechaFilterType === "entre" && (
                  <Input
                    type="date"
                    value={fechaFilterValueEnd}
                    onChange={(e) => setFechaFilterValueEnd(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Balance dinámico basado en transacciones filtradas - considerar origen Banco como positivo */}
      {(() => {
        const positivos = transaccionesFiltradas.filter(t => t.deQuienTipo === 'banco');
        const negativos = transaccionesFiltradas.filter(t => t.paraQuienTipo === 'banco');

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
                  className={`rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${balance >= 0 ? 'bg-green-100' : 'bg-red-100'} ${
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

      {/* Lista de transacciones con tarjetas - Estilo idéntico a LCDM */}
      {transaccionesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Banknote className="mx-auto h-12 w-12 mb-2" />
            <p>No hay transacciones con Banco</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transaccionesFiltradas.map((transaccion) => (
            <Card 
              key={transaccion.id} 
              className="border border-gray-200 transition-colors cursor-pointer hover:bg-gray-50"
              onClick={() => {
                if (transaccion.tipo !== "Temporal") {
                  setSelectedTransaction(transaccion);
                  setShowDetailModal(true);
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
                      {transaccion.tipo === "Temporal" ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-orange-600 border-orange-600">T</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">M</Badge>
                      )}
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                        {transaccion.deQuienTipo === 'banco' ? 'B→R' : 'R→B'}
                      </Badge>
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

                  {/* Lado derecho: Valor y botones de acción */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                      transaccion.paraQuienTipo === 'banco' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(() => {
                        const valor = parseFloat(transaccion.valor || '0');
                        const valorText = transaccion.paraQuienTipo === 'banco' ? 
                          `-$ ${valor.toLocaleString()}` : 
                          `+$ ${valor.toLocaleString()}`;
                        return highlightValue(valorText, searchTerm);
                      })()}
                    </span>

                    {/* Botones de acción para transacciones manuales */}
                    {transaccion.tipo !== "Temporal" && typeof transaccion.id === 'number' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-blue-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransaction(transaccion);
                            setShowEditModal(true);
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
                            setShowDeleteModal(true);
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
                            if (typeof transaccion.id === 'number') {
                              handleHideTransaction(transaccion.id);
                            }
                          }}
                          title="Ocultar transacción"
                        >
                          <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                        </Button>
                      </div>
                    ) : transaccion.tipo === "Temporal" ? (
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className="bg-orange-50 border-orange-200 text-orange-700 text-xs px-1 py-0 h-4"
                        >
                          T
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemporalTransaction(transaccion.id);
                          }}
                          className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                          title="Eliminar transacción temporal"
                        >
                          <X className="w-2.5 h-2.5 text-red-600" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Controles de paginación - Mostrar siempre, incluso con filtros */}
      {pagination && (
        <div className="py-4">
          <PaginationControls
            page={currentPage}
            limit={pageSize}
            total={transaccionesFiltradas.length} // Mostrar total de transacciones filtradas en la página actual
            totalPages={pagination.totalPages}
            hasMore={pagination.hasMore}
            onPageChange={(newPage) => {
              setCurrentPage(newPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit);
            }}
            limitOptions={[10, 20, 50, 100, 200, 500, 1000]}
          />
        </div>
      )}

      {/* Modal de descarga de imagen específico para RodMar */}
      <RodmarTransaccionesImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        transactions={transaccionesFiltradas}
        title="Transacciones Banco"
        subtitle={(() => {
          if (fechaFilterType === 'todos') return 'Todas las transacciones';
          if (fechaFilterType === 'hoy') return 'Transacciones de hoy';
          if (fechaFilterType === 'ayer') return 'Transacciones de ayer';
          if (fechaFilterType === 'esta-semana') return 'Transacciones de esta semana';
          if (fechaFilterType === 'semana-pasada') return 'Transacciones de la semana pasada';
          if (fechaFilterType === 'este-mes') return 'Transacciones de este mes';
          if (fechaFilterType === 'mes-pasado') return 'Transacciones del mes pasado';
          if (fechaFilterType === 'este-año') return 'Transacciones de este año';
          if (fechaFilterType === 'año-pasado') return 'Transacciones del año pasado';
          if (fechaFilterType === 'exactamente' && fechaFilterValue) return `Transacciones del ${fechaFilterValue}`;
          if (fechaFilterType === 'entre' && fechaFilterValue && fechaFilterValueEnd) return `Transacciones entre ${fechaFilterValue} y ${fechaFilterValueEnd}`;
          if (fechaFilterType === 'despues-de' && fechaFilterValue) return `Transacciones después del ${fechaFilterValue}`;
          if (fechaFilterType === 'antes-de' && fechaFilterValue) return `Transacciones antes del ${fechaFilterValue}`;
          return 'Transacciones filtradas';
        })()}
        accountType="banco"
      />

      {/* Modal de transacción temporal - Como en LCDM */}
      <NewTransactionModal
        open={showTemporalTransaction}
        onClose={() => setShowTemporalTransaction(false)}
        onTemporalSubmit={handleTemporalSubmit}
        isTemporalMode={true}
      />

      {/* Modales de acciones */}
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

      <TransactionDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        transaction={selectedTransaction}
      />
    </div>
  );
}

// Componente para mostrar balance de LCDM
function LcdmBalanceTab({ transactions }: { transactions: any[] }) {
  const lcdmTransactions = transactions.filter(transaction => 
    transaction.deQuienTipo === 'lcdm' || transaction.paraQuienTipo === 'lcdm'
  );

  // Calcular balance detallado - CORREGIDO: considerar todas las transacciones con origen LCDM como positivas
  const positivos = lcdmTransactions
    .filter(t => t.deQuienTipo === 'lcdm')
    .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);
    
  const negativos = lcdmTransactions
    .filter(t => t.paraQuienTipo === 'lcdm')
    .reduce((sum, t) => sum + parseFloat(t.valor || '0'), 0);

  const balance = positivos - negativos;

  // Separar transacciones por tipo (ingresos vs egresos)
  const transaccionesPositivas = lcdmTransactions.filter(t => 
    t.paraQuienTipo === 'rodmar' || t.paraQuienTipo === 'banco'
  );
  const transaccionesNegativas = lcdmTransactions.filter(t => 
    t.paraQuienTipo === 'lcdm'
  );

  return (
    <div className="space-y-4">
      {/* Balance Consolidado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            Balance Consolidado LCDM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="bg-green-50 p-2 rounded text-center">
              <p className="text-xs text-green-700">Positivos</p>
              <p className="text-sm font-bold text-green-700">+{formatCurrency(positivos)}</p>
            </div>
            <div className="bg-red-50 p-2 rounded text-center">
              <p className="text-xs text-red-700">Negativos</p>
              <p className="text-sm font-bold text-red-700">-{formatCurrency(negativos)}</p>
            </div>
            <div className="bg-blue-50 p-2 rounded text-center">
              <p className="text-xs text-blue-700">Balance</p>
              <p className="text-sm font-bold text-blue-700">{formatCurrency(balance)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded text-center">
              <p className="text-xs text-gray-700">Total</p>
              <p className="text-sm font-bold text-gray-700">{lcdmTransactions.length} transacciones</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desglose Detallado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ingresos desde LCDM */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Ingresos desde LCDM
              <Badge variant="outline">{transaccionesPositivas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transaccionesPositivas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No hay ingresos desde LCDM
              </p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {transaccionesPositivas.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center py-1 px-2 bg-green-50 rounded text-xs">
                    <span className="truncate">{transaction.concepto}</span>
                    <span className="text-green-700 font-bold">
                      +{formatCurrency(transaction.valor)}
                    </span>
                  </div>
                ))}
                {transaccionesPositivas.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{transaccionesPositivas.length - 5} más
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Egresos hacia LCDM */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-red-600" />
              Egresos hacia LCDM
              <Badge variant="outline">{transaccionesNegativas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transaccionesNegativas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No hay egresos hacia LCDM
              </p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {transaccionesNegativas.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center py-1 px-2 bg-red-50 rounded text-xs">
                    <span className="truncate">{transaction.concepto}</span>
                    <span className="text-red-700 font-bold">
                      -{formatCurrency(transaction.valor)}
                    </span>
                  </div>
                ))}
                {transaccionesNegativas.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{transaccionesNegativas.length - 5} más
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      


    </div>
  );
}