import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ViajeWithDetails } from "@shared/schema";

interface ExcelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  viajes: ViajeWithDetails[];
  onConfirmDownload: () => void;
  exportType: 'viajes';
}

function formatDateWithDay(date: Date | null): string {
  if (!date) return "-";
  return format(date, "EEE. dd/MM/yyyy", { locale: es });
}

export function ExcelPreviewModal({ 
  isOpen, 
  onClose, 
  viajes, 
  onConfirmDownload,
  exportType 
}: ExcelPreviewModalProps) {
  const viajesArray = viajes || [];
  const previewViajes = viajesArray.slice(0, 5);
  const totalViajes = viajesArray.length;

  // Calcular totales
  const totales = viajesArray.reduce((acc, viaje) => {
    const peso = parseFloat(viaje.peso || "0");
    const totalVenta = parseFloat(viaje.totalVenta || "0");
    const totalCompra = parseFloat(viaje.totalCompra || "0");
    const totalFlete = parseFloat(viaje.totalFlete || "0");
    const valorConsignar = parseFloat(viaje.valorConsignar || "0");
    const ganancias = parseFloat(viaje.ganancia || "0");

    return {
      peso: acc.peso + peso,
      totalVenta: acc.totalVenta + totalVenta,
      totalCompra: acc.totalCompra + totalCompra,
      totalFlete: acc.totalFlete + totalFlete,
      valorConsignar: acc.valorConsignar + valorConsignar,
      ganancias: acc.ganancias + ganancias
    };
  }, {
    peso: 0,
    totalVenta: 0,
    totalCompra: 0,
    totalFlete: 0,
    valorConsignar: 0,
    ganancias: 0
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Vista Previa Excel - {totalViajes} {exportType}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Mostrando los primeros 5 de {totalViajes} {exportType} que se exportarán a Excel
          </div>

          {/* Tabla de vista previa */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                {/* Encabezados */}
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="p-2 text-left">ID</th>
                    <th className="p-2 text-left">F. Cargue</th>
                    <th className="p-2 text-left">Mina</th>
                    <th className="p-2 text-left">Conductor</th>
                    <th className="p-2 text-left">Tipo Carro</th>
                    <th className="p-2 text-left">Placa</th>
                    <th className="p-2 text-right">Peso</th>
                    <th className="p-2 text-left">F. Descargue</th>
                    <th className="p-2 text-left">Comprador</th>
                    <th className="p-2 text-right">Total Venta</th>
                    <th className="p-2 text-right">Total Compra</th>
                    <th className="p-2 text-right">Valor Consignar</th>
                    <th className="p-2 text-right">Ganancias</th>
                  </tr>
                </thead>

                {/* Filas de datos */}
                <tbody>
                  {previewViajes.map((viaje, index) => (
                    <tr key={viaje.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2">{viaje.id}</td>
                      <td className="p-2">{formatDateWithDay(viaje.fechaCargue)}</td>
                      <td className="p-2">{typeof viaje.mina === 'string' ? viaje.mina : (viaje.mina?.nombre || "-")}</td>
                      <td className="p-2">{viaje.conductor || "-"}</td>
                      <td className="p-2">{viaje.tipoCarro || "-"}</td>
                      <td className="p-2">{viaje.placa || "-"}</td>
                      <td className="p-2 text-right">{viaje.peso ? `${parseFloat(viaje.peso).toLocaleString()} T` : "-"}</td>
                      <td className="p-2">{formatDateWithDay(viaje.fechaDescargue)}</td>
                      <td className="p-2">{typeof viaje.comprador === 'string' ? viaje.comprador : (viaje.comprador?.nombre || "-")}</td>
                      <td className="p-2 text-right">{viaje.totalVenta ? formatCurrency(parseFloat(viaje.totalVenta)) : "-"}</td>
                      <td className="p-2 text-right">{viaje.totalCompra ? formatCurrency(parseFloat(viaje.totalCompra)) : "-"}</td>
                      <td className="p-2 text-right">{viaje.valorConsignar ? formatCurrency(parseFloat(viaje.valorConsignar)) : "-"}</td>
                      <td className="p-2 text-right">{viaje.ganancia ? formatCurrency(parseFloat(viaje.ganancia)) : "-"}</td>
                    </tr>
                  ))}

                  {/* Fila de totales */}
                  <tr className="bg-green-600 text-white font-bold">
                    <td className="p-2" colSpan={6}>TOTALES</td>
                    <td className="p-2 text-right">{totales.peso.toLocaleString()} T</td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 text-right">{formatCurrency(totales.totalVenta)}</td>
                    <td className="p-2 text-right">{formatCurrency(totales.totalCompra)}</td>
                    <td className="p-2 text-right">{formatCurrency(totales.valorConsignar)}</td>
                    <td className="p-2 text-right">{formatCurrency(totales.ganancias)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen de totales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{totalViajes}</div>
              <div className="text-sm text-muted-foreground">Total Viajes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{formatCurrency(totales.totalVenta)}</div>
              <div className="text-sm text-muted-foreground">Total Venta</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{formatCurrency(totales.valorConsignar)}</div>
              <div className="text-sm text-muted-foreground">Valor a Consignar</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{formatCurrency(totales.ganancias)}</div>
              <div className="text-sm text-muted-foreground">Ganancias</div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={onConfirmDownload}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel ({totalViajes} viajes)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ExcelPreviewModal;