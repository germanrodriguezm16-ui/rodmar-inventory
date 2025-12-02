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
        {/* Botones de acción */}
        <div className="flex justify-end items-center space-x-2 mb-1">
          <Button 
            onClick={recalcular}
            disabled={isRecalculando}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-600 font-medium"
            title="Recalcular balances precalculados"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRecalculando ? "animate-spin" : ""}`} />
            Recálculo
          </Button>
          <Button 
            onClick={() => setShowAddComprador(true)} 
            size="sm"
            className="h-7 px-2 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Crear
          </Button>
        </div>

        {/* Indicador sutil de actualización en segundo plano */}
        {isFetchingBalances && Object.keys(balancesCompradores).length > 0 && (
          <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 mb-2">
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Actualizando balances...</span>
            </div>
          </div>
        )}

        <div className="mb-3 space-y-2">
          {/* Primera línea horizontal: Título + contador + botones ordenamiento (izquierda) | Balance vertical (derecha) */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Compradores</h2>
              <span className="text-xs sm:text-sm bg-muted px-2 py-0.5 rounded-full">
                {searchTerm ? filteredAndSortedCompradores.length : compradores.length}
              </span>
              <div className="flex space-x-1">
                <button
                  onClick={() => {
                    if (sortBy === "alfabetico") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("alfabetico");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-1.5 py-0.5 text-xs rounded transition-colors flex items-center space-x-1 ${
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
                      setSortOrder("desc"); // Por defecto mayor a menor para viajes
                    }
                  }}
                  className={`px-1.5 py-0.5 text-xs rounded transition-colors flex items-center space-x-1 ${
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
            </div>
            
            {/* Balance financiero vertical a la derecha */}
            <div className="flex flex-col items-end text-right">
              <div className="text-xs text-green-600 font-medium">
                Positivos: {formatCurrency(saldoAFavor)}
              </div>
              <div className="text-xs text-red-600 font-medium">
                Negativos: {formatCurrency(saldoEnContra)}
              </div>
              <div className={`text-xs font-semibold ${
                balanceTotalCompradores >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                Balance: {formatCurrency(balanceTotalCompradores)}
              </div>
            </div>
          </div>

          {/* Segunda línea: Contadores de viajes debajo del título */}
          <div className="ml-0">
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
              <div className="text-xs text-orange-600 mt-1">
                ⚠️ Diferencia: {totalViajesGenerales - totalViajesEnListado} viaje(s) inconsistentes
              </div>
            )}
            {searchTerm.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                Mostrando {filteredAndSortedCompradores.length} de {compradores.length}
              </p>
            )}
          </div>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <EditableTitle 
                          id={comprador.id} 
                          currentName={comprador.nombre} 
                          type="comprador" 
                          className="text-base"
                        />
                        <p className="text-sm text-muted-foreground">ID: {comprador.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Viajes</p>
                        <p className="font-semibold text-blue-600">
                          {getViajesCountForComprador(comprador.id)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Saldo</p>
                        <p className={`font-semibold ${
                          calcularBalanceNeto(comprador.id) >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {formatCurrency(calcularBalanceNeto(comprador.id))}
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
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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