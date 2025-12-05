import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mountain, Plus, Trash2, Search, SortAsc, SortDesc, RefreshCw, Merge, History } from "lucide-react";
import type { Mina } from "@shared/schema";

// Importar componentes localmente
import AddMinaModal from "@/components/modals/add-mina-modal";
import DeleteMinaModal from "@/components/modals/delete-mina-modal";
import { EditableTitle } from "@/components/EditableTitle";

import { useMinasBalance } from "@/hooks/useMinasBalance";
import { useRecalculatePrecalculos } from "@/hooks/useRecalculatePrecalculos";
import { formatCurrency } from "@/lib/utils";
import type { ViajeWithDetails, TransaccionWithSocio } from "@shared/schema";
import MergeEntitiesModal from "@/components/fusion/MergeEntitiesModal";
import FusionHistoryModal from "@/components/fusion/FusionHistoryModal";

export default function Minas() {
  const [showAddMina, setShowAddMina] = useState(false);
  const [showDeleteMina, setShowDeleteMina] = useState(false);
  const [minaToDelete, setMinaToDelete] = useState<Mina | null>(null);
  const [, setLocation] = useLocation();
  
  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Estado para ordenamiento
  const [sortBy, setSortBy] = useState<"alfabetico" | "viajes">("alfabetico");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // Minas module is read-only - no editing/deleting of transactions or trips

  // Query original para minas
  const { data: minas = [], isLoading } = useQuery({
    queryKey: ["/api/minas"],
  });

  // Query para obtener todos los viajes (solo para validación de eliminación - deshabilitada por defecto)
  const { data: allViajes = [] } = useQuery({
    queryKey: ["/api/viajes"],
    enabled: false, // Solo se carga cuando se necesita verificar eliminación
    staleTime: 300000,
  });

  // Query para obtener todas las transacciones (solo para validación de eliminación - deshabilitada por defecto)
  const { data: allTransacciones = [] } = useQuery({
    queryKey: ["/api/transacciones"],
    enabled: false, // Solo se carga cuando se necesita verificar eliminación
    staleTime: 300000,
  });

  // Hook para calcular balances de minas (igual que compradores)
  const { balancesMinas, viajesStats, isFetchingBalances } = useMinasBalance();
  
  // Hook para recálculo de precálculos
  const { recalcular, isRecalculando } = useRecalculatePrecalculos();

  // formatCurrency se importa desde utils

  const handleViewMina = (minaId: number) => {
    setLocation(`/minas/${minaId}`);
  };

  const handleDeleteMina = (mina: Mina) => {
    setMinaToDelete(mina);
    setShowDeleteMina(true);
  };

  // Función para verificar si se puede eliminar una mina (sin viajes ni transacciones)
  const canDeleteMina = (minaId: number): boolean => {
    // Usar estadísticas del hook para verificar viajes (más eficiente)
    const tieneViajes = (viajesStats[minaId]?.viajesCount || 0) > 0;
    // Para transacciones, usar allTransacciones si está disponible, sino asumir que no se puede eliminar
    if (allTransacciones.length === 0) {
      // Si no se han cargado las transacciones, usar heurística: si tiene balance, probablemente tiene transacciones
      const balance = balancesMinas[minaId] || 0;
      return !tieneViajes && balance === 0;
    }
    const tieneTransacciones = allTransacciones.some((t: any) => 
      (t.deQuienTipo === "mina" && t.deQuienId === minaId.toString()) ||
      (t.paraQuienTipo === "mina" && t.paraQuienId === minaId.toString()) ||
      (t.tipoSocio === "mina" && t.socioId === minaId)
    );
    return !tieneViajes && !tieneTransacciones;
  };

  // Función para contar viajes por mina (usa estadísticas del hook)
  const getViajesCountForMina = (minaId: number): number => {
    return viajesStats[minaId]?.viajesCount || 0;
  };

  // Función para obtener balance de mina usando el hook compartido
  const getBalanceForMina = (minaId: number): number => {
    return balancesMinas[minaId] || 0;
  };





  // Filtrar y ordenar minas con lógica inteligente
  const filteredAndSortedMinas = useMemo(() => {
    const filtered = minas.filter(mina => {
      if (!searchTerm.trim()) return true;
      return mina.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Si hay filtros de ordenamiento manual, usar la lógica anterior
    if (sortBy !== "alfabetico" || sortOrder !== "asc") {
      return filtered.sort((a, b) => {
        if (sortBy === "alfabetico") {
          const comparison = a.nombre.localeCompare(b.nombre);
          return sortOrder === "asc" ? comparison : -comparison;
        } else {
          const viajesA = getViajesCountForMina(a.id);
          const viajesB = getViajesCountForMina(b.id);
          const comparison = viajesA - viajesB;
          return sortOrder === "asc" ? comparison : -comparison;
        }
      });
    }

    // Ordenamiento inteligente usando balance calculado y estadísticas
    const grupoA: typeof filtered = []; // Con balance diferente de cero
    const grupoB: typeof filtered = []; // Balance cero pero con viajes
    const grupoC: typeof filtered = []; // Balance cero y sin viajes

    filtered.forEach(mina => {
      const balance = getBalanceForMina(mina.id);
      const cantidadViajes = getViajesCountForMina(mina.id);

      if (balance !== 0) {
        grupoA.push(mina);
      } else if (cantidadViajes > 0) {
        grupoB.push(mina);
      } else {
        grupoC.push(mina);
      }
    });

    // Ordenar cada grupo por balance calculado
    grupoA.sort((a, b) => Math.abs(getBalanceForMina(b.id)) - Math.abs(getBalanceForMina(a.id)));
    grupoB.sort((a, b) => getViajesCountForMina(b.id) - getViajesCountForMina(a.id));
    grupoC.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return [...grupoA, ...grupoB, ...grupoC];
  }, [minas, searchTerm, sortBy, sortOrder, balancesMinas, viajesStats]);

  // Calcular total de viajes de las minas del listado filtrado
  const totalViajesEnListado = useMemo(() => {
    return filteredAndSortedMinas.reduce((total, mina) => total + getViajesCountForMina(mina.id), 0);
  }, [filteredAndSortedMinas, viajesStats]);

  // Calcular total de viajes generales usando estadísticas
  const totalViajesGenerales = useMemo(() => {
    return Object.values(viajesStats).reduce((total, stats) => total + (stats?.viajesCount || 0), 0);
  }, [viajesStats]);

  // Calcular balances separados de todas las minas
  const { saldoAFavor, saldoEnContra } = minas.reduce((acc, mina) => {
    const balance = getBalanceForMina(mina.id);
    if (balance > 0) {
      acc.saldoAFavor += balance;
    } else if (balance < 0) {
      acc.saldoEnContra += Math.abs(balance);
    }
    return acc;
  }, { saldoAFavor: 0, saldoEnContra: 0 });

  const balanceTotalMinas = saldoAFavor - saldoEnContra;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded mb-2"></div>
              <div className="flex space-x-2 mt-4">
                <div className="h-8 bg-muted rounded flex-1"></div>
                <div className="h-8 bg-muted rounded flex-1"></div>
                <div className="h-8 bg-muted rounded flex-1"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header reorganizado para móviles */}
      <div className="mb-4 space-y-3">
        {/* Primera fila: Título y contador */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-foreground">Minas</h2>
            <span className="text-sm bg-muted px-2 py-1 rounded-full">
              {searchTerm ? filteredAndSortedMinas.length : minas.length}
            </span>
          </div>
          <Button onClick={() => setShowAddMina(true)} size="icon" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Segunda fila: Balance en formato compacto */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="text-muted-foreground mb-0.5">Positivos</div>
            <div className="text-green-600 dark:text-green-400 font-semibold truncate">
              ${formatCurrency(saldoAFavor).replace('$', '')}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="text-muted-foreground mb-0.5">Negativos</div>
            <div className="text-red-600 dark:text-red-400 font-semibold truncate">
              ${formatCurrency(saldoEnContra).replace('$', '')}
            </div>
          </div>
          <div className={`rounded-lg p-2 border ${
            balanceTotalMinas >= 0 
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}>
            <div className="text-muted-foreground mb-0.5">Balance</div>
            <div className={`font-semibold truncate ${
              balanceTotalMinas >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}>
              {balanceTotalMinas >= 0 ? "" : "-"}${formatCurrency(Math.abs(balanceTotalMinas)).replace('$', '')}
            </div>
          </div>
        </div>
        
        {/* Tercera fila: Botones de ordenamiento y recálculo */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (sortBy === "alfabetico") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("alfabetico");
                  setSortOrder("asc");
                }
              }}
              className={`px-2 py-1.5 text-xs rounded-lg transition-colors flex items-center space-x-1 ${
                sortBy === "alfabetico" 
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" 
                  : "bg-muted hover:bg-muted/80"
              }`}
              title={sortBy === "alfabetico" 
                ? `Orden alfabético ${sortOrder === "asc" ? "A-Z" : "Z-A"}, click para cambiar`
                : "Ordenar alfabéticamente A-Z"
              }
            >
              {sortBy === "alfabetico" && sortOrder === "desc" ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />}
              <span className="text-xs">A-Z</span>
            </button>
            <button
              onClick={() => {
                if (sortBy === "viajes") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("viajes");
                  setSortOrder("desc");
                }
              }}
              className={`px-2 py-1.5 text-xs rounded-lg transition-colors flex items-center space-x-1 ${
                sortBy === "viajes" 
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" 
                  : "bg-muted hover:bg-muted/80"
              }`}
              title={sortBy === "viajes" 
                ? `Orden por viajes ${sortOrder === "desc" ? "mayor a menor" : "menor a mayor"}, click para cambiar`
                : "Ordenar por cantidad de viajes"
              }
            >
              {sortBy === "viajes" && sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
              <span className="text-xs">#</span>
            </button>
          </div>
          <Button 
            onClick={recalcular}
            disabled={isRecalculando}
            size="icon"
            variant="outline"
            title="Recalcular balances precalculados"
            className="h-8 w-8 bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-600"
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculando ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Indicador sutil de actualización en segundo plano */}
      {isFetchingBalances && Object.keys(balancesMinas).length > 0 && (
        <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 mb-2">
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Actualizando balances...</span>
          </div>
        </div>
      )}

      {/* Mensaje de filtrado */}
      {searchTerm.trim() && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredAndSortedMinas.length} de {minas.length}
          </p>
        </div>
      )}

      {/* Contador de viajes y búsqueda en una sola fila */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center justify-between space-x-4">
            {/* Contador de viajes */}
            <div className="flex items-center space-x-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg px-3 py-2 border border-blue-200 dark:border-blue-800">
              <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-center">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    {totalViajesEnListado.toLocaleString()}
                  </span>
                  <div className="text-xs text-blue-600 dark:text-blue-400">Listado</div>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400">/</span>
                <div className="text-center">
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    {totalViajesGenerales.toLocaleString()}
                  </span>
                  <div className="text-xs text-blue-600 dark:text-blue-400">Total</div>
                </div>
              </div>
            </div>
            
            {/* Búsqueda */}
            <div className="flex items-center space-x-3 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mina por nombre..."
                className="flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>



      {filteredAndSortedMinas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mountain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {minas.length === 0 
                ? "No hay minas registradas" 
                : "No se encontraron minas que coincidan con la búsqueda"
              }
            </p>
            <Button onClick={() => setShowAddMina(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Mina
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedMinas.map((mina: Mina) => (
            <Card key={mina.id}>
              <CardContent className="p-4">
                {/* Fila 1: Ícono + Nombre | Viajes | Botón eliminar */}
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2"
                  onClick={() => handleViewMina(mina.id)}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mountain className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <EditableTitle 
                        id={mina.id} 
                        currentName={mina.nombre} 
                        type="mina" 
                        className="text-base truncate"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-2">
                    <div className="text-right min-w-[50px]">
                      <p className="text-xs sm:text-sm text-muted-foreground">Viajes</p>
                      <p className="font-semibold text-blue-600 text-sm sm:text-base">
                        {getViajesCountForMina(mina.id)}
                      </p>
                    </div>
                    {canDeleteMina(mina.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMina(mina);
                        }}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Fila 2: Balance ocupando toda la fila */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className="text-xs sm:text-sm text-muted-foreground">Balance</span>
                  <span className={`font-semibold text-xs sm:text-sm truncate ${
                    getBalanceForMina(mina.id) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {formatCurrency(getBalanceForMina(mina.id))}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Botones de fusión al final del listado */}
      {filteredAndSortedMinas.length >= 2 && (
        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Fusión de minas ({filteredAndSortedMinas.length} disponibles)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoryModal(true)}
                  className="text-xs"
                >
                  <History className="h-3 w-3 mr-1" />
                  Historial
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowMergeModal(true)}
                  className="text-xs"
                >
                  <Merge className="h-3 w-3 mr-1" />
                  Fusionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AddMinaModal 
        open={showAddMina} 
        onOpenChange={setShowAddMina}
      />

      <DeleteMinaModal
        open={showDeleteMina}
        onOpenChange={setShowDeleteMina}
        mina={minaToDelete}
      />

      {/* Modales de fusión */}
      <MergeEntitiesModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        entities={minas.map((m: any) => ({ id: m.id, nombre: m.nombre }))}
        entityType="minas"
        onSuccess={() => {
          // Refrescar datos después de fusión exitosa
          window.location.reload();
        }}
      />

      <FusionHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
      />

      {/* Minas module is read-only - no transaction editing modals needed */}

    </div>
  );
}


