import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Plus, Search, Trash2, SortAsc, SortDesc, RefreshCw, Merge, History } from "lucide-react";
import type { Comprador } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { useCompradoresBalance } from "@/hooks/useCompradoresBalance";
import { useRecalculatePrecalculos } from "@/hooks/useRecalculatePrecalculos";


// Importar componentes localmente
import AddCompradorModal from "@/components/modals/add-comprador-modal";
import DeleteCompradorModal from "@/components/modals/delete-comprador-modal";
import { EditableTitle } from "@/components/EditableTitle";
import BottomNavigation from "@/components/layout/bottom-navigation";
import MergeEntitiesModal from "@/components/fusion/MergeEntitiesModal";
import FusionHistoryModal from "@/components/fusion/FusionHistoryModal";

export default function Compradores() {
  const [showAddComprador, setShowAddComprador] = useState(false);
  const [showDeleteComprador, setShowDeleteComprador] = useState(false);
  const [compradorToDelete, setCompradorToDelete] = useState<Comprador | null>(null);
  const [, setLocation] = useLocation();
  
  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Estado para ordenamiento
  const [sortBy, setSortBy] = useState<"alfabetico" | "viajes">("alfabetico");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Usar hook compartido para balances de compradores
  const { balancesCompradores, compradores: compradoresFromHook, viajesStats, isFetchingBalances } = useCompradoresBalance();
  
  // Hook para recálculo de precálculos
  const { recalcular, isRecalculando } = useRecalculatePrecalculos();
  
  // Mantener queries locales para datos específicos del módulo
  const { data: compradores = [], isLoading } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
    staleTime: 30000,
  });

  // Queries deshabilitadas - ya no se necesitan con las optimizaciones
  // Se mantienen solo para compatibilidad con funciones que aún las usan
  const { data: allViajes = [] } = useQuery({
    queryKey: ["/api/viajes"],
    enabled: false, // Deshabilitada - usar viajesStats del hook
    staleTime: 300000,
  });

  const { data: allTransacciones = [] } = useQuery({
    queryKey: ["/api/transacciones"],
    enabled: false, // Deshabilitada - no se necesita para ordenamiento
    staleTime: 300000,
  });

  const handleViewComprador = (compradorId: number) => {
    setLocation(`/compradores/${compradorId}`);
  };

  const handleDeleteComprador = (comprador: Comprador) => {
    setCompradorToDelete(comprador);
    setShowDeleteComprador(true);
  };

  // Función optimizada para obtener balance (ahora usa hook compartido)
  const calcularBalanceNeto = (compradorId: number): number => {
    return balancesCompradores[compradorId] || 0;
  };

  // Función optimizada: solo compradores sin viajes ni transacciones pueden eliminarse
  const canDeleteComprador = (compradorId: number): boolean => {
    // Para optimización: por ahora devolver false ya que la eliminación requiere verificación del backend
    // TODO: Implementar verificación optimizada en el backend con datos pre-calculados
    return false;
  };

  // Función optimizada: usar estadísticas del hook
  const getViajesCountForComprador = (compradorId: number) => {
    return viajesStats[compradorId]?.viajesCount || 0;
  };

  // Función optimizada: usar estadísticas del hook
  const getViajesUltimoMes = (compradorId: number): number => {
    return viajesStats[compradorId]?.viajesUltimoMes || 0;
  };

  // Calcular total de viajes de los compradores del listado
  const totalViajesEnListado = useMemo(() => {
    return compradores.reduce((total, comprador) => total + getViajesCountForComprador(comprador.id), 0);
  }, [compradores, viajesStats]);

  // Total de viajes generales usando estadísticas
  const totalViajesGenerales = useMemo(() => {
    return Object.values(viajesStats).reduce((total, stats) => total + (stats?.viajesCount || 0), 0);
  }, [viajesStats]);

  // Filtrar y ordenar compradores con lógica inteligente
  const filteredAndSortedCompradores = useMemo(() => {
    const filtered = compradores.filter(comprador => {
      if (!searchTerm.trim()) return true;
      return comprador.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Si hay filtros de ordenamiento manual, usar la lógica anterior
    if (sortBy !== "alfabetico" || sortOrder !== "asc") {
      return filtered.sort((a, b) => {
        if (sortBy === "alfabetico") {
          const comparison = a.nombre.localeCompare(b.nombre);
          return sortOrder === "asc" ? comparison : -comparison;
        } else {
          const viajesA = getViajesCountForComprador(a.id);
          const viajesB = getViajesCountForComprador(b.id);
          const comparison = viajesA - viajesB;
          return sortOrder === "asc" ? comparison : -comparison;
        }
      });
    }

    // Ordenamiento inteligente por defecto
    const grupoA: typeof filtered = []; // Con saldo diferente de cero
    const grupoB: typeof filtered = []; // Saldo cero pero viajes último mes
    const grupoC: typeof filtered = []; // Saldo cero y sin viajes último mes

    filtered.forEach(comprador => {
      const balance = calcularBalanceNeto(comprador.id);
      const viajesUltimoMes = getViajesUltimoMes(comprador.id);

      if (balance !== 0) {
        grupoA.push(comprador);
      } else if (viajesUltimoMes > 0) {
        grupoB.push(comprador);
      } else {
        grupoC.push(comprador);
      }
    });

    // Ordenar cada grupo
    grupoA.sort((a, b) => Math.abs(calcularBalanceNeto(b.id)) - Math.abs(calcularBalanceNeto(a.id)));
    grupoB.sort((a, b) => getViajesUltimoMes(b.id) - getViajesUltimoMes(a.id));
    grupoC.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return [...grupoA, ...grupoB, ...grupoC];
  }, [compradores, searchTerm, sortBy, sortOrder, balancesCompradores, viajesStats]);

  // Calcular balances separados de todos los compradores
  const { saldoAFavor, saldoEnContra } = compradores.reduce((acc, comprador) => {
    const balance = calcularBalanceNeto(comprador.id);
    if (balance > 0) {
      acc.saldoAFavor += balance;
    } else if (balance < 0) {
      acc.saldoEnContra += Math.abs(balance);
    }
    return acc;
  }, { saldoAFavor: 0, saldoEnContra: 0 });

  const balanceTotalCompradores = saldoAFavor - saldoEnContra;

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded mb-2"></div>
                <div className="flex space-x-2 mt-4">
                  <div className="h-8 bg-muted rounded flex-1"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="p-4">
        {/* Indicador sutil de actualización en segundo plano */}
        {isFetchingBalances && Object.keys(balancesCompradores).length > 0 && (
          <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 mb-2">
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Actualizando balances...</span>
            </div>
          </div>
        )}

        {/* Header reorganizado para móviles */}
        <div className="mb-4 space-y-3">
          {/* Primera fila: Título y contador */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-foreground">Compradores</h2>
              <span className="text-sm bg-muted px-2 py-1 rounded-full">
                {searchTerm ? filteredAndSortedCompradores.length : compradores.length}
              </span>
            </div>
            <Button onClick={() => setShowAddComprador(true)} size="icon" className="h-8 w-8">
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
              balanceTotalCompradores >= 0 
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            }`}>
              <div className="text-muted-foreground mb-0.5">Balance</div>
              <div className={`font-semibold truncate ${
                balanceTotalCompradores >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {balanceTotalCompradores >= 0 ? "" : "-"}${formatCurrency(Math.abs(balanceTotalCompradores)).replace('$', '')}
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

          {/* Contadores de viajes */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>Listado:</span>
              <span className="font-semibold text-blue-600">{totalViajesEnListado}</span>
              <span>|</span>
              <span>Total:</span>
              <span className="font-semibold text-blue-600">{totalViajesGenerales}</span>
            </div>
          </div>
          {totalViajesGenerales > totalViajesEnListado && (
            <div className="text-xs text-orange-600">
              ⚠️ Diferencia: {totalViajesGenerales - totalViajesEnListado} viaje(s) inconsistentes
            </div>
          )}
          {searchTerm.trim() && (
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredAndSortedCompradores.length} de {compradores.length}
            </p>
          )}
        </div>

        {/* Casilla de búsqueda compacta */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Buscar comprador por nombre..."
                className="flex-1 h-8 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>



        {filteredAndSortedCompradores.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {compradores.length === 0 
                  ? "No hay compradores registrados" 
                  : "No se encontraron compradores que coincidan con la búsqueda"
                }
              </p>
              <Button onClick={() => setShowAddComprador(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Comprador
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedCompradores.map((comprador) => (
              <Card 
                key={comprador.id}
                className="cursor-pointer hover:shadow-md transition-shadow duration-200 active:scale-[0.98] transition-transform"
                onClick={() => handleViewComprador(comprador.id)}
              >
                <CardContent className="p-4">
                  {/* Fila 1: Ícono + Nombre | Viajes | Botón eliminar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <EditableTitle 
                          id={comprador.id} 
                          currentName={comprador.nombre} 
                          type="comprador" 
                          className="text-base truncate"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-2">
                      <div className="text-right min-w-[50px]">
                        <p className="text-xs sm:text-sm text-muted-foreground">Viajes</p>
                        <p className="font-semibold text-blue-600 text-sm sm:text-base">
                          {getViajesCountForComprador(comprador.id)}
                        </p>
                      </div>
                      {canDeleteComprador(comprador.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComprador(comprador);
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
                      calcularBalanceNeto(comprador.id) >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(calcularBalanceNeto(comprador.id))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Botones de fusión al final del listado */}
        {filteredAndSortedCompradores.length >= 2 && (
          <Card className="mt-4">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Fusión de compradores ({filteredAndSortedCompradores.length} disponibles)
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
      </div>

      <AddCompradorModal 
        open={showAddComprador} 
        onOpenChange={setShowAddComprador}
      />

      <DeleteCompradorModal
        open={showDeleteComprador}
        onOpenChange={setShowDeleteComprador}
        comprador={compradorToDelete}
      />

      {/* Modales de fusión */}
      <MergeEntitiesModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        entities={compradores.map(c => ({ id: c.id, nombre: c.nombre }))}
        entityType="compradores"
        onSuccess={() => {
          // Refrescar datos después de fusión exitosa
          window.location.reload();
        }}
      />

      <FusionHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
      />

      {/* Navegación inferior */}
      <BottomNavigation />
    </div>
  );
}