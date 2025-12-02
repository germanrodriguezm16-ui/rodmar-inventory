import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Edit, Trash2, Search, X, ArrowUpDown, SortAsc, SortDesc, Hash, Merge, History, RefreshCw } from "lucide-react";
import type { VolqueteroConPlacas, TransaccionWithSocio } from "@shared/schema";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { EditableTitle } from "@/components/EditableTitle";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import { parseISO } from "date-fns";
import { useVolqueterosBalance } from "@/hooks/useVolqueterosBalance";
import MergeEntitiesModal from "@/components/fusion/MergeEntitiesModal";
import FusionHistoryModal from "@/components/fusion/FusionHistoryModal";

export default function Volqueteros() {
  const [editingTransaction, setEditingTransaction] = useState<TransaccionWithSocio | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransaccionWithSocio | null>(null);
  const [expandedVolquetero, setExpandedVolquetero] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"transacciones" | "balance">("transacciones");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"alfabetico" | "viajes">("alfabetico");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Usar hook compartido para balances de volqueteros
  const { balancesVolqueteros, resumenFinanciero, volqueteros: volqueterosFromHook, viajesStats, isFetchingBalances } = useVolqueterosBalance();
  
  // Mantener queries locales para datos específicos del módulo
  const { data: volqueteros = [], isLoading } = useQuery({
    queryKey: ["/api/volqueteros"],
    staleTime: 30000,
  });

  const { data: viajes = [] } = useQuery({
    queryKey: ["/api/viajes"],
    staleTime: 30000,
  });

  // Función optimizada para obtener balance (ahora usa hook compartido)
  const calcularBalanceDinamico = (volquetero: VolqueteroConPlacas) => {
    return balancesVolqueteros[volquetero.id] || 0;
  };

  // Calcular suma de viajes individuales de volqueteros
  const sumaViajesVolqueteros = (volqueteros as VolqueteroConPlacas[]).reduce((sum, volquetero) => {
    return sum + (volquetero.viajesCount || 0);
  }, 0);

  const totalViajes = Array.isArray(viajes) ? viajes.length : 0;

  // Función optimizada: usar estadísticas del hook (mapear por ID en lugar de nombre)
  const getViajesUltimoMes = (volqueteroId: number): number => {
    return viajesStats[volqueteroId]?.viajesUltimoMes || 0;
  };

  // Filtrar y ordenar volqueteros con lógica inteligente
  const filteredAndSortedVolqueteros = useMemo(() => {
    const filtered = (volqueteros as VolqueteroConPlacas[]).filter((volquetero) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        volquetero.nombre.toLowerCase().includes(searchLower) ||
        volquetero.placas.some(p => p.placa.toLowerCase().includes(searchLower))
      );
    });

    // Si hay filtros de ordenamiento manual, usar la lógica anterior
    if (sortBy !== "alfabetico" || sortOrder !== "asc") {
      return filtered.sort((a, b) => {
        if (sortBy === "alfabetico") {
          const comparison = a.nombre.localeCompare(b.nombre);
          return sortOrder === "asc" ? comparison : -comparison;
        } else {
          const comparison = (a.viajesCount || 0) - (b.viajesCount || 0);
          return sortOrder === "asc" ? comparison : -comparison;
        }
      });
    }

    // Ordenamiento inteligente por defecto
    const grupoA: typeof filtered = []; // Con saldo diferente de cero
    const grupoB: typeof filtered = []; // Saldo cero pero viajes último mes
    const grupoC: typeof filtered = []; // Saldo cero y sin viajes último mes

    filtered.forEach(volquetero => {
      const balance = calcularBalanceDinamico(volquetero);
      const viajesUltimoMes = getViajesUltimoMes(volquetero.id);

      if (balance !== 0) {
        grupoA.push(volquetero);
      } else if (viajesUltimoMes > 0) {
        grupoB.push(volquetero);
      } else {
        grupoC.push(volquetero);
      }
    });

    // Ordenar cada grupo
    grupoA.sort((a, b) => Math.abs(calcularBalanceDinamico(b)) - Math.abs(calcularBalanceDinamico(a)));
    grupoB.sort((a, b) => getViajesUltimoMes(b.id) - getViajesUltimoMes(a.id));
    grupoC.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return [...grupoA, ...grupoB, ...grupoC];
  }, [volqueteros, searchTerm, sortBy, sortOrder, balancesVolqueteros, viajesStats]);

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Resumen Financiero */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">Volqueteros</h2>
          <span className="text-sm bg-muted px-2 py-1 rounded-full">
            {searchTerm ? filteredAndSortedVolqueteros.length : (volqueteros as VolqueteroConPlacas[]).length}
          </span>
        </div>
        
        {/* Balance General */}
        <div className="flex items-center justify-between text-sm space-x-4">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-muted-foreground">Positivos: </span>
              <span className="text-green-600 font-medium">{formatCurrency(resumenFinanciero.positivos.toString())}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Negativos: </span>
              <span className="text-red-600 font-medium">{formatCurrency(resumenFinanciero.negativos.toString())}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Balance: </span>
              <span className={`font-medium ${
                resumenFinanciero.balance > 0 
                  ? 'text-green-600' 
                  : resumenFinanciero.balance < 0 
                  ? 'text-red-600' 
                  : 'text-gray-600'
              }`}>
                {formatCurrency(resumenFinanciero.balance.toString())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador sutil de actualización en segundo plano */}
      {isFetchingBalances && Object.keys(balancesVolqueteros).length > 0 && (
        <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 mb-2">
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Actualizando balances...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="ml-2 flex space-x-1">
            <button
              onClick={() => {
                if (sortBy === "alfabetico") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("alfabetico");
                  setSortOrder("asc");
                }
              }}
              className={`px-2 py-1 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
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
              className={`px-2 py-1 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
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
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total viajes</p>
          <p className="text-lg font-semibold text-foreground">
            {totalViajes}
          </p>
          <p className="text-xs text-muted-foreground">
            Suma volqueteros: {sumaViajesVolqueteros}
          </p>
          {totalViajes !== sumaViajesVolqueteros && (
            <div className="text-xs text-orange-600">
              <p>⚠️ Diferencia: {totalViajes - sumaViajesVolqueteros}</p>
              <p className="text-xs text-orange-500">
                {totalViajes - sumaViajesVolqueteros} viaje(s) pendiente(s) o sin conductor
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Los volqueteros se crean automáticamente al registrar transacciones
      </p>

      {/* Campo de búsqueda */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o placa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm("")}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>



      {(volqueteros as VolqueteroConPlacas[]).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay volqueteros registrados</p>
            <p className="text-sm text-muted-foreground mt-2">
              Se crearán automáticamente al registrar el primer viaje
            </p>
          </CardContent>
        </Card>
      ) : filteredAndSortedVolqueteros.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No se encontraron volqueteros</p>
            <p className="text-sm text-muted-foreground mt-2">
              Intenta con otros términos de búsqueda
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredAndSortedVolqueteros.map((volquetero: VolqueteroConPlacas) => (
            <Card key={volquetero.id}>
              <CardContent className="p-3">
                <Link href={`/volqueteros/${encodeURIComponent(volquetero.nombre)}`}>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors p-2 -m-2 rounded-md">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <EditableTitle 
                            id={volquetero.id} 
                            currentName={volquetero.nombre} 
                            type="volquetero" 
                            className="text-base font-medium"
                          />
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Balance</p>
                            <p className={`text-sm font-semibold ${
                              calcularBalanceDinamico(volquetero) > 0 
                                ? 'text-green-600' 
                                : calcularBalanceDinamico(volquetero) < 0 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                            }`}>
                              {formatCurrency(calcularBalanceDinamico(volquetero).toString())}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex flex-wrap gap-2">
                            {volquetero.placas.map((placaInfo) => (
                              <span 
                                key={placaInfo.placa} 
                                className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs"
                              >
                                <span className="font-medium">{placaInfo.placa}</span>
                                <span className="text-muted-foreground ml-1">({placaInfo.viajesCount})</span>
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground font-medium ml-2">
                            {volquetero.viajesCount} total
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                
                <div className="flex space-x-2 mt-3">
                  <Button 
                    variant={expandedVolquetero === volquetero.id && activeTab === "transacciones" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (expandedVolquetero === volquetero.id && activeTab === "transacciones") {
                        setExpandedVolquetero(null);
                      } else {
                        setExpandedVolquetero(volquetero.id);
                        setActiveTab("transacciones");
                      }
                    }}
                  >
                    Transacciones
                  </Button>
                  <Button 
                    variant={expandedVolquetero === volquetero.id && activeTab === "balance" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (expandedVolquetero === volquetero.id && activeTab === "balance") {
                        setExpandedVolquetero(null);
                      } else {
                        setExpandedVolquetero(volquetero.id);
                        setActiveTab("balance");
                      }
                    }}
                  >
                    Balance
                  </Button>
                </div>

                {expandedVolquetero === volquetero.id && (
                  <div className="mt-4 pt-4 border-t">
                    <VolqueteroTabContent 
                      volquetero={volquetero} 
                      activeTab={activeTab}
                      onEditTransaction={setEditingTransaction}
                      onDeleteTransaction={setDeletingTransaction}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Botones de fusión al final del listado */}
      {filteredAndSortedVolqueteros.length >= 2 && (
        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Fusión de volqueteros ({filteredAndSortedVolqueteros.length} disponibles)
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

      {/* Modales de transacciones */}
      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {deletingTransaction && (
        <DeleteTransactionModal
          isOpen={!!deletingTransaction}
          transaction={deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
        />
      )}

      {/* Modales de fusión */}
      <MergeEntitiesModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        entities={volqueteros.map(v => ({ id: v.id, nombre: v.nombre }))}
        entityType="volqueteros"
        onSuccess={() => {
          // Refrescar datos después de fusión exitosa
          window.location.reload();
        }}
      />

      <FusionHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
      />
    </div>
  );
}

interface VolqueteroTabContentProps {
  volquetero: VolqueteroConPlacas;
  activeTab: "transacciones" | "balance";
  onEditTransaction: (transaction: TransaccionWithSocio) => void;
  onDeleteTransaction: (transaction: TransaccionWithSocio) => void;
}

function VolqueteroTabContent({ volquetero, activeTab, onEditTransaction, onDeleteTransaction }: VolqueteroTabContentProps) {
  // Always fetch data - hooks must be called unconditionally
  const { data: transacciones = [] } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones/socio", "volquetero", volquetero.id],
    queryFn: () => fetch(`/api/transacciones/socio/volquetero/${volquetero.id}`).then(res => res.json()),
  });

  if (activeTab === "transacciones") {
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Transacciones</h4>
        {transacciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay transacciones registradas</p>
        ) : (
          transacciones.map((transaccion: TransaccionWithSocio) => (
            <div key={transaccion.id} className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{transaccion.concepto}</span>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onEditTransaction(transaccion)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        onClick={() => onDeleteTransaction(transaccion)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateWithDaySpanish(transaccion.fecha instanceof Date ? transaccion.fecha : parseISO(transaccion.fecha))}</span>
                    <p className={`font-semibold text-sm ${
                      (() => {
                        // Nueva lógica unificada: basada en el destino de la transacción
                        // ROJO/NEGATIVO: destino mina, comprador, volquetero
                        // VERDE/POSITIVO: destino RodMar, Banco
                        
                        const isToPartner = transaccion.paraQuienTipo === 'mina' || 
                                          transaccion.paraQuienTipo === 'comprador' || 
                                          transaccion.paraQuienTipo === 'volquetero';
                        const isToRodMarOrBank = transaccion.paraQuienTipo === 'rodmar' || 
                                               transaccion.paraQuienTipo === 'banco';
                        
                        if (isToPartner) {
                          return "text-red-600 dark:text-red-400"; // ROJO para destino socios
                        } else if (isToRodMarOrBank) {
                          return "text-green-600 dark:text-green-400"; // VERDE para destino RodMar/Banco
                        }
                        
                        // Fallback para otros casos
                        return "text-gray-600 dark:text-gray-400";
                      })()
                    }`}>
                      {formatCurrency(transaccion.valor)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (activeTab === "balance") {
    const totalCredito = transacciones
      .filter(t => parseFloat(t.valor) > 0 && t.paraQuienTipo !== 'volquetero')
      .reduce((sum, t) => sum + parseFloat(t.valor), 0);
    
    // Débito incluye transacciones negativas Y transacciones manuales hacia volquetero
    const totalDebito = transacciones
      .filter(t => parseFloat(t.valor) < 0 || t.paraQuienTipo === 'volquetero')
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.valor)), 0);

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Balance</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 font-medium">A favor del volquetero</p>
            <p className="text-green-700 font-semibold">{formatCurrency(totalCredito)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-600 font-medium">Pagos realizados</p>
            <p className="text-red-700 font-semibold">{formatCurrency(totalDebito)}</p>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium">Saldo Total</p>
          <p className={`font-semibold ${
            parseFloat(volquetero.saldo || '0') >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(volquetero.saldo || '0')}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
