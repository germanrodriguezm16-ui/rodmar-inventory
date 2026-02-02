import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Plus, Check, Download, SlidersHorizontal, X, Upload, Trash2, RefreshCw } from "lucide-react";
import { clearCache } from "@/lib/queryClient";
import TripCard from "@/components/trip-card";
import { EditTripModal } from "@/components/forms/edit-trip-modal";
import DeleteTripModal from "@/components/forms/delete-trip-modal";
import ImportExcelModal from "@/components/forms/import-excel-modal-fixed";
import BulkDeleteModal from "@/components/forms/bulk-delete-modal";
// DISABLED: Import warning banner no longer needed
// import ImportWarningBanner from "@/components/ui/import-warning-banner";
import { exportTripsToExcel } from "@/lib/excel-export-new";
import ExcelPreviewModal from "@/components/modals/excel-preview-modal";
import { BalanceFinanciero } from "@/components/balance-financiero";
import { usePermissions } from "@/hooks/usePermissions";

import { getDateRangeFilter, isDateInRange } from "@/lib/utils";
import DateFilterDropdown from "@/components/ui/date-filter-dropdown";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { ViajeWithDetails, Mina, Comprador } from "@shared/schema";
import { apiUrl } from "@/lib/api";
import { getAuthToken } from "@/hooks/useAuth";

interface PrincipalProps {
  onOpenCargue: () => void;
  onOpenDescargue: () => void;
}

export default function Principal({ onOpenCargue, onOpenDescargue }: PrincipalProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canViewCargue = has("action.VIAJES.cargue.view");
  const canUseCargue = has("action.VIAJES.cargue.use");
  const canViewDescargue = has("action.VIAJES.descargue.view");
  const canUseDescargue = has("action.VIAJES.descargue.use");
  const canViewExtendedFinancial = has("action.VIAJES.extendedFinancial.view");
  const canUseExtendedFinancial = has("action.VIAJES.extendedFinancial.use");

  const handleClearCache = () => {
    clearCache();
    toast({
      title: "Cache limpiado",
      description: "Cache del navegador limpiado exitosamente. Los datos se actualizarán automáticamente.",
      duration: 3000,
    });
  };
  const [showExtended, setShowExtended] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    searchId: "",
    searchPlaca: "",
    searchPeso: "",
    mina: "",
    comprador: "",
    conductor: "",
    dateFilter: "",
    dateRange: null as { start: Date; end: Date } | null,
    dateFilterCargue: "",
    dateRangeCargue: null as { start: Date; end: Date } | null,
    sortCargue: "desc",
    dateFilterDescargue: "",
    dateRangeDescargue: null as { start: Date; end: Date } | null,
    sortDescargue: "desc"
  });
  const [selectedViajeForEdit, setSelectedViajeForEdit] = useState<ViajeWithDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [hasEditFailures, setHasEditFailures] = useState(false);
  const [selectedViajes, setSelectedViajes] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const handleEditTrip = (viaje: ViajeWithDetails) => {
    console.log("=== handleEditTrip called in Principal with:", viaje.id);
    setSelectedViajeForEdit(viaje);
    setShowEditModal(true);
  };

  const handleDeleteTrip = (viaje: ViajeWithDetails) => {
    console.log("=== handleDeleteTrip called in Principal with:", viaje.id);
    setSelectedViajeForEdit(viaje);
    setShowDeleteModal(true);
  };

  const toggleViajeSelection = (viajeId: string) => {
    setSelectedViajes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(viajeId)) {
        newSet.delete(viajeId);
      } else {
        newSet.add(viajeId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedViajes.size === filteredAndSortedViajes.length && filteredAndSortedViajes.length > 0) {
      setSelectedViajes(new Set());
    } else {
      setSelectedViajes(new Set(filteredAndSortedViajes.map((v: ViajeWithDetails) => v.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedViajes.size === 0) return;
    
    // Mostrar modal de confirmación en lugar de eliminar directamente
    setShowBulkDeleteModal(true);
  };

  const clearSelection = () => {
    setSelectedViajes(new Set());
    setIsMultiSelectMode(false);
  };

  // Timestamp único para forzar actualización
  const [forceUpdate, setForceUpdate] = useState(Date.now());
  
  // Estado de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "todo">(50); // Por defecto 50 viajes por página
  
  // Función para obtener el límite numérico para el servidor
  const getLimitForServer = (total?: number): number => {
    if (pageSize === "todo") {
      return total ? total : 999999;
    }
    return pageSize;
  };
  
  // Resetear página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  
  // Query con paginación del servidor
  const { 
    data: viajesData, 
    isLoading: viajesLoading, // Solo true cuando NO hay datos en cache (carga inicial)
    isFetching: viajesFetching, // True durante cualquier fetch (inicial o refetch en segundo plano)
    refetch 
  } = useQuery<{
    data: ViajeWithDetails[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    // v2: cambia el payload del backend (se omite recibo base64 y se envía tieneRecibo).
    // Esto fuerza a React Query a refetchear y evita quedarse con el payload pesado en caché.
    queryKey: ["/api/viajes", "v2", currentPage, pageSize],
    queryFn: async () => {
      const limit = getLimitForServer();
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/viajes?page=${currentPage}&limit=${limit}`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error('Error al obtener viajes');
      return response.json();
    },
    staleTime: Infinity, // Los datos nunca se consideran stale - solo se actualizan cuando hay cambios explícitos
    gcTime: 1000 * 60 * 60 * 24, // Mantener en cache por 24 horas
    refetchOnMount: false, // No recargar al montar - sobrescribe defaults
    refetchOnWindowFocus: false, // No recargar al cambiar de pestaña - sobrescribe defaults
    refetchOnReconnect: false, // No recargar al reconectar - sobrescribe defaults
    // Nota: Aunque las invalidaciones marquen la query como stale, con staleTime: Infinity
    // React Query no la considerará stale y no refetcheará automáticamente
    // enabled: isAuthenticated, // Temporalmente deshabilitado
  });

  // Extraer datos de viajes y paginación
  const viajes = viajesData?.data || [];
  const pagination = viajesData?.pagination || {
    page: 1,
    limit: typeof pageSize === "number" ? pageSize : 50,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
  
  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
    staleTime: 30000,
    // enabled: isAuthenticated, // Temporalmente deshabilitado
  });

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
    staleTime: 30000,
    // enabled: isAuthenticated, // Temporalmente deshabilitado
  });

  // Extraer conductores únicos de los viajes
  const conductoresUnicos = Array.from(new Set(viajes.map(viaje => viaje.conductor).filter(Boolean))).sort();

  // Preparar opciones para autocompletados
  const minasOptions = minas.map(mina => ({
    value: mina.id.toString(),
    label: mina.nombre
  }));

  const compradoresOptions = compradores.map(comprador => ({
    value: comprador.id.toString(),
    label: comprador.nombre
  }));

  const conductoresOptions = conductoresUnicos.map(conductor => ({
    value: conductor,
    label: conductor
  }));

  // DISABLED: Import warning banner - Excel import system now works reliably with database persistence
  // Check for lost imported trips - detect if we have trips with non-TRP IDs or edit failures
  // These are likely imported trips that exist in the response but can't be edited
  // const hasLostImportedTrips = (!isLoading && viajes.length > 0 && viajes.some(viaje => 
  //   viaje.id && !viaje.id.startsWith('TRP')
  // )) || hasEditFailures && !showImportWarning;
  const hasLostImportedTrips = false; // Always false - warning banner disabled

  // DISABLED: Debug logging for import warning banner
  // React.useEffect(() => {
  //   if (!isLoading && viajes.length > 0) {
  //     const importedTrips = viajes.filter(v => v.id && !v.id.startsWith('TRP'));
  //     console.log('🔍 Imported trips detected:', importedTrips.map(v => v.id));
  //     console.log('🚨 Should show banner:', hasLostImportedTrips);
  //   }
  // }, [viajes, hasLostImportedTrips, isLoading]);
  
  // Filtrado y ordenamiento optimizado con memoización
  const filteredAndSortedViajes = useMemo(() => {
    if (!viajes) return [];
    
    let filtered = viajes.filter((viaje: ViajeWithDetails) => {
      // Search filter (legacy)
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!viaje.id.toLowerCase().includes(search) && 
            !viaje.placa.toLowerCase().includes(search)) {
          return false;
        }
      }

      // ID search filter
      if (filters.searchId) {
        const searchId = filters.searchId.toLowerCase();
        if (!viaje.id.toLowerCase().includes(searchId)) {
          return false;
        }
      }

      // Placa search filter
      if (filters.searchPlaca) {
        const searchPlaca = filters.searchPlaca.toLowerCase();
        if (!viaje.placa.toLowerCase().includes(searchPlaca)) {
          return false;
        }
      }

      // Peso search filter
      if (filters.searchPeso) {
        const searchPeso = filters.searchPeso.toLowerCase();
        if (!viaje.peso?.toString().toLowerCase().includes(searchPeso)) {
          return false;
        }
      }

      // Mina filter
      if (filters.mina && filters.mina !== "all" && viaje.minaId && viaje.minaId.toString() !== filters.mina) {
        return false;
      }

      // Comprador filter
      if (filters.comprador && filters.comprador !== "all" && viaje.compradorId && viaje.compradorId.toString() !== filters.comprador) {
        return false;
      }

      // Conductor filter
      if (filters.conductor && filters.conductor !== "all" && viaje.conductor !== filters.conductor) {
        return false;
      }

      // Date filter para fechaCargue
      if (filters.dateFilterCargue && filters.dateRangeCargue) {
        const viajeDate = new Date(viaje.fechaCargue);
        if (!isDateInRange(viajeDate, filters.dateRangeCargue)) {
          return false;
        }
      }

      // Date filter para fechaDescargue
      if (filters.dateFilterDescargue && filters.dateRangeDescargue) {
        // Si hay filtro de descargue activo, SOLO mostrar viajes que ya tienen fechaDescargue
        if (!viaje.fechaDescargue) {
          return false; // Excluir viajes pendientes de descargue
        }
        
        const viajeDate = viaje.fechaDescargue;
        if (!isDateInRange(viajeDate, filters.dateRangeDescargue)) {
          return false;
        }
      }

      return true;
    });

    // ORDENAMIENTO POR DEFECTO: siempre por fechaCargue más reciente primero, luego por creación
    // Prioridad 1: Si hay filtro específico de fechaDescargue, ordenar por esa fecha
    if (filters.dateFilterDescargue && filters.sortDescargue) {
      filtered = filtered.sort((a: ViajeWithDetails, b: ViajeWithDetails) => {
        const dateA = a.fechaDescargue ? new Date(a.fechaDescargue + 'T12:00:00').getTime() : 0;
        const dateB = b.fechaDescargue ? new Date(b.fechaDescargue + 'T12:00:00').getTime() : 0;
        
        // Si las fechas son iguales, ordenar por createdAt como criterio secundario
        if (dateA === dateB) {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return filters.sortDescargue === "desc" ? createdB - createdA : createdA - createdB;
        }
        
        return filters.sortDescargue === "desc" ? dateB - dateA : dateA - dateB;
      });
    } else {
      // Prioridad 2: SIEMPRE ordenar por fechaCargue (por defecto DESC = más recientes primero)
      // Criterio secundario: tiempo de creación (createdAt) para mantener orden consistente
      filtered = filtered.sort((a: ViajeWithDetails, b: ViajeWithDetails) => {
        const dateA = new Date(a.fechaCargue).getTime();
        const dateB = new Date(b.fechaCargue).getTime();
        const sortOrder = filters.sortCargue || "desc"; // Por defecto descendente
        
        // Si las fechas de cargue son iguales, usar createdAt como criterio secundario
        if (dateA === dateB) {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return sortOrder === "desc" ? createdB - createdA : createdA - createdB;
        }
        
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    }

    return filtered;
  }, [viajes, filters]); // Dependencias del useMemo

  // Los viajes ya vienen paginados del servidor, así que usamos filteredAndSortedViajes directamente
  // (los filtros se aplican sobre los datos paginados)
  const paginatedViajes = filteredAndSortedViajes;

  const clearFilters = () => {
    setFilters({
      search: "",
      searchId: "",
      searchPlaca: "",
      searchPeso: "",
      mina: "",
      comprador: "",
      conductor: "",
      dateFilter: "",
      dateRange: null,
      dateFilterCargue: "",
      dateRangeCargue: null,
      sortCargue: "desc",
      dateFilterDescargue: "",
      dateRangeDescargue: null,
      sortDescargue: "desc"
    });
  };

  const handleDateFilterCargue = (filterType: string, startDate?: Date, endDate?: Date, sortOrder?: string) => {
    if (!filterType || filterType === "all") {
      setFilters(prev => ({ ...prev, dateFilterCargue: "", dateRangeCargue: null, sortCargue: sortOrder || "desc" }));
      return;
    }

    const dateRange = getDateRangeFilter(filterType, startDate, endDate);
    setFilters(prev => ({ 
      ...prev, 
      dateFilterCargue: filterType,
      dateRangeCargue: dateRange,
      sortCargue: sortOrder || "desc"
    }));
  };

  const handleDateFilterDescargue = (filterType: string, startDate?: Date, endDate?: Date, sortOrder?: string) => {
    if (!filterType || filterType === "all") {
      setFilters(prev => ({ ...prev, dateFilterDescargue: "", dateRangeDescargue: null, sortDescargue: sortOrder || "desc" }));
      return;
    }

    const dateRange = getDateRangeFilter(filterType, startDate, endDate);
    setFilters(prev => ({ 
      ...prev, 
      dateFilterDescargue: filterType,
      dateRangeDescargue: dateRange,
      sortDescargue: sortOrder || "desc"
    }));
  };

  const removeFilter = (filterType: 'search' | 'mina' | 'comprador' | 'conductor' | 'dateFilter') => {
    if (filterType === 'dateFilter') {
      setFilters(prev => ({ ...prev, dateFilter: "", dateRange: null }));
    } else {
      setFilters(prev => ({ ...prev, [filterType]: "" }));
    }
  };

  // Temporalmente deshabilitando verificación de autenticación
  /*
  if (!isAuthenticated || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }
  */

  // Solo mostrar loading completo si es la carga inicial (sin datos en cache)
  // Si hay datos en cache, el refetch será en segundo plano
  if (viajesLoading && !viajesData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando viajes...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Indicador sutil de actualización en segundo plano */}
      {viajesFetching && viajesData && (
        <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Actualizando datos...</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          {canViewCargue && (
            <Button 
              className={`${
                canUseCargue
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              onClick={() => {
                if (canUseCargue) onOpenCargue();
              }}
              disabled={!canUseCargue}
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Cargue
            </Button>
          )}
          {canViewDescargue && (
            <Button 
              className={`${
                canUseDescargue
                  ? "bg-success text-white hover:bg-success/90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              onClick={() => {
                if (canUseDescargue) onOpenDescargue();
              }}
              disabled={!canUseDescargue}
            >
              <Check className="w-4 h-4 mr-2" />
              Registrar Descargue
            </Button>
          )}
        </div>
      </div>

      {/* DISABLED: Import Warning Banner - Excel import now works reliably */}
      {/* {hasLostImportedTrips && (
        <div className="px-4 pt-4">
          <ImportWarningBanner
            onReimport={() => setShowImportModal(true)}
            onDismiss={() => setShowImportWarning(true)}
          />
        </div>
      )} */}

      {/* Compact Filters Section */}
      <div className="px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtros</span>
          </div>
          <div className="flex gap-1">
            {selectedViajes.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                className="h-7 text-xs px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {selectedViajes.size}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs px-2">
              <X className="w-3 h-3 mr-1" />
              Limpiar
            </Button>
          </div>
        </div>
        
        {/* Compact Filter Grid */}
        <div className="space-y-2">
          {/* Row 1: Date Filters */}
          <div className="grid grid-cols-2 gap-2">
            <DateFilterDropdown
              buttonText="Cargue"
              onApplyFilter={handleDateFilterCargue}
              currentFilter={filters.dateFilterCargue}
              currentSort={filters.sortCargue}
            />
            <DateFilterDropdown
              buttonText="Descargue"
              onApplyFilter={handleDateFilterDescargue}
              currentFilter={filters.dateFilterDescargue}
              currentSort={filters.sortDescargue}
            />
          </div>

          {/* Row 2: Entity Filters */}
          <div className="grid grid-cols-3 gap-2">
            <Autocomplete
              options={minasOptions}
              value={filters.mina}
              onValueChange={(value) => setFilters(prev => ({ ...prev, mina: value }))}
              placeholder="Buscar minas..."
            />

            <Autocomplete
              options={compradoresOptions}
              value={filters.comprador}
              onValueChange={(value) => setFilters(prev => ({ ...prev, comprador: value }))}
              placeholder="Buscar compradores..."
            />

            <Autocomplete
              options={conductoresOptions}
              value={filters.conductor}
              onValueChange={(value) => setFilters(prev => ({ ...prev, conductor: value }))}
              placeholder="Buscar conductores..."
            />
          </div>

          {/* BÚSQUEDAS ESPECÍFICAS - TRES CAMPOS INDIVIDUALES */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-100 p-3 rounded-lg border-2 border-blue-400">
              <label className="block text-sm font-bold text-blue-800 mb-2">🆔 ID</label>
              <Input
                placeholder="Ej: G20, F89, TRP001..."
                value={filters.searchId}
                onChange={(e) => setFilters(prev => ({ ...prev, searchId: e.target.value }))}
                className="h-10 text-sm border-blue-400 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="bg-green-100 p-3 rounded-lg border-2 border-green-400">
              <label className="block text-sm font-bold text-green-800 mb-2">🚛 PLACA</label>
              <Input
                placeholder="Ej: ABC123, XYZ789..."
                value={filters.searchPlaca}
                onChange={(e) => setFilters(prev => ({ ...prev, searchPlaca: e.target.value }))}
                className="h-10 text-sm border-green-400 bg-white focus:border-green-600 focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div className="bg-purple-100 p-3 rounded-lg border-2 border-purple-400">
              <label className="block text-sm font-bold text-purple-800 mb-2">⚖️ PESO</label>
              <Input
                placeholder="Ej: 20.5, 15.2..."
                value={filters.searchPeso}
                onChange={(e) => setFilters(prev => ({ ...prev, searchPeso: e.target.value }))}
                className="h-10 text-sm border-purple-400 bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          {/* Active Filters */}
          {(filters.search || filters.searchId || filters.searchPlaca || filters.searchPeso || filters.mina || filters.comprador || filters.conductor || filters.dateFilterCargue || filters.dateFilterDescargue) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {filters.search && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  {filters.search}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter('search')} />
                </Badge>
              )}
              {filters.searchId && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  ID: {filters.searchId}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, searchId: "" }))} />
                </Badge>
              )}
              {filters.searchPlaca && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  Placa: {filters.searchPlaca}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, searchPlaca: "" }))} />
                </Badge>
              )}
              {filters.searchPeso && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  Peso: {filters.searchPeso}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, searchPeso: "" }))} />
                </Badge>
              )}
              {filters.mina && filters.mina !== "all" && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  {minas.find(m => m.id.toString() === filters.mina)?.nombre}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter('mina')} />
                </Badge>
              )}
              {filters.comprador && filters.comprador !== "all" && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  {compradores.find(c => c.id.toString() === filters.comprador)?.nombre}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter('comprador')} />
                </Badge>
              )}
              {filters.conductor && filters.conductor !== "all" && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  {filters.conductor}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter('conductor')} />
                </Badge>
              )}
              {filters.dateFilterCargue && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  C: {filters.dateFilterCargue.replace(/_/g, ' ')}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, dateFilterCargue: "", dateRangeCargue: null }))} />
                </Badge>
              )}
              {filters.dateFilterDescargue && (
                <Badge variant="secondary" className="h-6 text-xs flex items-center gap-1 px-2">
                  D: {filters.dateFilterDescargue.replace(/_/g, ' ')}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, dateFilterDescargue: "", dateRangeDescargue: null }))} />
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trip List */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Viajes ({filteredAndSortedViajes.length})</span>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearCache}
              className="h-7 text-xs px-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800"
              title="Limpiar cache del navegador"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Cache
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="h-7 text-xs px-2"
            >
              <Upload className="h-3 w-3 mr-1" />
              Excel
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowExtended(!showExtended)}
              className="h-7 text-xs px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
            >
              {showExtended ? "Menos" : "Más"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowExcelPreviewModal(true)}
              className="h-7 text-xs px-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800"
            >
              <Download className="h-3 w-3 mr-1" />
              Excel
            </Button>
          </div>
        </div>

        {/* Solo mostrar loading si es carga inicial sin datos */}
        {viajesLoading && !viajesData ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando viajes...
          </div>
        ) : filteredAndSortedViajes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {viajes.length === 0 ? "No hay viajes registrados" : "No se encontraron viajes con los filtros aplicados"}
            <br />
            <small className="text-xs">Total viajes: {viajes.length}, Filtrados: {filteredAndSortedViajes.length}</small>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Selection controls */}
            <div className="flex items-center gap-2 px-2 py-1 bg-muted/20 rounded text-xs">
              <input
                type="checkbox"
                checked={selectedViajes.size === filteredAndSortedViajes.length && filteredAndSortedViajes.length > 0}
                onChange={toggleSelectAll}
                className="w-3 h-3 rounded"
              />
              <span className="text-xs text-muted-foreground flex-1">
                {selectedViajes.size === filteredAndSortedViajes.length && filteredAndSortedViajes.length > 0 
                  ? `Todos (${selectedViajes.size})` 
                  : selectedViajes.size > 0 
                    ? `${selectedViajes.size} de ${filteredAndSortedViajes.length}`
                    : "Seleccionar todos"
                }
              </span>
              {selectedViajes.size > 0 && (
                <div className="flex items-center gap-1">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleBulkDelete}
                    className="h-6 text-xs px-2"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {selectedViajes.size}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs px-1"
                    onClick={clearSelection}
                  >
                    Limpiar
                  </Button>
                </div>
              )}
            </div>
            
            {paginatedViajes.map((viaje, index) => (
              <TripCard 
                key={viaje.id} 
                viaje={viaje} 
                showExtended={showExtended}
                showExtendedFinancialToggle={canViewExtendedFinancial}
                extendedFinancialDisabled={!canUseExtendedFinancial}
                onEditTrip={handleEditTrip}
                onDeleteTrip={handleDeleteTrip}
                isSelected={selectedViajes.has(viaje.id)}
                index={index}
                onSelect={(isSelected) => {
                  if (isSelected) {
                    setSelectedViajes(prev => new Set([...Array.from(prev), viaje.id]));
                  } else {
                    setSelectedViajes(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(viaje.id);
                      return newSet;
                    });
                  }
                }}
              />
            ))}
            
            {/* Controles de paginación del servidor */}
            <PaginationControls
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              hasMore={pagination.hasMore}
              onPageChange={(newPage) => {
                setCurrentPage(newPage);
                // Scroll al inicio de la lista
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onLimitChange={(newLimit) => {
                setPageSize(newLimit);
                setCurrentPage(1); // Resetear a página 1 cuando cambia el tamaño
              }}
            />
            
            {/* Balance Financiero */}
            <BalanceFinanciero 
              viajes={filteredAndSortedViajes} 
              className="mb-4"
            />
          </div>
        )}
      </div>
      
      {/* Edit Trip Modal */}
      {selectedViajeForEdit && (
        <EditTripModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedViajeForEdit(null);
          }}
          viaje={selectedViajeForEdit}
        />
      )}

      {/* Delete Trip Modal */}
      {selectedViajeForEdit && (
        <DeleteTripModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedViajeForEdit(null);
          }}
          viaje={selectedViajeForEdit}
        />
      )}

      {/* Import Excel Modal */}
      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        selectedViajes={filteredAndSortedViajes.filter(v => selectedViajes.has(v.id))}
        onSuccess={clearSelection}
      />

      {/* Excel Preview Modal */}
      <ExcelPreviewModal
        isOpen={showExcelPreviewModal}
        onClose={() => setShowExcelPreviewModal(false)}
        viajes={filteredAndSortedViajes}
        onConfirmDownload={() => exportTripsToExcel(filteredAndSortedViajes)}
        exportType="viajes"
      />
    </div>
  );
}
