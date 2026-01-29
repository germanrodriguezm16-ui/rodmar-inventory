import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import html2canvas from "html2canvas";
import type { ViajeWithDetails, Comprador } from "@shared/schema";

interface CompradorViajesImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprador: Comprador;
  viajes: ViajeWithDetails[];
  filterType: string;
  filterValue: string;
  filterValueEnd: string;
}

function getFilterLabel(filterType: string, filterValue: string, filterValueEnd: string): string {
  const filterLabels: Record<string, string> = {
    "todos": "Todos los Viajes",
    "exactamente": `Fecha: ${filterValue}`,
    "entre": `Entre: ${filterValue} - ${filterValueEnd}`,
    "despues-de": `Después de: ${filterValue}`,
    "antes-de": `Antes de: ${filterValue}`,
    "hoy": "Hoy",
    "ayer": "Ayer",
    "esta-semana": "Esta Semana",
    "semana-pasada": "Semana Pasada",
    "este-mes": "Este Mes",
    "mes-pasado": "Mes Pasado",
    "este-ano": "Este Año",
    "ano-pasado": "Año Pasado"
  };
  
  return filterLabels[filterType] || "Filtro Personalizado";
}

export default function CompradorViajesImageModal({
  open,
  onOpenChange,
  comprador,
  viajes,
  filterType,
  filterValue,
  filterValueEnd
}: CompradorViajesImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [saldoAnteriorInput, setSaldoAnteriorInput] = useState("");
  const [saldoAnteriorTipo, setSaldoAnteriorTipo] = useState<"contra" | "favor">("contra");
  const [previewScale, setPreviewScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const updateScale = () => {
      const wrapper = previewWrapperRef.current;
      const content = imageRef.current;
      if (!wrapper || !content) return;
      const availableWidth = wrapper.clientWidth;
      const contentWidth = content.scrollWidth;
      if (!availableWidth || !contentWidth) return;
      const nextScale = Math.min(1, availableWidth / contentWidth);
      setPreviewScale(nextScale);
    };

    const rafId = requestAnimationFrame(updateScale);
    window.addEventListener("resize", updateScale);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateScale);
    };
  }, [open, viajes.length, filterType, filterValue, filterValueEnd, saldoAnteriorInput, saldoAnteriorTipo]);

  if (!open) return null;

  // Calcular totales de viajes
  const viajesCompletados = viajes.filter(viaje => viaje.fechaDescargue && viaje.valorConsignar);
  const totalConsignar = viajesCompletados.reduce((sum, viaje) => sum + parseFloat(viaje.valorConsignar || "0"), 0);
  const totalVenta = viajesCompletados.reduce((sum, viaje) => sum + parseFloat(viaje.totalVenta || "0"), 0);
  const esCompradorPagaFlete = (quienPagaFlete?: string | null) =>
    quienPagaFlete === "comprador" || quienPagaFlete === "El comprador";
  const hayFletesPagadosPorComprador = viajes.some((v) => esCompradorPagaFlete(v.quienPagaFlete));
  const totalPeso = viajesCompletados.reduce((sum, viaje) => sum + parseFloat(viaje.peso || "0"), 0);
  const sumVut = viajesCompletados.reduce((sum, viaje) => {
    const vut = parseFloat(viaje.vut || "");
    if (Number.isNaN(vut)) return sum;
    return sum + vut;
  }, 0);
  const countVut = viajesCompletados.reduce((count, viaje) => {
    const vut = parseFloat(viaje.vut || "");
    if (Number.isNaN(vut)) return count;
    return count + 1;
  }, 0);
  const avgVut = countVut > 0 ? (sumVut / countVut) : null;

  const sumFut = viajesCompletados.reduce((sum, viaje) => {
    if (!esCompradorPagaFlete(viaje.quienPagaFlete)) return sum;
    const fut = parseFloat(viaje.fleteTon || "");
    if (Number.isNaN(fut)) return sum;
    return sum + fut;
  }, 0);
  const countFut = viajesCompletados.reduce((count, viaje) => {
    if (!esCompradorPagaFlete(viaje.quienPagaFlete)) return count;
    const fut = parseFloat(viaje.fleteTon || "");
    if (Number.isNaN(fut)) return count;
    return count + 1;
  }, 0);
  const avgFut = countFut > 0 ? (sumFut / countFut) : null;

  const totalOgf = viajesCompletados.reduce((sum, viaje) => {
    if (!esCompradorPagaFlete(viaje.quienPagaFlete)) return sum;
    return sum + parseFloat(viaje.otrosGastosFlete || "0");
  }, 0);
  const totalFlete = viajesCompletados.reduce((sum, viaje) => {
    if (!esCompradorPagaFlete(viaje.quienPagaFlete)) return sum;
    return sum + parseFloat(viaje.totalFlete || "0");
  }, 0);
  const filterLabel = getFilterLabel(filterType, filterValue, filterValueEnd);

  const saldoAnteriorNumerico = parseFloat(saldoAnteriorInput.replace(/[^\d.-]/g, "")) || 0;
  const saldoAnteriorAjuste = saldoAnteriorTipo === "contra" ? saldoAnteriorNumerico : -saldoAnteriorNumerico;
  const totalConSaldoAnterior = totalConsignar + saldoAnteriorAjuste;

  const handleDownload = async () => {
    if (!imageRef.current) return;

    setIsGenerating(true);
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        height: imageRef.current.scrollHeight,
        width: imageRef.current.scrollWidth
      });

      const link = document.createElement('a');
      link.download = `${comprador.nombre}_Viajes_${(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generando imagen:', error);
    } finally {
      setIsGenerating(false);
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-2 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-sm sm:text-base">Vista Previa - Viajes de {comprador.nombre}</span>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {isGenerating ? "Generando..." : "PNG"}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                size="icon"
                className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Controles rápidos (no aparecen en la imagen) */}
        <div className="mb-3 sm:mb-4 p-3 sm:p-4 border rounded-lg bg-gray-50">
          <div className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Saldo anterior (manual, afecta total del reporte)
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded px-2 py-1 text-xs sm:text-sm bg-white"
              value={saldoAnteriorTipo}
              onChange={(e) => setSaldoAnteriorTipo(e.target.value as "contra" | "favor")}
            >
              <option value="contra">En contra del comprador</option>
              <option value="favor">A favor del comprador</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Valor"
              className="border rounded px-2 py-1 text-xs sm:text-sm w-32 bg-white"
              value={saldoAnteriorInput}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.,-]/g, "");
                setSaldoAnteriorInput(next);
              }}
            />
            <div className="text-[11px] sm:text-xs text-gray-500">
              Vista previa: {saldoAnteriorTipo === "contra" ? "+" : "-"}
              {formatCurrency(Math.abs(saldoAnteriorNumerico))}
            </div>
          </div>
        </div>

        {/* Contenido de la imagen */}
        <div ref={previewWrapperRef} className="w-full overflow-hidden">
          <div
            style={{
              transform: `scale(${isExporting ? 1 : previewScale})`,
              transformOrigin: "top left",
              width: "fit-content"
            }}
          >
            <div ref={imageRef} className="bg-white p-3 sm:p-6 rounded-lg">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6 border-b pb-2 sm:pb-4 bg-slate-50/70 rounded-md">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">RodMar - Historial de Viajes</h2>
            <h3 className="text-base sm:text-xl font-semibold text-blue-600 mb-1 sm:mb-2">Comprador: {comprador.nombre}</h3>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-[10px] sm:text-sm text-gray-600">
              <span>Filtro: {filterLabel}</span>
              <span className="hidden sm:inline">•</span>
              <span>Total Viajes: {viajes.length}</span>
              <span className="hidden sm:inline">•</span>
              <span>Fecha: {new Date().toLocaleDateString('es-ES')}</span>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 p-2 sm:p-4">
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">VIAJES COMPLETADOS</p>
              <p className="text-sm sm:text-lg font-bold text-blue-600">{viajesCompletados.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">TOTAL A CONSIGNAR</p>
              <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(totalConsignar)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">SALDO ANTERIOR</p>
              <p className={`text-sm sm:text-lg font-bold ${saldoAnteriorTipo === "contra" ? "text-green-600" : "text-red-600"}`}>
                {saldoAnteriorAjuste >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(saldoAnteriorAjuste))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">TOTAL CON SALDO ANTERIOR</p>
              <div
                className={`mx-auto inline-block rounded-md border border-gray-200 px-2 py-1 ${
                  isExporting ? "bg-transparent" : "bg-green-50/60"
                }`}
              >
                <p className={`text-sm sm:text-lg font-bold ${totalConSaldoAnterior >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrency(totalConSaldoAnterior)}
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de Viajes */}
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full border-collapse border border-gray-300 text-[9px] sm:text-xs min-w-full">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">ID</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">F. CARGUE</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">F. DESCARGUE</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">CONDUCTOR</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">TIPO CARRO</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">PLACA</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">PESO</th>
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">VUT</th>
                  {hayFletesPagadosPorComprador && (
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">FUT</th>
                  )}
                  {hayFletesPagadosPorComprador && (
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">OGF</th>
                  )}
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">T. VENTA</th>
                  {hayFletesPagadosPorComprador && (
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">T. FLETE</th>
                  )}
                  <th className="border border-gray-300 p-1 sm:p-2 text-left">A CONSIGNAR</th>
                </tr>
              </thead>
              <tbody>
                {viajes.map((viaje, index) => (
                  <tr key={viaje.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 p-1 sm:p-2 font-medium">{viaje.id}</td>
                    <td className="border border-gray-300 p-1 sm:p-2">
                      {viaje.fechaCargue ? formatDateWithDaySpanish(viaje.fechaCargue) : "-"}
                    </td>
                    <td className="border border-gray-300 p-1 sm:p-2">
                      {viaje.fechaDescargue ? formatDateWithDaySpanish(viaje.fechaDescargue) : "Pendiente"}
                    </td>
                    <td className="border border-gray-300 p-1 sm:p-2">{viaje.conductor}</td>
                    <td className="border border-gray-300 p-1 sm:p-2">{viaje.tipoCarro}</td>
                    <td className="border border-gray-300 p-1 sm:p-2">{viaje.placa}</td>
                    <td className="border border-gray-300 p-1 sm:p-2">{viaje.peso || "-"}</td>
                    <td className="border border-gray-300 p-1 sm:p-2">
                      {viaje.vut ? formatCurrency(viaje.vut) : "-"}
                    </td>
                    {hayFletesPagadosPorComprador && (
                    <td className="border border-gray-300 p-1 sm:p-2">
                        {esCompradorPagaFlete(viaje.quienPagaFlete) && viaje.fleteTon ? formatCurrency(viaje.fleteTon) : "-"}
                    </td>
                    )}
                    {hayFletesPagadosPorComprador && (
                    <td className="border border-gray-300 p-1 sm:p-2">
                        {esCompradorPagaFlete(viaje.quienPagaFlete) && viaje.otrosGastosFlete ? formatCurrency(viaje.otrosGastosFlete) : "-"}
                    </td>
                    )}
                    <td className="border border-gray-300 p-1 sm:p-2">
                      {viaje.totalVenta ? formatCurrency(viaje.totalVenta) : "-"}
                    </td>
                    {hayFletesPagadosPorComprador && (
                    <td className="border border-gray-300 p-1 sm:p-2">
                        {esCompradorPagaFlete(viaje.quienPagaFlete) && viaje.totalFlete ? formatCurrency(viaje.totalFlete) : "-"}
                    </td>
                    )}
                    <td className="border border-gray-300 p-1 sm:p-2 font-semibold text-green-600">
                      {viaje.valorConsignar ? formatCurrency(viaje.valorConsignar) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Fila de totales */}
              <tfoot>
                <tr className="bg-green-600 text-white font-bold">
                  <td
                    className="border border-gray-300 p-1 sm:p-2"
                    colSpan={6}
                  >
                    TOTAL
                  </td>
                  <td className="border border-gray-300 p-1 sm:p-2">
                    {totalPeso.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="border border-gray-300 p-1 sm:p-2">{avgVut === null ? "-" : formatCurrency(avgVut)}</td>
                  {hayFletesPagadosPorComprador && (
                    <td className="border border-gray-300 p-1 sm:p-2">{avgFut === null ? "-" : formatCurrency(avgFut)}</td>
                  )}
                  {hayFletesPagadosPorComprador && (
                    <td className="border border-gray-300 p-1 sm:p-2">{formatCurrency(totalOgf)}</td>
                  )}
                  <td className="border border-gray-300 p-1 sm:p-2">{formatCurrency(totalVenta)}</td>
                  {hayFletesPagadosPorComprador && (
                  <td className="border border-gray-300 p-1 sm:p-2">{formatCurrency(totalFlete)}</td>
                  )}
                  <td className="border border-gray-300 p-1 sm:p-2">{formatCurrency(totalConsignar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-4 sm:mt-6 pt-2 sm:pt-4 border-t text-center text-[10px] sm:text-xs text-gray-500">
            <p>Reporte generado por RodMar - Sistema de Gestión de Operaciones Mineras</p>
            <p>Fecha de generación: {new Date().toLocaleString('es-ES')}</p>
          </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}