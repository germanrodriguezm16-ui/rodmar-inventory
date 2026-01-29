import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import html2canvas from "html2canvas";
import type { ViajeWithDetails } from "@shared/schema";

interface VolqueteroViajesImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volquetero: { id: number; nombre: string };
  viajes: ViajeWithDetails[];
  filterLabel?: string;
}

const getQuienPagaFleteLabel = (value?: string | null) => {
  if (value === "comprador" || value === "El comprador") return "El comprador";
  if (value === "tu" || value === "Tú" || value === "RodMar") return "RodMar";
  return value || "N/A";
};

export default function VolqueteroViajesImageModal({
  open,
  onOpenChange,
  volquetero,
  viajes,
  filterLabel = "Todos los viajes"
}: VolqueteroViajesImageModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [saldoAnteriorInput, setSaldoAnteriorInput] = useState("");
  const [saldoAnteriorTipo, setSaldoAnteriorTipo] = useState<"contra" | "favor">("contra");
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
  }, [open, viajes.length, filterLabel, saldoAnteriorInput, saldoAnteriorTipo]);

  if (!open) return null;

  const viajesCompletados = viajes.filter((viaje) => viaje.fechaDescargue);
  const totalFlete = viajesCompletados.reduce(
    (sum, viaje) => sum + parseFloat(viaje.totalFlete || "0"),
    0
  );
  const totalPeso = viajes.reduce((sum, viaje) => sum + parseFloat(viaje.peso || "0"), 0);
  const futValues = viajes
    .map((viaje) => parseFloat(viaje.fleteTon || "0"))
    .filter((value) => !Number.isNaN(value));
  const totalFut = futValues.reduce((sum, value) => sum + value, 0);
  const avgFut = futValues.length > 0 ? totalFut / futValues.length : 0;
  const totalOgf = viajes.reduce((sum, viaje) => sum + parseFloat(viaje.otrosGastosFlete || "0"), 0);
  const totalFleteTabla = viajes.reduce((sum, viaje) => sum + parseFloat(viaje.totalFlete || "0"), 0);

  const saldoAnteriorNumerico = parseFloat(saldoAnteriorInput.replace(/[^\d.-]/g, "")) || 0;
  const saldoAnteriorAjuste = saldoAnteriorTipo === "contra" ? saldoAnteriorNumerico : -saldoAnteriorNumerico;
  const totalConSaldoAnterior = totalFlete + saldoAnteriorAjuste;

  const handleDownload = async () => {
    if (!imageRef.current) return;

    setIsGenerating(true);
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        height: imageRef.current.scrollHeight,
        width: imageRef.current.scrollWidth
      });

      const link = document.createElement("a");
      link.download = `Volquetero_${volquetero.nombre}_Viajes_${new Date()
        .toLocaleDateString("es-ES")
        .replace(/\//g, "-")}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error("Error generando imagen:", error);
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
            <span className="text-sm sm:text-base">Vista Previa - Viajes de {volquetero.nombre}</span>
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
              <option value="contra">En contra del volquetero</option>
              <option value="favor">A favor del volquetero</option>
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
            <div ref={imageRef} className="bg-white p-3 sm:p-4 rounded-lg" style={{ width: "900px", fontSize: "12px", lineHeight: "1.3" }}>
              {/* Header */}
              <div className="text-center mb-4 border-b border-gray-200 pb-3 bg-slate-50/70 rounded-md">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-1">RodMar - Historial de Viajes</h2>
                <h3 className="text-base sm:text-xl font-semibold text-blue-600 mb-1">Volquetero: {volquetero.nombre}</h3>
                <div className="flex flex-wrap justify-center gap-2 text-[10px] sm:text-sm text-gray-600">
                  <span>Filtro: {filterLabel}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Total Viajes: {viajes.length}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Fecha: {new Date().toLocaleDateString("es-ES")}</span>
                </div>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 p-2 sm:p-4">
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-gray-600 mb-1">VIAJES</p>
                  <p className="text-sm sm:text-lg font-bold text-blue-600">{viajes.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-gray-600 mb-1">TOTAL FLETE</p>
                  <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(totalFlete.toString())}</p>
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

              {/* Tabla de viajes */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border border-gray-300 p-1 text-left">ID</th>
                      <th className="border border-gray-300 p-1 text-left">ESTADO</th>
                      <th className="border border-gray-300 p-1 text-left">F. CARGUE</th>
                      <th className="border border-gray-300 p-1 text-left">F. DESCARGUE</th>
                      <th className="border border-gray-300 p-1 text-left">CONDUCTOR</th>
                      <th className="border border-gray-300 p-1 text-left">PLACA</th>
                      <th className="border border-gray-300 p-1 text-left">TIPO</th>
                      <th className="border border-gray-300 p-1 text-right">PESO</th>
                      <th className="border border-gray-300 p-1 text-right">FUT</th>
                      <th className="border border-gray-300 p-1 text-right">OGF</th>
                      <th className="border border-gray-300 p-1 text-right">T. FLETE</th>
                      <th className="border border-gray-300 p-1 text-left">QPF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viajes.map((viaje, index) => (
                      <tr key={viaje.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-300 p-1 font-medium text-gray-700 break-words whitespace-normal">
                          {viaje.id}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-600 break-words whitespace-normal">
                          {viaje.fechaDescargue ? "Completado" : "Pendiente"}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-600 break-words whitespace-normal">
                          {viaje.fechaCargue ? formatDateWithDaySpanish(viaje.fechaCargue) : "N/A"}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-600 break-words whitespace-normal">
                          {viaje.fechaDescargue ? formatDateWithDaySpanish(viaje.fechaDescargue) : "Pendiente"}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-700 break-words whitespace-normal">
                          {viaje.conductor}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-600 break-words whitespace-normal">
                          {viaje.placa}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-600 break-words whitespace-normal">
                          {viaje.tipoCarro || "N/A"}
                        </td>
                        <td className="border border-gray-300 p-1 text-right text-gray-600 break-words whitespace-normal">
                          {viaje.peso ? `${viaje.peso}T` : "N/A"}
                        </td>
                        <td className="border border-gray-300 p-1 text-right text-blue-600 break-words whitespace-normal">
                          {formatCurrency(viaje.fleteTon?.toString() || "0")}
                        </td>
                        <td className="border border-gray-300 p-1 text-right text-orange-600 break-words whitespace-normal">
                          {formatCurrency(viaje.otrosGastosFlete || "0")}
                        </td>
                        <td className="border border-gray-300 p-1 text-right font-medium text-purple-600 break-words whitespace-normal">
                          {formatCurrency(viaje.totalFlete?.toString() || "0")}
                        </td>
                        <td className="border border-gray-300 p-1 text-gray-600 break-words whitespace-normal">
                          {getQuienPagaFleteLabel(viaje.quienPagaFlete)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-600 text-white font-bold">
                      <td className="border border-gray-300 p-1" colSpan={7}>
                        TOTALES
                      </td>
                      <td className="border border-gray-300 p-1 text-right">
                        {totalPeso.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T
                      </td>
                      <td className="border border-gray-300 p-1 text-right">
                        {formatCurrency(avgFut.toString())}
                      </td>
                      <td className="border border-gray-300 p-1 text-right">
                        {formatCurrency(totalOgf.toString())}
                      </td>
                      <td className="border border-gray-300 p-1 text-right">
                        {formatCurrency(totalFleteTabla.toString())}
                      </td>
                      <td className="border border-gray-300 p-1" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footer */}
              <div className="text-center text-[9px] text-gray-500 mt-3 border-t pt-2">
                <div>Generado por RodMar - Sistema de Gestión Minera</div>
                <div>© 2025 - Todos los derechos reservados</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
