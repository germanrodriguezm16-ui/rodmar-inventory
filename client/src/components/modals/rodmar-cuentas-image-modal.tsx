import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import html2canvas from "html2canvas";
import { formatCurrency } from "@/lib/utils";

interface RodMarCuentasImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacciones: any[];
  cuentaNombre: string;
  cuentaCodigo?: string;
  cuentaIdentificadores?: string[];
  filtroAplicado?: string;
}

const cuentaNameToId = (nombre: string) => {
  const map: Record<string, string> = {
    'Bemovil': 'bemovil',
    'Corresponsal': 'corresponsal',
    'Efectivo': 'efectivo',
    'Cuentas German': 'cuentas-german',
    'Cuentas Jhon': 'cuentas-jhon',
    'Otros': 'otros'
  };
  return map[nombre] || nombre.toLowerCase();
};

export function RodMarCuentasImageModal({ 
  open, 
  onOpenChange, 
  transacciones, 
  cuentaNombre,
  cuentaCodigo,
  cuentaIdentificadores,
  filtroAplicado = "Todas" 
}: RodMarCuentasImageModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (!imageRef.current) return;
    
    setIsDownloading(true);
    
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
      link.download = `RodMar_${cuentaNombre}_${filtroAplicado}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error al generar imagen:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Calcular balance dinámico de transacciones filtradas
  const cuentaId = cuentaNameToId(cuentaNombre);
  const cuentaNombreLower = (cuentaNombre || "").toLowerCase();
  const cuentaCodigoLower = (cuentaCodigo || "").toLowerCase();
  const matchCuenta = (id: string | number | null | undefined) => {
    if (!id) return false;
    // Si tenemos el código real (ej: BANCOLOMBIA_JHON), usarlo como referencia principal
    if (cuentaCodigoLower) {
      const idLower = id.toString().toLowerCase();
      if (idLower === cuentaCodigoLower) return true;
    }
    if (cuentaIdentificadores && cuentaIdentificadores.length > 0) {
      const idStr = id.toString().toLowerCase();
      return cuentaIdentificadores.some((item) => item.toLowerCase() === idStr);
    }
    return id.toString().toLowerCase() === cuentaId.toLowerCase();
  };
  const matchCuentaNombre = (value?: string | null) => {
    if (!value || !cuentaNombreLower) return false;
    return value.toString().toLowerCase().includes(cuentaNombreLower);
  };

  // Debug en desarrollo: ayuda a detectar por qué se queda todo gris / en cero
  useEffect(() => {
    if (!open || !import.meta.env.DEV) return;
    const sample = transacciones?.[0];
    // eslint-disable-next-line no-console
    console.log("[RodMarCuentasImageModal]", {
      cuentaNombre,
      cuentaCodigo,
      cuentaIdentificadores,
      transaccionesCount: transacciones?.length ?? 0,
      sample: sample
        ? {
            id: sample.id,
            deQuienTipo: sample.deQuienTipo,
            deQuienId: sample.deQuienId,
            paraQuienTipo: sample.paraQuienTipo,
            paraQuienId: sample.paraQuienId,
          }
        : null,
    });
  }, [open, cuentaNombre, cuentaCodigo, cuentaIdentificadores, transacciones]);
  
  let totalPositivos = 0;
  let totalNegativos = 0;

  const transaccionesConValores = transacciones.map(transaccion => {
    const valor = parseFloat(
      typeof transaccion.valor === "string" ? transaccion.valor.replace(/[$,]/g, "") : transaccion.valor,
    );
    const valorAbs = Math.abs(valor);
    
    // IMPORTANTE: no depender de flags precalculados (pueden venir false y "bloquear" el cálculo con ??).
    // Siempre recalcular con la fuente de verdad: deQuienTipo/deQuienId/paraQuienTipo/paraQuienId.
    const esIngresoACuenta = transaccion.esInversion
      ? !!transaccion.esPositiva
      : (transaccion.paraQuienTipo === 'rodmar' && matchCuenta(transaccion.paraQuienId));
    
    const esEgresoDeEstaCuenta = transaccion.esInversion
      ? !transaccion.esPositiva
      : (transaccion.deQuienTipo === 'rodmar' && matchCuenta(transaccion.deQuienId));

    // Para transacciones temporales: si el origen es esta cuenta, contar como egreso
    const esEgresoTemporal =
      !!transaccion.esTemporal && transaccion.deQuienTipo === 'rodmar' && matchCuenta(transaccion.deQuienId);

    // Para transacciones temporales con origen en esta cuenta: siempre contar como negativo
    if (esEgresoTemporal) {
      totalNegativos += valorAbs;
    } else if (esIngresoACuenta) {
      totalPositivos += valorAbs;
    } else if (esEgresoDeEstaCuenta) {
      totalNegativos += valorAbs;
    }

    return {
      ...transaccion,
      valor,
      valorAbs,
      esIngresoACuenta,
      esEgresoDeEstaCuenta: esEgresoDeEstaCuenta || esEgresoTemporal,
      esEgresoTemporal
    };
  });

  const balanceTotal = totalPositivos - totalNegativos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <DialogTitle className="text-base sm:text-lg font-semibold">
            Vista Previa - {cuentaNombre}
          </DialogTitle>
          <div className="flex items-center space-x-2">
            <Button
              onClick={downloadImage}
              disabled={isDownloading}
              size="sm"
              className="h-8 px-3 text-xs sm:text-sm"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Descargar</span>
              <span className="sm:hidden">Img</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div 
          ref={imageRef}
          className="bg-white p-4 sm:p-6"
          style={{ 
            minWidth: '420px',
            maxWidth: '800px',
            fontSize: '9px',
            lineHeight: '1.2',
            width: '100%'
          }}
        >
          {/* Header */}
          <div className="text-center mb-4" style={{ fontSize: '14px', fontWeight: 'bold' }}>
            <div>RodMar - Cuenta: {cuentaNombre}</div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              Período: {filtroAplicado} | {new Date().toLocaleDateString('es-CO')}
            </div>
          </div>

          {/* Resumen financiero */}
          <div 
            className="mb-4 p-3 border rounded"
            style={{ 
              backgroundColor: '#f8f9fa',
              fontSize: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              textAlign: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', color: '#16a34a' }}>Ingresos</div>
              <div style={{ fontSize: '11px' }}>+{formatCurrency(totalPositivos)}</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#dc2626' }}>Egresos</div>
              <div style={{ fontSize: '11px' }}>-{formatCurrency(totalNegativos)}</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', color: balanceTotal >= 0 ? '#16a34a' : '#dc2626' }}>Balance</div>
              <div style={{ fontSize: '11px' }}>{formatCurrency(balanceTotal)}</div>
            </div>
          </div>

          {/* Tabla de transacciones */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
            {/* Header de tabla */}
            <div 
              style={{ 
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '8px 4px',
                display: 'grid',
                gridTemplateColumns: '45px 1.5fr 2.5fr 65px',
                gap: '6px',
                fontSize: '9px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            >
              <div>FECHA</div>
              <div>CONCEPTO</div>
              <div>COMENTARIO</div>
              <div>VALOR</div>
            </div>

            {/* Filas de transacciones */}
            {transaccionesConValores.map((transaccion, index) => {
              // Manejar tanto Date objects como strings
              let fechaStr: string;
              if (typeof transaccion.fecha === 'string') {
                fechaStr = transaccion.fecha.includes('T') 
                  ? transaccion.fecha.split('T')[0] 
                  : transaccion.fecha;
              } else {
                // Es un objeto Date
                const date = new Date(transaccion.fecha);
                fechaStr = date.getFullYear() + '-' + 
                  String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(date.getDate()).padStart(2, '0');
              }
              
              const [year, month, day] = fechaStr.split('-');
              const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
              const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              const dayName = dayNames[dateObj.getDay()];
              const fechaFormateada = `${dayName}. ${day}/${month}/${year.slice(-2)}`;

              return (
                <div
                  key={transaccion.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                    padding: '5px 4px',
                    display: 'grid',
                    gridTemplateColumns: '45px 1.5fr 2.5fr 65px',
                    gap: '6px',
                    fontSize: '7px',
                    alignItems: 'start',
                    borderBottom: index < transaccionesConValores.length - 1 ? '1px solid #e5e7eb' : 'none',
                    minHeight: '24px'
                  }}
                >
                  <div style={{ 
                    textAlign: 'center', 
                    fontSize: '6px',
                    paddingTop: '2px'
                  }}>
                    {fechaFormateada}
                  </div>
                  <div style={{ 
                    paddingLeft: '3px',
                    wordBreak: 'break-words',
                    lineHeight: '1.2',
                    fontSize: '7px',
                    hyphens: 'auto'
                  }}>
                    {transaccion.concepto}
                  </div>
                  <div style={{ 
                    paddingLeft: '3px',
                    wordBreak: 'break-words',
                    lineHeight: '1.2',
                    fontSize: '7px',
                    hyphens: 'auto'
                  }}>
                    {transaccion.comentario || '-'}
                  </div>
                  <div style={{ 
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: transaccion.esIngresoACuenta ? '#16a34a' : 
                           transaccion.esEgresoDeEstaCuenta ? '#dc2626' : '#6b7280',
                    paddingRight: '3px',
                    fontSize: '7px',
                    paddingTop: '1px'
                  }}>
                    {transaccion.esIngresoACuenta ? '+' : 
                     transaccion.esEgresoDeEstaCuenta ? '-' : (transaccion.valor < 0 ? '-' : '')}
                    {formatCurrency(transaccion.valorAbs ?? transaccion.valor)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div 
            className="mt-4 text-center"
            style={{ 
              fontSize: '8px',
              color: '#6b7280',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '8px'
            }}
          >
            Total de transacciones: {transacciones.length} | Generado: {new Date().toLocaleString('es-CO')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}