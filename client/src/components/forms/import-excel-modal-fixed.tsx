import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, Download, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  const [totalRows, setTotalRows] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<any[]>([]);
  const { toast } = useToast();

  const parseExcelFile = async (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error("No se encontraron hojas en el archivo Excel"));
            return;
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            reject(new Error("No se pudo leer la hoja del archivo Excel"));
            return;
          }
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (!jsonData || jsonData.length === 0) {
            reject(new Error("El archivo Excel está vacío o no contiene datos válidos"));
            return;
          }
          
          resolve(jsonData);
        } catch (error: any) {
          console.error("Error parsing Excel file:", error);
          reject(new Error(`Error al leer el archivo Excel: ${error.message || 'Formato no válido'}`));
        }
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Function to convert Excel serial date to JavaScript Date
  const convertExcelDate = (value: any): Date | null => {
    if (!value) return null;
    
    // If it's already a Date object
    if (value instanceof Date) return value;
    
    // If it's a string that looks like a date
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    
    // If it's a number (Excel serial date)
    if (typeof value === 'number' && value > 1) {
      // Excel serial date starts from 1900-01-01, but JavaScript Date starts from 1970-01-01
      // Excel serial date 1 = 1900-01-01, but Excel has a bug where it considers 1900 a leap year
      const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
      const jsDate = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));
      return jsDate;
    }
    
    return null; // Don't set a fallback date for empty values
  };

  const validateAndTransformData = (data: any[]) => {
    console.log(`📊 EXCEL IMPORT - Procesando ${data.length} filas de datos`);
    
    return data.map((item, index) => {
      // Helper function to ensure string conversion
      const toStringOrDefault = (value: any, defaultVal: string = '0') => {
        if (value === null || value === undefined || value === '') return defaultVal;
        return String(value);
      };

      const fechaCargue = convertExcelDate(item.fechaCargue);
      const fechaDescargue = convertExcelDate(item.fechaDescargue);
      
      // DEBUG: Log dates during import
      console.log(`🗓️ FECHA DEBUG - Fila ${index + 1}:`);
      console.log(`   Excel fechaCargue original:`, item.fechaCargue);
      console.log(`   Excel fechaDescargue original:`, item.fechaDescargue);
      console.log(`   Convertida fechaCargue:`, fechaCargue);
      console.log(`   Convertida fechaDescargue:`, fechaDescargue);

      const transformed: any = {
        id: toStringOrDefault(item.id, `TRP${String(index + 1).padStart(3, '0')}`),
        fechaCargue: fechaCargue,
        fechaDescargue: fechaDescargue,
        conductor: toStringOrDefault(item.conductor, 'Sin Conductor'),
        tipoCarro: toStringOrDefault(item.tipoCarro, 'Sencillo'),
        placa: toStringOrDefault(item.placa, 'SIN-PLACA'),
        minaNombre: toStringOrDefault(item.minaNombre, 'Mina Sin Nombre'),
        compradorNombre: toStringOrDefault(item.compradorNombre, 'Comprador Sin Nombre'),
        peso: toStringOrDefault(item.peso, '1'),
        precioCompraTon: toStringOrDefault(item.precioCompraTon, '100000'),
        ventaTon: toStringOrDefault(item.ventaTon, '200000'),
        fleteTon: toStringOrDefault(item.fleteTon, '50000'),
        otrosGastosFlete: toStringOrDefault(item.otrosGastosFlete, '0'),
        vut: toStringOrDefault(item.vut, '200000'),
        cut: toStringOrDefault(item.cut, '100000'),
        fut: toStringOrDefault(item.fut, '50000'),
        totalVenta: toStringOrDefault(item.totalVenta, '200000'),
        totalCompra: toStringOrDefault(item.totalCompra, '100000'),
        totalFlete: toStringOrDefault(item.totalFlete, '50000'),
        valorConsignar: toStringOrDefault(item.valorConsignar, '150000'),
        ganancia: toStringOrDefault(item.ganancia, '50000'),
        estado: toStringOrDefault(item.estado, 'completado'),
        quienPagaFlete: 'comprador',
        voucher: null,
        recibo: null,
        comentario: null
      };
      return transformed;
    }).filter(item => item.id && item.conductor);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File selection started");
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", selectedFile.name, "Size:", selectedFile.size);

    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      console.log("Invalid file type:", selectedFile.name);
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo Excel (.xlsx o .xls)",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    
    try {
      console.log("Starting to parse Excel file...");
      const jsonData = await parseExcelFile(selectedFile);
      console.log("Excel parsed successfully, rows:", jsonData.length);
      
      const headers = jsonData[0] as string[];
      console.log("Headers found:", headers);
      
      // Extract data rows (excluding header and last row with totals)
      // From row 2 (index 1) to before the last row with data
      const allDataRows = jsonData.slice(1, -1); // Exclude header (first) and totals (last)
      const totalDataRows = allDataRows.length;
      setTotalRows(totalDataRows);
      console.log("Total viajes to import (excluding header and totals):", totalDataRows);
      
      // Take first 5 data rows for preview
      const previewDataRows = allDataRows.slice(0, 5);
      console.log("Preview data rows:", previewDataRows.length);
      
      const previewData = previewDataRows.map(row => {
        const rowData: any = {};
        headers.forEach((header, i) => {
          rowData[header] = row[i];
        });
        return rowData;
      });
      
      console.log("Preview data generated:", previewData);
      setPreview(previewData);
      
      toast({
        title: "Éxito",
        description: `Archivo cargado. ${totalDataRows} viajes encontrados para importar.`,
      });
    } catch (error: any) {
      console.error("Error parsing Excel:", error);
      toast({
        title: "Error",
        description: `Error al leer el archivo Excel: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleImportWithConflictCheck = async () => {
    console.log("CONFLICT CHECK IMPORT STARTED");
    if (!file || preview.length === 0) return;
    
    try {
      const jsonData = await parseExcelFile(file) as any[][];
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1, -1) as any[][]; // Exclude header (first) and totals (last)
      
      // Extract IDs for conflict detection
      const tripIds: string[] = [];
      dataRows.forEach((row) => {
        const rowData: any = {};
        headers.forEach((header, i) => {
          rowData[header.trim().toLowerCase()] = row[i];
        });
        
        if (rowData.id) {
          tripIds.push(rowData.id);
        }
      });
      
      console.log("Extracted trip IDs for conflict check:", tripIds);
      
      // Check for conflicts FIRST
      if (tripIds.length > 0) {
        console.log("Checking conflicts for IDs:", tripIds);
        
        // Force refresh of server data to avoid cache issues
        const serverViajesResponse = await fetch("/api/viajes", {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const serverViajes = await serverViajesResponse.json();
        console.log("Current server viajes:", serverViajes.map((v: any) => v.id));
        
        const conflictResponse = await fetch("/api/check-conflicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: tripIds }),
        });
        
        const conflictData = await conflictResponse.json();
        console.log("Conflict check response:", conflictData);
        
        if (conflictData.conflicts && conflictData.conflicts.length > 0) {
          console.log("CONFLICTS DETECTED! Showing modal...");
          setConflicts(conflictData.conflicts);
          
          // Prepare data for modal
          const fullParsedData = dataRows.map((row, index) => {
            const rowData: any = {};
            headers.forEach((header, i) => {
              const normalizedHeader = header.trim().toLowerCase();
              let fieldName = normalizedHeader;
              
              if (normalizedHeader.includes('fecha') && normalizedHeader.includes('descargue')) {
                fieldName = 'fechaDescargue';
              } else if (normalizedHeader.includes('fecha') && normalizedHeader.includes('cargue')) {
                fieldName = 'fechaCargue';
              } else if (normalizedHeader.includes('conductor')) {
                fieldName = 'conductor';
              } else if (normalizedHeader.includes('tipo') && normalizedHeader.includes('carro')) {
                fieldName = 'tipoCarro';
              } else if (normalizedHeader.includes('placa')) {
                fieldName = 'placa';
              } else if (normalizedHeader.includes('mina')) {
                fieldName = 'minaNombre';
              } else if (normalizedHeader.includes('comprador')) {
                fieldName = 'compradorNombre';
              } else if (normalizedHeader.includes('peso')) {
                fieldName = 'peso';
              } else if (normalizedHeader.includes('precio') && normalizedHeader.includes('compra')) {
                fieldName = 'precioCompraTon';
              } else if (normalizedHeader.includes('venta')) {
                fieldName = 'ventaTon';
              } else if (normalizedHeader.includes('flete')) {
                fieldName = 'fleteTon';
              }
              
              rowData[fieldName] = row[i];
            });
            
            return {
              ...rowData,
              id: rowData.id || `TRP${String(index + 1).padStart(3, '0')}`,
              estado: 'completado',
              quienPagaFlete: 'comprador'
            };
          });
          
          setPendingImport(fullParsedData);
          setShowConflictDialog(true);
          return;
        }
      }
      
      // No conflicts, proceed with direct import
      console.log("No conflicts detected, proceeding with import...");
      await proceedWithImport(dataRows, headers);
      
    } catch (error: any) {
      console.error("Error in conflict check:", error);
      toast({
        title: "Error",
        description: `Error durante la verificación: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const proceedWithImport = async (dataRows: any[][], headers: string[]) => {
    setImporting(true);
    setProgress(0);
    setResult(null);
    
    try {
      const parsedData = dataRows.map((row, index) => {
        const rowData: any = {};
        headers.forEach((header, i) => {
          const normalizedHeader = header.trim().toLowerCase();
          let fieldName = normalizedHeader;
          
          // Log ALL headers to debug
          console.log(`🔍 HEADER ${i}: "${header}" → normalized: "${normalizedHeader}"`);
          
          if (normalizedHeader.includes('fecha') && normalizedHeader.includes('descargue')) {
            fieldName = 'fechaDescargue';
            console.log(`📅 MAPEO: "${header}" → fechaDescargue`);
          } else if (normalizedHeader.includes('fecha') && normalizedHeader.includes('cargue')) {
            fieldName = 'fechaCargue';
            console.log(`📅 MAPEO: "${header}" → fechaCargue`);
          } else if (normalizedHeader.includes('conductor')) {
            fieldName = 'conductor';
          } else if (normalizedHeader.includes('tipo') && normalizedHeader.includes('carro')) {
            fieldName = 'tipoCarro';
          } else if (normalizedHeader.includes('placa')) {
            fieldName = 'placa';
          } else if (normalizedHeader.includes('mina')) {
            fieldName = 'minaNombre';
          } else if (normalizedHeader.includes('comprador')) {
            fieldName = 'compradorNombre';
          } else if (normalizedHeader.includes('peso')) {
            fieldName = 'peso';
          } else if (normalizedHeader.includes('precio') && normalizedHeader.includes('compra')) {
            fieldName = 'precioCompraTon';
          } else if (normalizedHeader.includes('venta') && normalizedHeader.includes('ton')) {
            fieldName = 'ventaTon';
          } else if (normalizedHeader.includes('flete') && normalizedHeader.includes('ton')) {
            fieldName = 'fleteTon';
          } else if (normalizedHeader.includes('otros') && normalizedHeader.includes('gastos')) {
            fieldName = 'otrosGastosFlete';
          } else if (normalizedHeader === 'id') {
            fieldName = 'id';
          } else if (normalizedHeader === 'vut') {
            fieldName = 'vut';
          } else if (normalizedHeader === 'cut') {
            fieldName = 'cut';
          } else if (normalizedHeader === 'fut') {
            fieldName = 'fut';
          } else if (normalizedHeader.includes('total') && normalizedHeader.includes('venta')) {
            fieldName = 'totalVenta';
          } else if (normalizedHeader.includes('total') && normalizedHeader.includes('compra')) {
            fieldName = 'totalCompra';
          } else if (normalizedHeader.includes('total') && normalizedHeader.includes('flete')) {
            fieldName = 'totalFlete';
          } else if (normalizedHeader.includes('valor') && normalizedHeader.includes('consignar')) {
            fieldName = 'valorConsignar';
          } else if (normalizedHeader.includes('ganancia')) {
            fieldName = 'ganancia';
          } else if (normalizedHeader.includes('estado')) {
            fieldName = 'estado';
          }
          
          rowData[fieldName] = row[i];
        });
        
        if (!rowData.id) {
          rowData.id = `TRP${String(index + 1).padStart(3, '0')}`;
        }
        
        return rowData;
      });

      let validatedData = validateAndTransformData(parsedData);
      
      // Remove file duplicates
      const seen = new Set();
      validatedData = validatedData.filter((trip: any) => {
        if (seen.has(trip.id)) {
          return false;
        }
        seen.add(trip.id);
        return true;
      });

      await executeImport(validatedData, false); // false = no replacement
      
    } catch (error: any) {
      console.error("Error in import:", error);
      toast({
        title: "Error",
        description: `Error durante la importación: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const executeImport = async (validatedData: any[], replaceExisting = false) => {
    console.log(`=== STARTING OPTIMIZED BULK IMPORT - ${validatedData.length} viajes ===`);
    
    try {
      // Progress simulation for better UX during bulk processing
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress += 5;
        setProgress(Math.min(currentProgress, 90));
        if (currentProgress >= 90) {
          clearInterval(progressInterval);
        }
      }, 200);
      
      // Use the new bulk import endpoint
      const httpResponse = await apiRequest("POST", "/api/viajes/bulk-import", {
        viajes: validatedData,
        replaceExisting: replaceExisting
      });
      
      const response = await httpResponse.json();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      console.log("=== BULK IMPORT RESPONSE ===", response);
      
      setResult({
        success: response.success || 0,
        errors: response.errors || [],
      });

      // Limpiar cache completamente PRIMERO - incluir TODAS las variantes posibles
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/viajes");
        }
      });
      
      // Invalidar todas las consultas críticas
      await queryClient.invalidateQueries({ queryKey: ["/api/viajes"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/viajes/pendientes"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
      
      // Invalidar específicamente todas las consultas de viajes por mina (cualquier ID)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/viajes/mina/");
        }
      });
      
      // Forzar refetch de TODAS las consultas de transacciones por socio
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/transacciones/socio/");
        }
      });

      toast({
        title: "Importación completada",
        description: `${response.success} viajes importados exitosamente. ${response.errors?.length || 0} errores.`,
      });
      
    } catch (error: any) {
      console.error("Bulk import error:", error);
      setResult({
        success: 0,
        errors: [`Error general: ${error.message}`],
      });
      toast({
        title: "Error en importación",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReplaceConfirmed = async () => {
    console.log("User chose to REPLACE existing trips");
    setShowConflictDialog(false);
    setImporting(true);
    
    try {
      await executeImport(pendingImport, true); // Pass true for replacement
    } finally {
      setImporting(false);
      setPendingImport([]);
      setConflicts([]);
    }
  };

  const handleSkipConflicts = async () => {
    console.log("User chose to SKIP conflicting trips");
    setShowConflictDialog(false);
    setImporting(true);
    
    try {
      const conflictIds = new Set(conflicts.map(c => c.id));
      const filteredData = pendingImport.filter(trip => !conflictIds.has(trip.id));
      await executeImport(filteredData);
    } finally {
      setImporting(false);
      setPendingImport([]);
      setConflicts([]);
    }
  };

  const resetModal = () => {
    setFile(null);
    setPreview([]);
    setTotalRows(0);
    setImporting(false);
    setProgress(0);
    setResult(null);
    setConflicts([]);
    setShowConflictDialog(false);
    setPendingImport([]);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showConflictDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Viajes desde Excel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!file && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Seleccionar archivo Excel
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Formatos soportados: .xlsx, .xls
                </p>
              </div>
            )}

            {file && !importing && !result && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Archivo seleccionado</h3>
                    <p className="text-sm text-gray-500">{file.name}</p>
                  </div>
                  <Button variant="outline" onClick={() => setFile(null)}>
                    <X className="h-4 w-4 mr-2" />
                    Quitar
                  </Button>
                </div>

                {preview.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-md font-medium">Vista previa</h4>
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {totalRows > 0 ? `${totalRows} viajes para importar` : `${preview.length} viajes`}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Mostrando las primeras 5 filas del archivo</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            {Object.keys(preview[0] || {}).map((header, i) => (
                              <th key={i} className="border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i}>
                              {Object.entries(row).map(([key, cell]: [string, any], j) => (
                                <td key={j} className="border border-gray-200 px-2 py-1 text-xs">
                                  {key.toLowerCase().includes('fecha') && typeof cell === 'number' && cell > 1 ? 
                                    convertExcelDate(cell)?.toLocaleDateString('es-CO') || cell : 
                                    cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button onClick={handleImportWithConflictCheck} disabled={preview.length === 0}>
                    Importar Viajes
                  </Button>
                </div>
              </div>
            )}

            {importing && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600">Importando viajes... {progress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-medium">{result.success} exitosos</span>
                  {result.errors.length > 0 && (
                    <>
                      <X className="h-5 w-5 text-red-600" />
                      <span className="text-red-600 font-medium">{result.errors.length} errores</span>
                    </>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Errores:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                      {result.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={handleClose} className="w-full">
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={() => setShowConflictDialog(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span>Conflictos Detectados</span>
            </DialogTitle>
          </DialogHeader>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription>
              Se encontraron {conflicts.length} viaje(s) con IDs que ya existen en el sistema.
              ¿Qué deseas hacer?
            </AlertDescription>
          </Alert>

          <div className="space-y-4 max-h-64 overflow-y-auto">
            {conflicts.map((conflict, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-2">
                  Conflicto: ID {conflict.id}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-gray-700">Viaje existente:</h5>
                    <p>Conductor: {conflict.existingTrip?.conductor}</p>
                    <p>Placa: {conflict.existingTrip?.placa}</p>
                    <p>Fecha: {conflict.existingTrip?.fechaCargue}</p>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-700">Viaje nuevo:</h5>
                    <p>Conductor: {conflict.newTrip?.conductor}</p>
                    <p>Placa: {conflict.newTrip?.placa}</p>
                    <p>Fecha: {conflict.newTrip?.fechaCargue}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowConflictDialog(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleSkipConflicts}>
              Omitir viajes duplicados
            </Button>
            <Button onClick={handleReplaceConfirmed} className="bg-amber-600 hover:bg-amber-700">
              Reemplazar viajes existentes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}