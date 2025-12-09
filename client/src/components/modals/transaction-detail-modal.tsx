import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, FileText, Receipt, MessageSquare, Eye, EyeOff, Download, Share2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDateWithDaySpanish } from "@/lib/date-utils";
import { VoucherViewer } from "@/components/ui/voucher-viewer";
import { useVouchers } from "@/hooks/useVouchers";
import { TransactionReceiptModal } from "@/components/modals/transaction-receipt-modal";
import { getSocioNombre } from "@/lib/getSocioNombre";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import type { Mina, Comprador, Volquetero } from "@shared/schema";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  relatedTrip?: any; // Viaje relacionado para transacciones automáticas
}

export function TransactionDetailModal({ 
  open, 
  onOpenChange, 
  transaction,
  relatedTrip 
}: TransactionDetailModalProps) {
  
  const { loadVoucher, getVoucherFromCache, isVoucherLoading } = useVouchers();
  
  // Estado para modal de comprobante
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Fetch entities para obtener nombre del socio
  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
    enabled: open,
  });

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
    enabled: open,
  });

  const { data: volqueteros = [] } = useQuery<Volquetero[]>({
    queryKey: ["/api/volqueteros"],
    enabled: open,
  });
  
  const socioDestinoNombre = transaction?.paraQuienTipo 
    ? getSocioNombre(
        transaction.paraQuienTipo,
        transaction.paraQuienId,
        minas,
        compradores,
        volqueteros
      ) || 'Socio'
    : 'Socio';
  
  // Log para debugging
  useEffect(() => {
    if (transaction && open) {
      console.log("🔍 TRANSACTION DETAIL MODAL - Transaction data:", {
        id: transaction.id,
        voucher: transaction.voucher,
        voucherType: typeof transaction.voucher,
        voucherLength: transaction.voucher?.length,
        hasVoucher: !!transaction.voucher
      });
      
      // Si no tiene voucher en los datos iniciales, intentar cargarlo
      // Solo para transacciones manuales (IDs numéricos), no para transacciones de viaje
      if (!transaction.voucher && transaction.id && typeof transaction.id === 'number') {
        console.log("🔄 Loading voucher for transaction:", transaction.id);
        loadVoucher(transaction.id);
      } else if (typeof transaction.id === 'string' && transaction.id.startsWith('viaje-')) {
        console.log("⏭️ Skipping voucher load for trip transaction:", transaction.id);
      }
    }
  }, [transaction, open, loadVoucher]);
  
  // Obtener voucher del cache o de los datos iniciales
  // Solo para transacciones manuales (IDs numéricos)
  const currentVoucher = transaction?.voucher || (typeof transaction?.id === 'number' ? getVoucherFromCache(transaction.id) : null);
  const isLoadingVoucher = typeof transaction?.id === 'number' ? isVoucherLoading(transaction.id) : false;
  
  const [showFullVoucher, setShowFullVoucher] = useState(false);
  const [showFullTripVoucher, setShowFullTripVoucher] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [tripImageError, setTripImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reiniciar estados cuando cambie la transacción o se abra el modal
  useEffect(() => {
    setShowFullVoucher(false);
    setShowFullTripVoucher(false);
    setImageError(false);
    setTripImageError(false);
  }, [transaction?.id, open]);

  // Función para descargar imagen del modal
  const downloadModalImage = async () => {
    if (!modalRef.current) return;
    
    setIsDownloading(true);
    
    try {
      // Asegurar que los vouchers estén expandidos para la captura
      const wasVoucherHidden = !showFullVoucher;
      const wasTripVoucherHidden = !showFullTripVoucher;
      if (wasVoucherHidden) {
        setShowFullVoucher(true);
      }
      if (wasTripVoucherHidden && relatedTrip?.voucher) {
        setShowFullTripVoucher(true);
      }
      // Esperar un momento para que se renderice
      if (wasVoucherHidden || wasTripVoucherHidden) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const canvas = await html2canvas(modalRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Mayor calidad
        useCORS: true,
        allowTaint: true,
        height: modalRef.current.scrollHeight,
        width: modalRef.current.scrollWidth
      });
      
      // Crear enlace de descarga
      const link = document.createElement('a');
      link.download = `RodMar_Transaccion_${transaction.id}_${(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()}.png`;
      link.href = canvas.toDataURL('image/png');
      
      // Simular clic para descargar
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Restaurar estados de vouchers si estaban ocultos
      if (wasVoucherHidden) {
        setShowFullVoucher(false);
      }
      if (wasTripVoucherHidden) {
        setShowFullTripVoucher(false);
      }
      
    } catch (error) {
      console.error('Error al generar imagen:', error);
    } finally {
      setIsDownloading(false);
    }
  };
  
  if (!transaction) return null;



  // Determinar el color del valor según la lógica de negocio
  const getValueColor = () => {
    // Si tiene paraQuienTipo, usar nueva lógica unificada
    if ('paraQuienTipo' in transaction) {
      const isToPartner = transaction.paraQuienTipo === 'mina' || 
                         transaction.paraQuienTipo === 'comprador' || 
                         transaction.paraQuienTipo === 'volquetero';
      return isToPartner ? 'text-red-600' : 'text-green-600';
    }
    
    // Para transacciones de viajes o sin paraQuienTipo
    return 'text-green-600';
  };

  const getValueSign = () => {
    // Si tiene paraQuienTipo, usar nueva lógica unificada
    if ('paraQuienTipo' in transaction) {
      const isToPartner = transaction.paraQuienTipo === 'mina' || 
                         transaction.paraQuienTipo === 'comprador' || 
                         transaction.paraQuienTipo === 'volquetero';
      return isToPartner ? '-' : '+';
    }
    
    // Para transacciones de viajes o sin paraQuienTipo
    return '+';
  };

  const formatEntityName = (tipo: string, nombre: string) => {
    const tipoMap: { [key: string]: string } = {
      'mina': 'Mina',
      'comprador': 'Comprador', 
      'volquetero': 'Volquetero',
      'rodmar': 'RodMar',
      'banco': 'Banco'
    };
    
    return `${tipoMap[tipo] || tipo} (${nombre})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-50">
        <DialogHeader className="text-center pb-2 border-b border-blue-200">
          <DialogTitle className="text-lg font-semibold text-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalle de Transacción
            </div>
            <Button
              onClick={downloadModalImage}
              disabled={isDownloading}
              variant="outline"
              size="sm"
              className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                  <span className="text-xs">Generando...</span>
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 mr-1" />
                  <span className="text-xs">Descargar</span>
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={modalRef} className="space-y-4 pb-20">
          {/* Valor principal */}
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="h-6 w-6 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Valor de Transacción</span>
              </div>
              <p className={`text-2xl font-bold ${getValueColor()}`}>
                {getValueSign()}{formatCurrency(Math.abs(parseFloat(transaction.valor)).toString())}
              </p>
            </CardContent>
          </Card>

          {/* Tipo y Estado */}
          <div className="flex gap-2 justify-center">
            <Badge 
              variant={transaction.tipo === "Viaje" ? "default" : "outline"}
              className={`text-sm px-3 py-1 ${
                transaction.tipo === "Viaje" 
                  ? "bg-blue-100 text-blue-800 border-blue-300" 
                  : "bg-purple-100 text-purple-800 border-purple-300"
              }`}
            >
              {transaction.tipo || "Manual"}
            </Badge>
            {transaction.estado && (
              <Badge 
                variant="secondary" 
                className="text-sm px-3 py-1 bg-gray-100 text-gray-700"
              >
                {transaction.estado}
              </Badge>
            )}
          </div>

          {/* Información principal */}
          <div className="space-y-3">
            {/* Concepto */}
            <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-orange-700 mb-1">Concepto</p>
                    <p className="text-sm text-gray-900 leading-relaxed">
                      {transaction.concepto}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fecha */}
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-700 mb-1">Fecha</p>
                    <p className="text-sm text-gray-900">
                      {formatDateWithDaySpanish(transaction.fecha)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Voucher - Posicionado después de fecha */}
            {(currentVoucher && currentVoucher.trim() !== "") && (
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Receipt className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-green-700">Voucher/Recibo</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowFullVoucher(!showFullVoucher)}
                          className="h-6 px-2 text-xs border-green-300 text-green-700 hover:bg-green-100"
                        >
                          {(() => {
                            if (!currentVoucher) return "Cargando...";
                            
                            const isImageUrl = currentVoucher.startsWith('data:image') || 
                                             currentVoucher.startsWith('IMAGE:data:image') ||
                                             currentVoucher.startsWith('%7CIMAGE:data:image') ||
                                             currentVoucher.startsWith('|IMAGE:data:image') ||
                                             currentVoucher.includes('data:image') ||
                                             (currentVoucher.startsWith('http') && 
                                             (currentVoucher.includes('.jpg') || 
                                              currentVoucher.includes('.jpeg') || 
                                              currentVoucher.includes('.png') || 
                                              currentVoucher.includes('.gif')));
                            
                            return isImageUrl ? 
                              (showFullVoucher ? "Ocultar imagen" : "Ver imagen") :
                              (showFullVoucher ? "Ocultar todo" : "Ver todo");
                          })()}
                        </Button>
                      </div>
                      <div className="text-sm text-gray-900">
                        {(() => {
                          if (!currentVoucher) {
                            return <div className="text-gray-500 text-xs">Cargando voucher...</div>;
                          }
                          
                          const isImageUrl = currentVoucher.startsWith('data:image') || 
                                           currentVoucher.startsWith('IMAGE:data:image') ||
                                           currentVoucher.startsWith('%7CIMAGE:data:image') ||
                                           currentVoucher.startsWith('|IMAGE:data:image') ||
                                           currentVoucher.includes('data:image') ||
                                           (currentVoucher.startsWith('http') && 
                                           (currentVoucher.includes('.jpg') || 
                                            currentVoucher.includes('.jpeg') || 
                                            currentVoucher.includes('.png') || 
                                            currentVoucher.includes('.gif')));
                          
                          if (isImageUrl) {
                            return showFullVoucher ? (
                              <div className="bg-white p-2 rounded border border-green-200">
                                {!imageError ? (
                                  <img 
                                    src={(() => {
                                      let cleanUrl = currentVoucher;
                                      
                                      // Remover prefijo "IMAGE:" si existe
                                      if (cleanUrl.startsWith('IMAGE:')) {
                                        cleanUrl = cleanUrl.substring(6);
                                      }
                                      
                                      // Remover cualquier prefijo de pipe encoded o normal
                                      if (cleanUrl.startsWith('%7CIMAGE:')) {
                                        cleanUrl = cleanUrl.substring(8);
                                      } else if (cleanUrl.startsWith('|IMAGE:')) {
                                        cleanUrl = cleanUrl.substring(7);
                                      }
                                      
                                      return cleanUrl;
                                    })()} 
                                    alt="Voucher/Recibo" 
                                    className="max-w-full h-auto max-h-80 rounded"
                                    onError={() => setImageError(true)}
                                  />
                                ) : (
                                  <div className="text-red-600 text-xs text-center py-4">
                                    ❌ Error al cargar la imagen
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-green-100 px-3 py-2 rounded border border-green-300 text-green-800">
                                📷 Voucher con imagen
                              </div>
                            );
                          } else {
                            return showFullVoucher ? (
                              <div className="max-h-48 overflow-y-auto bg-white p-3 rounded border border-green-200 text-sm">
                                {currentVoucher}
                              </div>
                            ) : (
                              <span>
                                {currentVoucher.length > 50 
                                  ? `${currentVoucher.substring(0, 50)}...` 
                                  : currentVoucher
                                }
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}







            {/* Voucher del viaje relacionado para transacciones automáticas */}
            {transaction.tipo === "Viaje" && relatedTrip?.recibo && relatedTrip.recibo !== "0" && relatedTrip.recibo !== "" && (
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Receipt className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-purple-700">Recibo del Descargue</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowFullTripVoucher(!showFullTripVoucher)}
                          className="h-6 px-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                        >
                          {(() => {
                            const isImageUrl = relatedTrip.recibo.startsWith('data:image') || 
                                             relatedTrip.recibo.startsWith('IMAGE:data:image') ||
                                             relatedTrip.recibo.startsWith('%7CIMAGE:data:image') ||
                                             relatedTrip.recibo.startsWith('|IMAGE:data:image') ||
                                             relatedTrip.recibo.includes('data:image') ||
                                             (relatedTrip.recibo.startsWith('http') && 
                                             (relatedTrip.recibo.includes('.jpg') || 
                                              relatedTrip.recibo.includes('.jpeg') || 
                                              relatedTrip.recibo.includes('.png') || 
                                              relatedTrip.recibo.includes('.gif')));
                            
                            if (showFullTripVoucher) {
                              return (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Ocultar</span>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  <span className="text-xs">{isImageUrl ? 'Ver imagen' : 'Ver todo'}</span>
                                </>
                              );
                            }
                          })()}
                        </Button>
                      </div>
                      <div className="text-sm text-gray-900 break-words leading-relaxed">
                        {(() => {
                          const isImageUrl = relatedTrip.recibo.startsWith('data:image') || 
                                           relatedTrip.recibo.startsWith('IMAGE:data:image') ||
                                           relatedTrip.recibo.startsWith('%7CIMAGE:data:image') ||
                                           relatedTrip.recibo.startsWith('|IMAGE:data:image') ||
                                           relatedTrip.recibo.includes('data:image') ||
                                           (relatedTrip.recibo.startsWith('http') && 
                                           (relatedTrip.recibo.includes('.jpg') || 
                                            relatedTrip.recibo.includes('.jpeg') || 
                                            relatedTrip.recibo.includes('.png') || 
                                            relatedTrip.recibo.includes('.gif')));
                          
                          if (isImageUrl) {
                            return showFullTripVoucher ? (
                              <div className="bg-white p-2 rounded border border-purple-200">
                                {!tripImageError ? (
                                  <img 
                                    src={(() => {
                                      let cleanUrl = relatedTrip.recibo;
                                      
                                      // Remover prefijo "IMAGE:" si existe
                                      if (cleanUrl.startsWith('IMAGE:')) {
                                        cleanUrl = cleanUrl.substring(6);
                                      }
                                      
                                      // Remover cualquier prefijo de pipe encoded o normal
                                      if (cleanUrl.startsWith('%7CIMAGE:')) {
                                        cleanUrl = cleanUrl.substring(8);
                                      } else if (cleanUrl.startsWith('|IMAGE:')) {
                                        cleanUrl = cleanUrl.substring(7);
                                      }
                                      
                                      return cleanUrl;
                                    })()} 
                                    alt="Recibo del Descargue" 
                                    className="max-w-full h-auto max-h-80 rounded"
                                    onError={() => setTripImageError(true)}
                                  />
                                ) : (
                                  <div className="text-red-600 text-xs text-center py-4">
                                    ❌ Error al cargar la imagen
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-purple-100 px-3 py-2 rounded border border-purple-300 text-purple-800">
                                📷 Recibo del descargue
                              </div>
                            );
                          } else {
                            return showFullTripVoucher ? (
                              <div className="max-h-48 overflow-y-auto bg-white p-3 rounded border border-purple-200 text-sm">
                                {relatedTrip.recibo}
                              </div>
                            ) : (
                              <span>
                                {relatedTrip.recibo.length > 50 
                                  ? `${relatedTrip.recibo.substring(0, 50)}...` 
                                  : relatedTrip.recibo
                                }
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Observaciones del viaje relacionado (para transacciones automáticas) */}
            {transaction.tipo === "Viaje" && relatedTrip?.observaciones && relatedTrip.observaciones.trim() !== "" && (
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-700 mb-2">Observaciones del Viaje</p>
                      <div className="text-sm text-gray-900 break-words leading-relaxed bg-white p-2 rounded border border-blue-200">
                        {relatedTrip.observaciones}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}



            {/* Comentario */}
            {transaction.comentario && (
              <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-yellow-700 mb-1">Comentario</p>
                      <p className="text-sm text-gray-900 leading-relaxed bg-white p-2 rounded border border-yellow-200">
                        {transaction.comentario}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botón de compartir comprobante */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => setShowReceiptModal(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Share2 className="h-5 w-5 mr-2" />
                Compartir Comprobante
              </Button>
            </div>

          </div>


        </div>
      </DialogContent>
      
      {transaction?.paraQuienTipo && (
      {transaction?.paraQuienTipo && (
        <TransactionReceiptModal
          open={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          transaction={transaction}
          socioDestinoNombre={socioDestinoNombre}
          minas={minas}
          compradores={compradores}
          volqueteros={volqueteros}
        />
      )}
      )}
    </Dialog>
  );
}