import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, FileSpreadsheet, AlertTriangle } from "lucide-react";

export interface ImportResult {
  success: number;
  errors: string[];
  total: number;
}

interface ImportResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ImportResult | null;
}

export function ImportResultsModal({ open, onOpenChange, results }: ImportResultsModalProps) {
  if (!results) return null;

  const errorCount = results.errors.length;
  const successCount = results.success;
  const totalCount = results.total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            Resultados de Importación Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumen General */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">Importados</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-green-600">viajes exitosos</div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800 dark:text-red-200">Errores</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-red-600">viajes fallidos</div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800 dark:text-blue-200">Total</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
              <div className="text-sm text-blue-600">viajes procesados</div>
            </div>
          </div>

          {/* Barra de Progreso Visual */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Progreso de Importación</span>
              <span>{Math.round((successCount / totalCount) * 100)}% exitoso</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div className="flex h-full">
                <div 
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${(successCount / totalCount) * 100}%` }}
                />
                <div 
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${(errorCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Estado General */}
          {errorCount === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">
                  ¡Importación Completada Exitosamente!
                </span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Todos los viajes del archivo Excel se importaron correctamente.
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800 dark:text-yellow-200">
                  Importación Parcial
                </span>
              </div>
              <p className="text-sm text-yellow-600 mt-1">
                {successCount} viajes importados exitosamente, {errorCount} viajes tuvieron errores.
              </p>
            </div>
          )}

          {/* Detalles de Errores */}
          {errorCount > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Detalles de Errores ({errorCount})
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {results.errors.map((error, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium text-red-800 dark:text-red-200">
                        Error {index + 1}:
                      </div>
                      <div className="text-red-600 dark:text-red-300 ml-2 mt-1">
                        {error}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Causas Comunes */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Causas Comunes de Errores:
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• <strong>Campos vacíos o undefined:</strong> Algunos campos requeridos están vacíos</li>
                  <li>• <strong>Formato de fecha inválido:</strong> Las fechas no están en formato reconocido</li>
                  <li>• <strong>Valores numéricos inválidos:</strong> Campos numéricos contienen texto</li>
                  <li>• <strong>IDs duplicados:</strong> El viaje ya existe en el sistema</li>
                  <li>• <strong>Entidades no encontradas:</strong> Minas o compradores no existen</li>
                </ul>
              </div>
            </div>
          )}

          {/* Botón de Cerrar */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={() => onOpenChange(false)} className="px-6">
              Entendido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}