import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import html2canvas from "html2canvas";
import type { ViajeWithDetails, Mina } from "@shared/schema";
import { useNavigationVisibility } from "@/hooks/use-navigation-visibility";

interface ViajesImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mina: Mina;
  viajes: ViajeWithDetails[];
  filterType: string;
  filterValue: string;
  filterValueEnd: string;
}

// Función para formatear fecha en formato DD/MM/YYYY
function formatDateForLabel(dateString: string): string {
  if (!dateString) return "";
  
  // Si la fecha viene en formato YYYY-MM-DD, convertir a DD/MM/YYYY
  if (dateString.includes('-')) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  
  return dateString;
}

// Función para obtener el nombre del filtro aplicado
function getFilterLabel(filterType: string, filterValue: string, filterValueEnd: string): string {
  const formatValue = formatDateForLabel(filterValue);
  const formatValueEnd = formatDateForLabel(filterValueEnd);
  
  const filterLabels: Record<string, string> = {
    "todos": "Todos los Viajes",
    "exactamente": `Fecha: ${formatValue}`,
    "entre": `Entre: ${formatValue} - ${formatValueEnd}`,
    "despues-de": `Después de ${formatValue}`,
    "despues_de": `Después de ${formatValue}`,
    "antes-de": `Antes de ${formatValue}`,
    "antes_de": `Antes de ${formatValue}`,
    "hoy": "Hoy",
    "ayer": "Ayer",
    "esta_semana": "Esta Semana",
    "esta-semana": "Esta Semana",
    "semana_pasada": "Semana Pasada",
    "semana-pasada": "Semana Pasada",
    "este_mes": "Este Mes",
    "este-mes": "Este Mes",
    "mes_pasado": "Mes Pasado",
    "mes-pasado": "Mes Pasado",
    "este_año": "Este Año",
    "este-año": "Este Año",
    "año_pasado": "Año Pasado",
    "año-pasado": "Año Pasado"
  };
  
  return filterLabels[filterType] || "Filtro Personalizado";
}

export default function ViajesImageModal({
  open,
  onOpenChange,
  mina,
  viajes,
  filterType,
  filterValue,
  filterValueEnd
}: ViajesImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const { hideNavigation, showNavigation } = useNavigationVisibility();

  // Controlar la visibilidad de la navegación basado en el estado del modal
  useEffect(() => {
    if (open) {
      hideNavigation();
    } else {
      showNavigation();
    }

    // Cleanup: asegurar que la navegación se muestre cuando el componente se desmonte
    return () => {
      showNavigation();
    };
  }, [open, hideNavigation, showNavigation]);

  if (!open) return null;

  // Calcular balance de viajes
  const viajesCompletados = viajes.filter(viaje => viaje.fechaDescargue && viaje.totalCompra);
  const totalCompras = viajesCompletados.reduce((sum, viaje) => sum + parseFloat(viaje.totalCompra!), 0);
  const filterLabel = getFilterLabel(filterType, filterValue, filterValueEnd);

  const handleDownload = async () => {
    if (!imageRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        height: imageRef.current.scrollHeight,
        width: imageRef.current.scrollWidth
      });

      const link = document.createElement('a');
      link.download = `${mina.nombre}_Viajes_${(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Vista Previa - Reporte de Viajes</span>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                {isGenerating ? "Generando..." : "Descargar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Contenido de la imagen */}
        <div 
          ref={imageRef}
          className="bg-white p-4 rounded-lg"
          style={{ width: '800px', fontSize: '12px', lineHeight: '1.3' }}
        >
          {/* Header del reporte compacto */}
          <div className="text-center mb-4 border-b border-gray-200 pb-3">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">RodMar</h1>
            <h2 className="text-base font-semibold text-gray-700 mb-1">Reporte de Viajes</h2>
            <h3 className="text-sm text-gray-600 mb-2">{mina.nombre}</h3>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Filtro: {filterLabel}</span>
              <span>Fecha: {formatDateWithDaySpanish(new Date())}</span>
            </div>
          </div>

          {/* Resumen de balance compacto */}
          <div className="mb-4">
            <div className="bg-gray-50 rounded p-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Resumen</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{viajes.length}</div>
                  <div className="text-xs text-gray-600">Total Viajes</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(totalCompras.toString())}
                  </div>
                  <div className="text-xs text-gray-600">Total Compras</div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de viajes compacta */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Detalle de Viajes ({viajes.length})
            </h4>
            
            {viajes.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No hay viajes que coincidan con el filtro aplicado
              </div>
            ) : (
              <div className="space-y-1">
                {viajes.map((viaje, index) => (
                  <div key={viaje.id} className="border border-gray-200 rounded p-2">
                    {/* Header con ID y estado en línea compacta */}
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-semibold text-gray-700 text-sm">ID: {viaje.id}</div>
                      <div>
                        {viaje.fechaDescargue ? (
                          <Badge variant="default" className="text-[11px] px-1 py-0 h-4 leading-none">Completado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] px-1 py-0 h-4 leading-none">Pendiente</Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Información del viaje en grid ultra compacto */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="font-medium text-gray-700 text-sm">Conductor</div>
                        <div className="text-gray-600">{viaje.conductor}</div>
                        <div className="text-[11px] text-gray-500">{viaje.placa}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 text-sm">Fechas</div>
                        <div className="text-gray-600 text-[11px]">
                          C: {viaje.fechaCargue ? formatDateWithDaySpanish(viaje.fechaCargue) : 'N/A'}
                        </div>
                        {viaje.fechaDescargue && (
                          <div className="text-gray-600 text-[11px]">
                            D: {formatDateWithDaySpanish(viaje.fechaDescargue)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 text-sm">Valores</div>
                        {viaje.peso && (
                          <div className="text-gray-600 text-[11px]">
                            Peso: {viaje.peso} ton
                          </div>
                        )}
                        {viaje.totalCompra && (
                          <div className="text-green-600 text-[11px] font-medium">
                            {formatCurrency(viaje.totalCompra)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer compacto */}
          <div className="text-center text-[9px] text-gray-500 mt-3 border-t pt-2">
            <div>Generado por RodMar - Sistema de Gestión Minera</div>
            <div>© 2025 - Todos los derechos reservados</div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
            <div>Generado por RodMar - Sistema de Gestión Minera</div>
            <div>© 2024 - Todos los derechos reservados</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}