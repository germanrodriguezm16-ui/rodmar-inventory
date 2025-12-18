import { useState, memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Calendar, User, Mountain, Handshake, Weight, DollarSign, Eye, EyeOff, Receipt } from "lucide-react";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import { ImageViewer } from "@/components/ui/image-viewer";
import { apiUrl } from "@/lib/api";
import { getAuthToken } from "@/hooks/useAuth";
import type { ViajeWithDetails } from "@shared/schema";

// Extender window para función global
declare global {
  interface Window {
    editTripGlobal?: (viaje: ViajeWithDetails) => void;
  }
}

interface TripCardProps {
  viaje: ViajeWithDetails;
  showExtended?: boolean;
  onClick?: () => void;
  onEditTrip?: (viaje: ViajeWithDetails) => void;
  onDeleteTrip?: (viaje: ViajeWithDetails) => void;
  isSelected?: boolean;
  onSelect?: (isSelected: boolean) => void;
  context?: 'default' | 'volquetero' | 'mina' | 'comprador';
  index?: number;
}

function TripCard({ viaje, showExtended = false, onClick, onEditTrip, onDeleteTrip, isSelected = false, onSelect, context = 'default', index = 0 }: TripCardProps) {
  const [showIndividualFinancial, setShowIndividualFinancial] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  // Memoizar cálculos pesados
  const memoizedValues = useMemo(() => {
    const formatCurrency = (amount: string | null | undefined, compact = false) => {
      if (!amount) return "N/A";
      const num = parseFloat(amount);
      
      if (compact) {
        if (num >= 1000000) {
          return `$${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
          return `$${(num / 1000).toFixed(0)}K`;
        }
        return `$${num.toLocaleString('es-CO')}`;
      }
      
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(num);
    };

    // Pre-calcular valores que se usan múltiples veces
    const totalVenta = parseFloat(viaje.totalVenta || "0");
    const totalFlete = parseFloat(viaje.totalFlete || "0");
    const valorConsignar = parseFloat(viaje.valorConsignar || "0");

    return {
      formatCurrency,
      totalVenta,
      totalFlete,
      valorConsignar,
      formattedDates: {
        cargue: viaje.fechaCargue ? formatDateWithDaySpanish(viaje.fechaCargue) : "Pendiente",
        descargue: viaje.fechaDescargue ? formatDateWithDaySpanish(viaje.fechaDescargue) : "Pendiente"
      }
    };
  }, [viaje.totalVenta, viaje.totalFlete, viaje.quienPagaFlete, viaje.fechaCargue, viaje.fechaDescargue]);

  const { formatCurrency } = memoizedValues;
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("NEW TripCard clicked:", viaje.id);
    console.log("NEW onClick function:", typeof onClick);
    if (onClick && typeof onClick === 'function') {
      console.log("NEW Calling onClick function");
      try {
        onClick();
        console.log("NEW onClick executed successfully");
      } catch (error) {
        console.error("NEW Error executing onClick:", error);
      }
    } else {
      console.log("NEW No onClick function provided or not a function");
    }
  };

  const formatDate = (dateString: string | Date | null, compact = false) => {
    if (!dateString) return compact ? "N/A" : "Pendiente";
    if (compact) {
      // Formato compacto con año: "Lun. 29/6/25"
      // Usar la misma lógica que formatDateWithDaySpanish para consistencia
      let date: Date;
      if (typeof dateString === 'string') {
        // Si es solo fecha (YYYY-MM-DD), tratarla como UTC
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          date = new Date(dateString + 'T00:00:00.000Z');
        } else {
          // Si ya tiene hora, usarla tal como está
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayName = days[date.getUTCDay()];
      const day = date.getUTCDate();
      const month = date.getUTCMonth() + 1;
      const year = date.getUTCFullYear().toString().slice(-2);
      return `${dayName}. ${day}/${month}/${year}`;
    }
    return formatDateWithDaySpanish(dateString);
  };

  const getStatusBadge = () => {
    if (viaje.estado === "completado") {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          Completado
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          Pendiente
        </Badge>
      );
    }
  };

  const getStatusIcon = () => {
    if (viaje.estado === "completado") {
      return "text-success";
    } else {
      return "text-warning";
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(e.target.checked);
    }
  };

  // Definir colores intercalados basados en el índice
  const getAlternatingBackground = () => {
    if (index % 2 === 0) {
      return 'bg-gray-50 dark:bg-gray-900/50'; // Color para tarjetas pares
    } else {
      return 'bg-blue-100 dark:bg-blue-900/40'; // Color azul más fuerte para tarjetas impares
    }
  };

  return (
    <>
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow duration-200 ${isSelected ? 'ring-2 ring-primary' : ''} ${getAlternatingBackground()}`} 
      onClick={handleClick}
    >
      <CardContent className="p-3">
        {/* Header ultra-compacto */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(e.target.checked)}
                className="w-3 h-3 rounded border"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
              <Truck className={`w-3.5 h-3.5 ${getStatusIcon()}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{viaje.id}</h3>
              <p className="text-xs text-muted-foreground">{viaje.estado}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Grid principal ultra-compacto 3x3 */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          {/* Fila 1: Fechas y Conductor */}
          <div className="col-span-1">
            <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              Cargue
            </p>
            <p className="font-medium text-xs leading-tight">{formatDate(viaje.fechaCargue, true)}</p>
          </div>
          <div className="col-span-1">
            <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              Descargue
            </p>
            <p className={`font-medium text-xs leading-tight ${!viaje.fechaDescargue ? "text-muted-foreground" : ""}`}>
              {formatDate(viaje.fechaDescargue, true)}
            </p>
          </div>
          <div className="col-span-1">
            <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              Conductor
            </p>
            <p className="font-medium text-xs leading-tight truncate">{viaje.conductor}</p>
          </div>
          
          {/* Fila 2: Vehículo */}
          <div className="col-span-1">
            <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
              <Truck className="w-2.5 h-2.5" />
              Placa
            </p>
            <p className="font-medium text-xs leading-tight">{viaje.placa}</p>
          </div>
          <div className="col-span-1">
            <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
              <Truck className="w-2.5 h-2.5" />
              Tipo
            </p>
            <p className="font-medium text-xs leading-tight capitalize">{viaje.tipoCarro || "N/A"}</p>
          </div>
          <div className="col-span-1">
            <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
              <Weight className="w-2.5 h-2.5" />
              Peso
            </p>
            <p className="font-medium text-xs leading-tight">{viaje.peso ? `${viaje.peso}T` : "N/A"}</p>
          </div>
          
          {/* Fila 3: Comercial o Volquetero específico */}
          {context === 'volquetero' ? (
            <>
              <div className="col-span-1">
                <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  FUT
                </p>
                <p className="font-medium text-xs leading-tight text-blue-600">
                  {formatCurrency(viaje.fleteTon?.toString() || '0')}
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  OGF
                </p>
                <p className="font-medium text-xs leading-tight text-orange-600">
                  {formatCurrency(viaje.otrosGastosFlete || '0')}
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  T. Flete
                </p>
                <p className="font-medium text-xs leading-tight text-purple-600">
                  {formatCurrency(viaje.totalFlete?.toString() || '0')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-1">
                <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
                  <Mountain className="w-2.5 h-2.5" />
                  Mina
                </p>
                <p className="font-medium text-xs leading-tight truncate" title={viaje.mina?.nombre}>
                  {viaje.mina?.nombre || "N/A"}
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1">
                  <Handshake className="w-2.5 h-2.5" />
                  Comprador
                </p>
                <p className={`font-medium text-xs leading-tight truncate ${!viaje.comprador ? "text-muted-foreground" : ""}`}
                   title={viaje.comprador?.nombre || "Por asignar"}>
                  {viaje.comprador?.nombre || "Por asignar"}
                </p>
              </div>
              <div className="col-span-1">
                {viaje.tieneRecibo ? (
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!receiptImageUrl && !isLoadingReceipt) {
                        setIsLoadingReceipt(true);
                        try {
                          const token = getAuthToken();
                          const headers: Record<string, string> = {};
                          if (token) {
                            headers["Authorization"] = `Bearer ${token}`;
                          }
                          const response = await fetch(apiUrl(`/recibo/${viaje.id}`), {
                            credentials: "include",
                            headers,
                          });
                          if (response.ok) {
                            const contentType = response.headers.get("content-type") || "";
                            if (contentType.includes("application/json")) {
                              const data = await response.json();
                              if (typeof data?.recibo === "string") {
                                setReceiptImageUrl(data.recibo);
                              }
                            } else {
                              const blob = await response.blob();
                              // Convertir blob a data URL para que persista (no necesita revocación)
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                const dataUrl = reader.result as string;
                                setReceiptImageUrl(dataUrl);
                              };
                              reader.readAsDataURL(blob);
                            }
                          }
                        } catch (error) {
                          console.error("Error loading receipt:", error);
                        } finally {
                          setIsLoadingReceipt(false);
                        }
                      }
                      setShowReceipt(true);
                    }}
                    className="w-full text-[10px] py-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:text-blue-300 rounded-md transition-colors flex items-center justify-center gap-1"
                    title="Ver recibo"
                    disabled={isLoadingReceipt}
                  >
                    <Receipt className="w-2.5 h-2.5" />
                    <span className="text-[9px]">Ver recibo</span>
                  </button>
                ) : (
                  <div className="text-[10px] text-muted-foreground">
                    Sin recibo
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Fila 4: QPF para volqueteros */}
          {context === 'volquetero' && (
            <div className="col-span-3 pt-1 border-t border-border/30">
              <p className="text-muted-foreground text-[10px] mb-0.5">
                ¿QPF?
              </p>
              <p className="font-medium text-xs leading-tight text-indigo-600">
                {viaje.quienPagaFlete === "comprador" || viaje.quienPagaFlete === "El comprador" 
                  ? "El comprador" 
                  : viaje.quienPagaFlete === "tu" || viaje.quienPagaFlete === "Tú" || viaje.quienPagaFlete === "RodMar"
                  ? "RodMar" 
                  : viaje.quienPagaFlete || "N/A"}
              </p>
            </div>
          )}
        </div>

        {/* Botones de acción siempre visibles */}
        <div className="flex gap-1.5 pt-2 mt-2 border-t border-border/50">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onEditTrip) {
                onEditTrip(viaje);
              } else if (onClick) {
                onClick();
              }
            }}
            className="flex-1 text-xs py-1.5 px-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
          >
            Editar
          </button>
          
          {/* Botón individual de información financiera - solo para viajes completados */}
          {viaje.fechaDescargue && (viaje.vut || viaje.cut || viaje.fleteTon || viaje.totalVenta || viaje.totalCompra || viaje.totalFlete) && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowIndividualFinancial(!showIndividualFinancial);
              }}
              className={`text-xs py-1.5 px-2 rounded-md transition-colors ${
                showIndividualFinancial 
                  ? 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-800/40 dark:text-green-300' 
                  : 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {showIndividualFinancial ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
          
          {onDeleteTrip && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteTrip(viaje);
              }}
              className="text-xs py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors"
            >
              🗑️
            </button>
          )}
        </div>



        {/* Vista individual de información financiera */}
        {showIndividualFinancial && viaje.fechaDescargue && (viaje.vut || viaje.cut || viaje.fleteTon || viaje.totalVenta || viaje.totalCompra || viaje.totalFlete) && (
          <div className="mt-3 pt-3 border-t border-border">
            <h4 className="font-medium mb-3 text-foreground text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Información Financiera
            </h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">VUT (Venta/Ton)</p>
                <p className="font-medium">{formatCurrency(viaje.vut?.toString() || viaje.ventaTon)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">CUT (Compra/Ton)</p>
                <p className="font-medium">{formatCurrency(viaje.cut?.toString() || viaje.precioCompraTon)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">FUT (Flete/Ton)</p>
                <p className="font-medium">{formatCurrency(viaje.fleteTon?.toString() || '0')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Otros Gastos</p>
                <p className="font-medium">{formatCurrency(viaje.otrosGastosFlete || '0')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Venta</p>
                <p className="font-medium text-green-600">{formatCurrency(viaje.totalVenta?.toString())}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Compra</p>
                <p className="font-medium text-red-600">{formatCurrency(viaje.totalCompra?.toString())}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Flete</p>
                <p className="font-medium text-orange-600">{formatCurrency(viaje.totalFlete?.toString())}</p>
              </div>
              {viaje.totalVenta && viaje.totalFlete && (
                <div>
                  <p className="text-muted-foreground text-xs">Valor Consignar</p>
                  <p className="font-medium text-blue-600">
                    {(() => {
                      const totalVenta = parseFloat(viaje.totalVenta || '0');
                      const totalFlete = parseFloat(viaje.totalFlete || '0');
                      const esCompradorPagaFlete = viaje.quienPagaFlete === "El comprador" || viaje.quienPagaFlete === "comprador";
                      const valorConsignar = parseFloat(viaje.valorConsignar || "0");
                      return formatCurrency(valorConsignar.toString());
                    })()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">Ganancia Neta</p>
                <p className={`font-medium ${(() => {
                  const totalVenta = parseFloat(viaje.totalVenta || '0');
                  const totalCompra = parseFloat(viaje.totalCompra || '0');
                  const totalFlete = parseFloat(viaje.totalFlete || '0');
                  const gananciaNeta = totalVenta - totalCompra - totalFlete;
                  return gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600';
                })()}`}>
                  {(() => {
                    const totalVenta = parseFloat(viaje.totalVenta || '0');
                    const totalCompra = parseFloat(viaje.totalCompra || '0');
                    const totalFlete = parseFloat(viaje.totalFlete || '0');
                    const gananciaNeta = totalVenta - totalCompra - totalFlete;
                    return formatCurrency(gananciaNeta.toString());
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vista detallada global - Solo para viajes completados (con descargue) */}
        {showExtended && !showIndividualFinancial && viaje.fechaDescargue && (viaje.vut || viaje.cut || viaje.fleteTon || viaje.totalVenta || viaje.totalCompra || viaje.totalFlete) && (
          <div className="mt-3 pt-3 border-t border-border">
            <h4 className="font-medium mb-3 text-foreground text-sm">Detalles Financieros</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">VUT (Venta/Ton)</p>
                <p className="font-medium">{formatCurrency(viaje.vut?.toString() || viaje.ventaTon)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">CUT (Compra/Ton)</p>
                <p className="font-medium">{formatCurrency(viaje.cut?.toString() || viaje.precioCompraTon)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">FUT (Flete/Ton)</p>
                <p className="font-medium">{formatCurrency(viaje.fleteTon?.toString() || '0')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Otros Gastos</p>
                <p className="font-medium">{formatCurrency(viaje.otrosGastosFlete || '0')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Venta</p>
                <p className="font-medium text-green-600">{formatCurrency(viaje.totalVenta?.toString())}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Compra</p>
                <p className="font-medium text-red-600">{formatCurrency(viaje.totalCompra?.toString())}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Flete</p>
                <p className="font-medium text-orange-600">{formatCurrency(viaje.totalFlete?.toString())}</p>
              </div>
              {viaje.totalVenta && viaje.totalFlete && (
                <div>
                  <p className="text-muted-foreground text-xs">Valor Consignar</p>
                  <p className="font-medium text-blue-600">
                    {(() => {
                      const totalVenta = parseFloat(viaje.totalVenta || '0');
                      const totalFlete = parseFloat(viaje.totalFlete || '0');
                      const esCompradorPagaFlete = viaje.quienPagaFlete === "El comprador" || viaje.quienPagaFlete === "comprador";
                      const valorConsignar = parseFloat(viaje.valorConsignar || "0");
                      return formatCurrency(valorConsignar.toString());
                    })()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">Ganancia Neta</p>
                <p className={`font-medium ${(() => {
                  const totalVenta = parseFloat(viaje.totalVenta || '0');
                  const totalCompra = parseFloat(viaje.totalCompra || '0');
                  const totalFlete = parseFloat(viaje.totalFlete || '0');
                  const gananciaNeta = totalVenta - totalCompra - totalFlete;
                  return gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600';
                })()}`}>
                  {(() => {
                    const totalVenta = parseFloat(viaje.totalVenta || '0');
                    const totalCompra = parseFloat(viaje.totalCompra || '0');
                    const totalFlete = parseFloat(viaje.totalFlete || '0');
                    const gananciaNeta = totalVenta - totalCompra - totalFlete;
                    return formatCurrency(gananciaNeta.toString());
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}




      </CardContent>
    </Card>
    <ImageViewer
      isOpen={showReceipt}
      onClose={() => {
        setShowReceipt(false);
        // Ya no necesitamos revocar porque usamos data URL (persistente)
      }}
      imageUrl={receiptImageUrl || undefined}
      title="Recibo del Viaje"
    />
  </>
  );
}

// Memoizar el componente para evitar re-renders innecesarios
export default memo(TripCard);
