import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ImportResultsModal, ImportResult as IImportResult } from '@/components/modals/import-results-modal';
import * as XLSX from 'xlsx';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
}



interface ConflictInfo {
  id: string;
  existingTrip: any;
  newTrip: any;
  index: number;
}

export default function ImportExcelModal({ isOpen, onClose }: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<IImportResult | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const { toast } = useToast();



  const validateAndTransformData = (data: any[]) => {
    console.log(`=== VALIDATING ${data.length} rows ===`);
    let skippedCount = 0;
    
    const validRows = data.filter((row, index) => {
      if (!row.conductor || !row.placa) {
        console.warn(`⚠️ SKIPPING row ${index + 1} with missing conductor or placa:`, {
          id: row.id,
          conductor: row.conductor,
          placa: row.placa,
          fullRow: row
        });
        skippedCount++;
        return false;
      }
      return true;
    });
    
    console.log(`✅ VALIDATION COMPLETE: ${validRows.length} valid rows, ${skippedCount} skipped`);
    return validRows;
  };

  const parseExcelFile = async (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: false });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            raw: true,
            defval: null
          });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };



  const handleImport = async () => {
    console.log("=== HANDLE IMPORT STARTED");
    if (!file || preview.length === 0) return;
    
    setImporting(true);
    setProgress(0);
    setResult(null);
    console.log("=== STARTING IMPORT PROCESS");
    
    try {
      // Re-parsear todo el archivo para la importación completa
      const jsonData = await parseExcelFile(file) as any[][];
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1) as any[][];
      
      const parsedData = dataRows.map((row, index) => {
        const peso = parseFloat(row[7]) || 0;
        const precioCompraTon = parseFloat(row[8]) || 0;
        const ventaTon = parseFloat(row[9]) || 0;
        const fleteTon = parseFloat(row[10]) || 0;
        const otrosGastosFlete = parseFloat(row[11]) || 0;
        
        const totalVenta = peso * ventaTon;
        const totalCompra = peso * precioCompraTon;
        const totalFleteBase = peso * fleteTon;
        const totalFlete = totalFleteBase + otrosGastosFlete;
        const valorConsignar = totalVenta - totalFlete;
        const ganancia = totalVenta - totalCompra - totalFlete;

        // Convertir fechas de Excel (números seriales) a strings ISO
        const convertExcelDate = (excelDate: any) => {
          if (!excelDate) return null;
          if (typeof excelDate === 'string') return excelDate;
          if (typeof excelDate === 'number') {
            // Excel almacena fechas como días desde 1900-01-01, pero ajustamos por el bug de Excel con 1900
            const date = new Date((excelDate - 25569) * 86400 * 1000);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`; // Formato YYYY-MM-DD
          }
          return null;
        };

        return {
          id: row[12] || `A${index + 1}`,
          conductor: row[2],
          placa: row[4],
          tipoCarro: row[3],
          minaNombre: row[5],
          compradorNombre: row[6],
          fechaCargue: convertExcelDate(row[0]),
          fechaDescargue: convertExcelDate(row[1]),
          peso: peso.toString(),
          precioCompraTon: precioCompraTon.toString(),
          ventaTon: ventaTon.toString(),
          fleteTon: fleteTon.toString(),
          otrosGastosFlete: otrosGastosFlete.toString(),
          vut: ventaTon.toString(),
          cut: precioCompraTon.toString(),
          fut: fleteTon.toString(),
          totalVenta: totalVenta.toString(),
          totalCompra: totalCompra.toString(),
          totalFlete: totalFlete.toString(),
          valorConsignar: valorConsignar.toString(),
          ganancia: ganancia.toString(),
          estado: "completado"
        };
      }).filter(row => row.conductor && row.placa);
      
      let validatedData = validateAndTransformData(parsedData);
      
      if (validatedData.length === 0) {
        setImporting(false);
        toast({
          title: "No hay datos para importar",
          description: "No se encontraron filas válidas en el archivo Excel.",
          variant: "destructive",
        });
        return;
      }
      
      // First check for duplicate IDs within the Excel file itself
      console.log("=== Checking for duplicate IDs in Excel...");
      const idCounts = new Map();
      validatedData.forEach(trip => {
        idCounts.set(trip.id, (idCounts.get(trip.id) || 0) + 1);
      });
      
      const duplicateIds = Array.from(idCounts.entries())
        .filter(([id, count]) => count > 1)
        .map(([id]) => id);
      
      if (duplicateIds.length > 0) {
        console.log("=== DUPLICATE IDs IN EXCEL:", duplicateIds);
        
        const confirmed = window.confirm(
          `Se encontraron IDs duplicados en el archivo Excel:\n` +
          duplicateIds.join(', ') + '\n\n' +
          '¿Deseas continuar? Solo se importará la primera ocurrencia de cada ID.'
        );
        
        if (!confirmed) {
          console.log("=== User cancelled import due to duplicate IDs");
          setImporting(false);
          toast({
            title: "Importación cancelada",
            description: "Se canceló la importación debido a IDs duplicados en el Excel.",
            variant: "default",
          });
          return;
        }
        
        // Remove duplicates, keeping only the first occurrence
        const seenIds = new Set();
        validatedData = validatedData.filter(trip => {
          if (seenIds.has(trip.id)) {
            return false;
          }
          seenIds.add(trip.id);
          return true;
        });
        
        console.log("=== Removed duplicates, proceeding with unique trips:", validatedData.length);
      }

      // Check for conflicts with existing trips in database
      console.log("=== Checking for conflicts with database...");
      const conflictResponse = await apiRequest('POST', '/api/check-conflicts', {
        ids: validatedData.map(trip => trip.id)
      });
      
      console.log("=== CONFLICT RESPONSE:", conflictResponse);
      const conflictingIds = (conflictResponse as any).conflicts || [];
      console.log("=== CONFLICTING IDS ARRAY:", conflictingIds, "LENGTH:", conflictingIds.length);
      
      if (conflictingIds.length > 0) {
        console.log("=== CONFLICTS FOUND - STOPPING IMPORT:", conflictingIds);
        
        // Get existing trip data for conflicts
        const existingTrips = new Map();
        for (const id of conflictingIds) {
          try {
            const existingTrip = await apiRequest('GET', `/api/viajes/${id}`);
            existingTrips.set(id, existingTrip);
          } catch (error) {
            console.warn("Could not fetch existing trip:", id);
          }
        }
        
        // Show conflict dialog
        const conflictInfos: ConflictInfo[] = conflictingIds.map((id: string) => {
          const newTrip = validatedData.find(trip => trip.id === id);
          const existingTrip = existingTrips.get(id);
          const index = validatedData.findIndex(trip => trip.id === id);
          
          return {
            id,
            existingTrip,
            newTrip,
            index
          };
        });
        
        console.log("=== SHOWING CONFLICT MODAL");
        setConflicts(conflictInfos);
        setPendingImport(validatedData);
        setShowConflictDialog(true);
        setImporting(false);
        return; // CRITICAL: Stop execution here
      }
      
      // No conflicts, proceed with import
      console.log("=== No conflicts found, proceeding with import");
      await importData({ 
        viajes: validatedData
      });
      
    } catch (error: any) {
      console.error("=== Error during import:", error);
      setImporting(false);
      toast({
        title: "Error al importar",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    }
  };

  const importData = async (data: { viajes: any[] }, replaceConflicts = false) => {
    const { viajes } = data;
    console.log("=== Starting bulk import of", viajes.length, "trips", replaceConflicts ? "with replacement" : "without replacement");
    
    try {
      setProgress(10);
      
      // Use bulk import endpoint
      const bulkData = {
        viajes: viajes,
        replace: replaceConflicts
      };
      
      setProgress(50);
      
      const response: any = await apiRequest('POST', '/api/viajes/bulk-import', bulkData);
      console.log("=== Bulk import completed, response:", response);
      
      setProgress(100);

      // Convert response to format expected by ImportResultsModal
      const resultData: IImportResult = {
        success: response.success || 0,
        errors: response.errors || [],
        total: response.total || viajes.length
      };

      setResult(resultData);
      setImporting(false);
      setShowResultsModal(true);
      
      if (response.success > 0) {
        toast({
          title: "Importación completada",
          description: `${response.success} viajes importados exitosamente`,
        });
      }
    } catch (error: any) {
      console.error("=== Bulk import error:", error);
      setImporting(false);
      
      // Show error in results modal
      const errorResult: IImportResult = {
        success: 0,
        errors: [error.message || "Error durante la importación"],
        total: viajes.length
      };
      
      setResult(errorResult);
      setShowResultsModal(true);
      
      toast({
        title: "Error en importación",
        description: "Ocurrió un error durante la importación",
        variant: "destructive"
      });
    }
  };

  const handleReplaceConfirmed = () => {
    if (pendingImport && pendingImport.length > 0) {
      setConflicts([]);
      setShowConflictDialog(false);
      setImporting(true);
      setProgress(0);
      setResult(null);
      importData({ viajes: pendingImport }, true); // true = replace conflicts
    }
  };

  const handleSkipConflicts = () => {
    if (pendingImport && pendingImport.length > 0) {
      setConflicts([]);
      setShowConflictDialog(false);
      setImporting(true);
      setProgress(0);
      setResult(null);
      importData({ viajes: pendingImport }, false); // false = skip conflicts
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setResult(null);
      
      try {
        const jsonData = await parseExcelFile(selectedFile) as any[][];
        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1, 6) as any[][]; // Mostrar solo primeras 5 filas
        
        const previewData = dataRows.map((row, index) => ({
          id: row[12] || `A${index + 1}`,
          conductor: row[2],
          placa: row[4],
          mina: row[5],
          comprador: row[6],
          peso: row[7],
          fechaCargue: row[0],
          fechaDescargue: row[1]
        }));
        
        setPreview(previewData);
      } catch (error) {
        console.error('Error parsing Excel:', error);
        toast({
          title: "Error al leer archivo",
          description: "No se pudo procesar el archivo Excel",
          variant: "destructive",
        });
      }
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setProgress(0);
    setConflicts([]);
    setPendingImport([]);
    setPreviewData(null);
    setShowConflictDialog(false);
    setShowResultsModal(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Viajes desde Excel
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">¿Necesitas un archivo de prueba?</span>
              <button 
                onClick={() => {
                  import('xlsx').then((XLSX) => {
                    const data = [
                    ['FechaCargue', 'FechaDescargue', 'Conductor', 'TipoCarro', 'Placa', 'MinaNombre', 'CompradorNombre', 'Peso', 'PrecioCompraTon', 'VentaTon', 'FleteTon', 'OtrosGastoFletes', 'ID'],
                    ['2024-10-15', '2024-10-16', 'Test Driver', 'Sencillo', 'TEST123', 'Mina El Dorado', 'Cemex S.A.', 20, 150000, 300000, 120000, 0, 'TRP001']
                  ];
                  
                  const worksheet = XLSX.utils.aoa_to_sheet(data);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, 'Viajes');
                  
                  XLSX.writeFile(workbook, 'simple-conflict-test.xlsx');
                });
              }}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-sm font-medium transition-colors"
            >
              Descargar archivo de prueba TRP001.xlsx
            </button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato esperado:</strong> El archivo Excel debe contener las siguientes columnas en orden:
              FechaCargue, FechaDescargue, Conductor, TipoCarro, Placa, MinaNombre, CompradorNombre, Peso, PrecioCompraTon, VentaTon, FleteTon, OtrosGastoFletes, ID
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <div className="mb-4">
                <label htmlFor="excel-file" className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Seleccionar archivo Excel
                  </span>
                  <input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
              {file && (
                <p className="text-sm text-gray-600">
                  Archivo seleccionado: {file.name}
                </p>
              )}
            </div>
          </div>

          {preview.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Vista previa (primeras 5 filas)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conductor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mina</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comprador</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peso</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.conductor}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.placa}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.minaNombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.compradorNombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.peso}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Importando viajes...</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {result && (
            <Alert className={result.errors.length > 0 ? "border-red-200" : "border-green-200"}>
              {result.errors.length > 0 ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600">
                      {result.success} exitosos
                    </Badge>
                    {result.errors.length > 0 && (
                      <Badge variant="destructive">
                        {result.errors.length} errores
                      </Badge>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="text-sm text-red-600">
                      <strong>Errores:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {result.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {showConflictDialog && conflicts.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <div className="space-y-4">
                  <div>
                    <strong className="text-yellow-800">Se encontraron {conflicts.length} viajes duplicados:</strong>
                    <p className="text-sm text-yellow-700 mt-1">
                      Los siguientes IDs ya existen en la base de datos. ¿Qué quieres hacer?
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {conflicts.map((conflict, index) => (
                      <div key={index} className="bg-white rounded p-3 border border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-yellow-800">ID: {conflict.id}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Datos existentes:</h4>
                            <p className="text-gray-600">Conductor: {conflict.existingTrip?.conductor || 'N/A'}</p>
                            <p className="text-gray-600">Placa: {conflict.existingTrip?.placa || 'N/A'}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Datos nuevos:</h4>
                            <p className="text-gray-600">Conductor: {conflict.newTrip?.conductor || 'N/A'}</p>
                            <p className="text-gray-600">Placa: {conflict.newTrip?.placa || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleReplaceConfirmed}
                      variant="destructive"
                      size="sm"
                    >
                      Reemplazar viajes existentes
                    </Button>
                    <Button 
                      onClick={handleSkipConflicts}
                      variant="outline"
                      size="sm"
                    >
                      Omitir viajes duplicados
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("=== BUTTON CLICKED - CALLING handleImport");
                handleImport();
              }} 
              disabled={!file || preview.length === 0 || importing}
            >
              {importing ? "Importando..." : "Importar Viajes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal de resultados de importación */}
    <ImportResultsModal
      open={showResultsModal}
      onOpenChange={setShowResultsModal}
      results={result ? {
        success: result.success,
        errors: result.errors,
        total: result.total || 0
      } : null}
    />
    </>
  );
}