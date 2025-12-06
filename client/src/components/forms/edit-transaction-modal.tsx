import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ReceiptImageUpload } from "@/components/ui/receipt-image-upload";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { X, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVouchers } from "@/hooks/useVouchers";
import { apiUrl } from "@/lib/api";
import type { TransaccionWithSocio, Mina, Comprador, Volquetero } from "@shared/schema";

// Exactamente el mismo schema que new-transaction-modal.tsx
const editTransactionSchema = z.object({
  deQuienTipo: z.string().min(1, "Debe seleccionar de quién es la transacción"),
  deQuienId: z.string().min(1, "Debe especificar de quién"),
  paraQuienTipo: z.string().min(1, "Debe seleccionar para quién es la transacción"),
  paraQuienId: z.string().min(1, "Debe especificar para quién"),
  postobonCuenta: z.string().optional(),
  valor: z.string().min(1, "El valor es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  formaPago: z.string().min(1, "La forma de pago es requerida"),
  voucher: z.string().optional(),
  comentario: z.string().optional(),
});

type EditTransactionFormData = z.infer<typeof editTransactionSchema>;

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransaccionWithSocio | null;
}

// Exactamente las mismas opciones que new-transaction-modal.tsx
const rodmarOptions = [
  { value: "bemovil", label: "Bemovil" },
  { value: "corresponsal", label: "Corresponsal" },
  { value: "efectivo", label: "Efectivo" },
  { value: "cuentas-german", label: "Cuentas German" },
  { value: "cuentas-jhon", label: "Cuentas Jhon" },
  { value: "otras", label: "Otras" },
];

// Función para formatear números con separadores de miles (sin decimales)
const formatNumber = (value: string): string => {
  // Remover todo excepto dígitos
  const numbers = value.replace(/\D/g, '');
  // Agregar separadores de miles sin límite de longitud
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Función para obtener el valor numérico sin formato
const getNumericValue = (formattedValue: string): string => {
  return formattedValue.replace(/\./g, '');
};

export default function EditTransactionModal({ isOpen, onClose, transaction }: EditTransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { loadVoucher, getVoucherFromCache, isVoucherLoaded } = useVouchers();
  
  // Fetch the latest transaction data when modal opens - with no cache
  const { data: latestTransaction, refetch: refetchTransaction } = useQuery({
    queryKey: ["/api/transacciones", transaction?.id], // Stable key without timestamp
    queryFn: async () => {
      if (!transaction?.id) return null;
      const response = await fetch(apiUrl(`/api/transacciones/${transaction.id}?t=${Date.now()}`)); // Bust cache in URL only
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Transaction ${transaction.id} not found`);
          return null;
        }
        throw new Error('Failed to fetch transaction');
      }
      const data = await response.json();
      return data;
    },
    enabled: isOpen && !!transaction?.id,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache
    refetchOnMount: true, // Always refetch when component mounts
  });
  
  // Use latest data if available, fallback to prop
  const currentTransaction = latestTransaction || transaction;

  // Fetch entities - exactamente igual que new-transaction-modal.tsx
  const { data: minas = [] } = useQuery<Mina[]>({
    queryKey: ["/api/minas"],
    enabled: isOpen,
  });

  const { data: compradores = [] } = useQuery<Comprador[]>({
    queryKey: ["/api/compradores"],
    enabled: isOpen,
  });

  const { data: volqueteros = [] } = useQuery<Volquetero[]>({
    queryKey: ["/api/volqueteros"],
    enabled: isOpen,
  });

  // Función para obtener la fecha local en formato YYYY-MM-DD
  const getTodayLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Función para convertir fecha UTC a fecha local string
  const convertToLocalDateString = (dateInput: string | Date) => {
    // Si es un string ISO (UTC), extraer directamente sin conversión de zona horaria
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
      return dateInput.split('T')[0]; // Extraer solo YYYY-MM-DD
    }
    
    // Si no es un string ISO, usar el método tradicional
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const form = useForm<EditTransactionFormData>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      deQuienTipo: "",
      deQuienId: "",
      paraQuienTipo: "",
      paraQuienId: "",
      valor: "",
      fecha: getTodayLocalDate(),
      formaPago: "",
      voucher: "",
      comentario: "",
    },
  });

  // Watch field values for dynamic options - exactamente igual que new-transaction-modal.tsx
  const watchedDeQuienTipo = form.watch("deQuienTipo");
  const watchedParaQuienTipo = form.watch("paraQuienTipo");

  // Get options based on selected tipo - exactamente igual que new-transaction-modal.tsx
  const getEntityOptions = (tipo: string) => {
    switch (tipo) {
      case "mina":
        return minas.map(mina => ({ value: mina.id.toString(), label: mina.nombre }));
      case "comprador":
        return compradores.map(comprador => ({ value: comprador.id.toString(), label: comprador.nombre }));
      case "volquetero":
        return volqueteros.map(volquetero => ({ value: volquetero.id.toString(), label: volquetero.nombre }));
      case "rodmar":
        return rodmarOptions;
      case "banco":
        return [{ value: "banco", label: "Banco" }];
      case "lcdm":
        return [{ value: "lcdm", label: "La Casa del Motero" }];
      case "postobon":
        return [{ value: "postobon", label: "Postobón" }];
      default:
        return [];
    }
  };

  // Función para obtener el nombre de la entidad
  const getEntityName = (tipo: string, id: string) => {
    switch (tipo) {
      case "mina":
        return minas.find(mina => mina.id.toString() === id)?.nombre || "Desconocida";
      case "comprador":
        return compradores.find(comprador => comprador.id.toString() === id)?.nombre || "Desconocido";
      case "volquetero":
        return volqueteros.find(volquetero => volquetero.id.toString() === id)?.nombre || "Desconocido";
      case "rodmar":
        return rodmarOptions.find(option => option.value === id)?.label || "Efectivo";
      case "banco":
        return "Banco";
      case "lcdm":
        return "La Casa del Motero";
      case "postobon":
        return "Postobón";
      default:
        return "Desconocido";
    }
  };

  // Función para generar el concepto automático
  const generateConcepto = (data: EditTransactionFormData) => {
    const deQuienNombre = getEntityName(data.deQuienTipo, data.deQuienId);
    const paraQuienNombre = getEntityName(data.paraQuienTipo, data.paraQuienId);
    
    // Capitalizar el primer carácter del tipo de socio
    const deQuienTipoCapitalizado = data.deQuienTipo.charAt(0).toUpperCase() + data.deQuienTipo.slice(1);
    const paraQuienTipoCapitalizado = data.paraQuienTipo.charAt(0).toUpperCase() + data.paraQuienTipo.slice(1);
    
    // Formar el concepto con el formato específico: "FormaPago de TipoOrigen (NombreOrigen) a TipoDestino (NombreDestino)"
    return `${data.formaPago} de ${deQuienTipoCapitalizado} (${deQuienNombre}) a ${paraQuienTipoCapitalizado} (${paraQuienNombre})`;
  };

  // Load transaction data when modal opens
  useEffect(() => {
    const loadTransactionData = async () => {
      if (isOpen && currentTransaction) {
        console.log("=== EditTransactionModal - Loading transaction data:", currentTransaction);
        console.log("=== EditTransactionModal - Transaction valor type:", typeof currentTransaction.valor, "value:", currentTransaction.valor);
        
        // Procesar el valor correctamente - SOLUCIÓN SIMPLE
        let valorStr = "";
        if (currentTransaction.valor !== null && currentTransaction.valor !== undefined) {
          console.log("=== EditTransactionModal - Raw currentTransaction.valor:", currentTransaction.valor, "type:", typeof currentTransaction.valor);
          
          // Convertir a número para eliminar decimales automáticamente
          const numericValue = parseFloat(currentTransaction.valor.toString());
          console.log("=== EditTransactionModal - NUEVO CÓDIGO CON PARSEFLOAT - Parsed numeric value:", numericValue);
          
          // Formatear con separadores de miles
          if (numericValue && numericValue !== 0) {
            valorStr = numericValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          }
          console.log("=== EditTransactionModal - Final formatted valor:", valorStr);
        }
        
        // Cargar voucher si la transacción tiene voucher y no está cargado
        let voucherValue = "";
        if (currentTransaction.hasVoucher && !isVoucherLoaded(currentTransaction.id)) {
          try {
            console.log("=== EditTransactionModal - Loading voucher for transaction ID:", currentTransaction.id);
            await loadVoucher(currentTransaction.id);
            const loadedVoucher = getVoucherFromCache(currentTransaction.id);
            if (loadedVoucher) {
              voucherValue = loadedVoucher;
              console.log("=== EditTransactionModal - Voucher loaded successfully");
            }
          } catch (error) {
            console.error("=== EditTransactionModal - Error loading voucher:", error);
          }
        } else if (isVoucherLoaded(currentTransaction.id)) {
          const cachedVoucher = getVoucherFromCache(currentTransaction.id);
          if (cachedVoucher) {
            voucherValue = cachedVoucher;
            console.log("=== EditTransactionModal - Using cached voucher");
          }
        }
        
        const formData = {
          deQuienTipo: currentTransaction.deQuienTipo || "",
          deQuienId: currentTransaction.deQuienId || "",
          paraQuienTipo: currentTransaction.paraQuienTipo || "",
          paraQuienId: currentTransaction.paraQuienId || "",
          postobonCuenta: currentTransaction.postobonCuenta || "",
          valor: valorStr,
          fecha: convertToLocalDateString(currentTransaction.fecha),
          formaPago: currentTransaction.formaPago || "",
          voucher: voucherValue,
          comentario: currentTransaction.comentario || "",
        };

        console.log("=== EditTransactionModal - Form data to load:", formData);
        console.log("=== EditTransactionModal - Formatted valor:", formData.valor);
        
        // AGGRESSIVE FORM UPDATE STRATEGY - Multiple approaches to ensure data loads
        console.log("=== INITIATING AGGRESSIVE FORM UPDATE");
        
        // 1. Clear everything first
        form.reset();
        
        // 2. Set data with multiple timing strategies
        setTimeout(() => {
          form.reset(formData);
          console.log("=== First form.reset completed with data:", formData);
        }, 10);
        
        setTimeout(() => {
          // Force individual field updates as backup
          Object.entries(formData).forEach(([key, value]) => {
            form.setValue(key as any, value, { shouldValidate: false, shouldDirty: false });
          });
          console.log("=== Individual setValue calls completed");
        }, 50);
        
        setTimeout(() => {
          // Final verification and reset
          form.reset(formData);
          console.log("=== Final form.reset completed - Current form values:", form.getValues());
        }, 100);
      }
      
      // Clear form when modal closes to prevent stale data
      if (!isOpen) {
        console.log("=== Modal closed, clearing form");
        form.reset();
      }
    };

    loadTransactionData();
  }, [isOpen, currentTransaction?.id, currentTransaction?.valor, currentTransaction?.fecha, currentTransaction?.deQuienTipo, currentTransaction?.paraQuienTipo, form, loadVoucher, getVoucherFromCache, isVoucherLoaded]);

  const updateTransactionMutation = useMutation({
    mutationFn: async (data: EditTransactionFormData) => {
      console.log("=== Updating transaction:", currentTransaction?.id, "with data:", data);
      
      // Generar concepto automático con el formato específico
      const concepto = generateConcepto(data);
      
      // Agregar el concepto a los datos
      const dataWithConcepto = {
        ...data,
        concepto,
        valor: getNumericValue(data.valor), // Convertir valor formateado a número
      };
      
      console.log("=== Making PATCH request to:", `/api/transacciones/${currentTransaction?.id}`);
      console.log("=== Request body:", JSON.stringify(dataWithConcepto, null, 2));
      
      const response = await fetch(apiUrl(`/api/transacciones/${currentTransaction?.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataWithConcepto),
      });

      console.log("=== Response status:", response.status);
      console.log("=== Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== Response error text:", errorText);
        throw new Error(`Error ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log("=== Response result:", result);
      return result;
    },
    onSuccess: (updatedTransaction) => {
      console.log("=== Transaction updated successfully:", updatedTransaction);
      
      toast({
        title: "Transacción actualizada",
        description: "La transacción se actualizó correctamente",
        duration: 2000,
      });
      
      // INVALIDACIÓN SELECTIVA - Solo entidades afectadas por la transacción editada
      console.log("=== INVALIDACIÓN SELECTIVA POST-EDICIÓN ===");
      
      // Siempre invalidar transacciones
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      
      // Obtener los datos de la transacción antes y después del cambio
      const originalTransaction = currentTransaction;
      
      // Invalidar solo las entidades que estaban o están involucradas
      const affectedEntityTypes = new Set();
      
      // Agregar tipos de entidades afectadas (originales y nuevos)
      if (originalTransaction?.deQuienTipo) affectedEntityTypes.add(originalTransaction.deQuienTipo);
      if (originalTransaction?.paraQuienTipo) affectedEntityTypes.add(originalTransaction.paraQuienTipo);
      if (updatedTransaction.deQuienTipo) affectedEntityTypes.add(updatedTransaction.deQuienTipo);
      if (updatedTransaction.paraQuienTipo) affectedEntityTypes.add(updatedTransaction.paraQuienTipo);
      
      // También agregar lcdm y postobon si están presentes (para invalidación específica)
      if (originalTransaction?.deQuienTipo === 'lcdm' || originalTransaction?.paraQuienTipo === 'lcdm' ||
          updatedTransaction.deQuienTipo === 'lcdm' || updatedTransaction.paraQuienTipo === 'lcdm') {
        affectedEntityTypes.add('lcdm');
      }
      if (originalTransaction?.deQuienTipo === 'postobon' || originalTransaction?.paraQuienTipo === 'postobon' ||
          updatedTransaction.deQuienTipo === 'postobon' || updatedTransaction.paraQuienTipo === 'postobon') {
        affectedEntityTypes.add('postobon');
      }
      
      // Detectar si involucra cuentas RodMar (Bemovil, Corresponsal, Efectivo, etc.)
      const rodmarAccountIds = ['bemovil', 'corresponsal', 'efectivo', 'cuentas-german', 'cuentas-jhon', 'otros'];
      const hasRodmarAccount = 
        (originalTransaction?.deQuienTipo === 'rodmar' && rodmarAccountIds.includes(originalTransaction?.deQuienId || '')) ||
        (originalTransaction?.paraQuienTipo === 'rodmar' && rodmarAccountIds.includes(originalTransaction?.paraQuienId || '')) ||
        (updatedTransaction.deQuienTipo === 'rodmar' && rodmarAccountIds.includes(updatedTransaction.deQuienId || '')) ||
        (updatedTransaction.paraQuienTipo === 'rodmar' && rodmarAccountIds.includes(updatedTransaction.paraQuienId || ''));
      
      // Detectar si cambió de una cuenta RodMar a otra o se le quitó a una cuenta RodMar (para actualizar ambas)
      const originalDeQuienRodmar = originalTransaction?.deQuienTipo === 'rodmar' && rodmarAccountIds.includes(originalTransaction?.deQuienId || '');
      const originalParaQuienRodmar = originalTransaction?.paraQuienTipo === 'rodmar' && rodmarAccountIds.includes(originalTransaction?.paraQuienId || '');
      const updatedDeQuienRodmar = updatedTransaction.deQuienTipo === 'rodmar' && rodmarAccountIds.includes(updatedTransaction.deQuienId || '');
      const updatedParaQuienRodmar = updatedTransaction.paraQuienTipo === 'rodmar' && rodmarAccountIds.includes(updatedTransaction.paraQuienId || '');
      
      // Detectar si se le quitó la transacción a una cuenta RodMar (origen o destino)
      const removedFromRodmarAccount = (originalDeQuienRodmar && !updatedDeQuienRodmar) || 
                                       (originalParaQuienRodmar && !updatedParaQuienRodmar);
      
      // Detectar si cambió de una cuenta RodMar a otra cuenta RodMar
      const changedBetweenRodmarAccounts = (originalDeQuienRodmar && updatedDeQuienRodmar && originalTransaction?.deQuienId !== updatedTransaction.deQuienId) ||
                                           (originalParaQuienRodmar && updatedParaQuienRodmar && originalTransaction?.paraQuienId !== updatedTransaction.paraQuienId);
      
      // Si se quitó de una cuenta RodMar o cambió entre cuentas RodMar, debemos actualizar
      if (hasRodmarAccount || removedFromRodmarAccount || changedBetweenRodmarAccounts) {
        affectedEntityTypes.add('rodmar-cuenta');
      }
      
      // Invalidar queries específicas de AMBOS socios (origen y destino)
      // Invalidar transacciones del socio origen (original y nuevo)
      const sociosAfectados = new Set<string>();
      if (originalTransaction?.deQuienTipo && originalTransaction?.deQuienId) {
        const key = `${originalTransaction.deQuienTipo}:${originalTransaction.deQuienId}`;
        sociosAfectados.add(key);
        queryClient.invalidateQueries({
          queryKey: ['transacciones', originalTransaction.deQuienTipo, originalTransaction.deQuienId]
        });
        queryClient.invalidateQueries({
          queryKey: ['balance-real', originalTransaction.deQuienTipo, originalTransaction.deQuienId]
        });
        queryClient.invalidateQueries({
          queryKey: ['tarjeta', originalTransaction.deQuienTipo, originalTransaction.deQuienId]
        });
      }
      if (updatedTransaction.deQuienTipo && updatedTransaction.deQuienId) {
        const key = `${updatedTransaction.deQuienTipo}:${updatedTransaction.deQuienId}`;
        if (!sociosAfectados.has(key)) {
          queryClient.invalidateQueries({
            queryKey: ['transacciones', updatedTransaction.deQuienTipo, updatedTransaction.deQuienId]
          });
          queryClient.invalidateQueries({
            queryKey: ['balance-real', updatedTransaction.deQuienTipo, updatedTransaction.deQuienId]
          });
          queryClient.invalidateQueries({
            queryKey: ['tarjeta', updatedTransaction.deQuienTipo, updatedTransaction.deQuienId]
          });
        }
      }
      
      // Invalidar transacciones del socio destino (original y nuevo)
      if (originalTransaction?.paraQuienTipo && originalTransaction?.paraQuienId) {
        const key = `${originalTransaction.paraQuienTipo}:${originalTransaction.paraQuienId}`;
        sociosAfectados.add(key);
        queryClient.invalidateQueries({
          queryKey: ['transacciones', originalTransaction.paraQuienTipo, originalTransaction.paraQuienId]
        });
        queryClient.invalidateQueries({
          queryKey: ['balance-real', originalTransaction.paraQuienTipo, originalTransaction.paraQuienId]
        });
        queryClient.invalidateQueries({
          queryKey: ['tarjeta', originalTransaction.paraQuienTipo, originalTransaction.paraQuienId]
        });
      }
      if (updatedTransaction.paraQuienTipo && updatedTransaction.paraQuienId) {
        const key = `${updatedTransaction.paraQuienTipo}:${updatedTransaction.paraQuienId}`;
        if (!sociosAfectados.has(key)) {
          queryClient.invalidateQueries({
            queryKey: ['transacciones', updatedTransaction.paraQuienTipo, updatedTransaction.paraQuienId]
          });
          queryClient.invalidateQueries({
            queryKey: ['balance-real', updatedTransaction.paraQuienTipo, updatedTransaction.paraQuienId]
          });
          queryClient.invalidateQueries({
            queryKey: ['tarjeta', updatedTransaction.paraQuienTipo, updatedTransaction.paraQuienId]
          });
        }
      }
      
      // Invalidar balances globales de los módulos afectados
      if (originalTransaction?.deQuienTipo && ['mina', 'comprador', 'volquetero'].includes(originalTransaction.deQuienTipo)) {
        queryClient.invalidateQueries({
          queryKey: ['balance-global', originalTransaction.deQuienTipo]
        });
      }
      if (originalTransaction?.paraQuienTipo && ['mina', 'comprador', 'volquetero'].includes(originalTransaction.paraQuienTipo)) {
        queryClient.invalidateQueries({
          queryKey: ['balance-global', originalTransaction.paraQuienTipo]
        });
      }
      if (updatedTransaction.deQuienTipo && ['mina', 'comprador', 'volquetero'].includes(updatedTransaction.deQuienTipo)) {
        queryClient.invalidateQueries({
          queryKey: ['balance-global', updatedTransaction.deQuienTipo]
        });
      }
      if (updatedTransaction.paraQuienTipo && ['mina', 'comprador', 'volquetero'].includes(updatedTransaction.paraQuienTipo)) {
        queryClient.invalidateQueries({
          queryKey: ['balance-global', updatedTransaction.paraQuienTipo]
        });
      }

      // Invalidar solo las entidades que realmente necesitan actualización
      if (affectedEntityTypes.has('mina')) {
        queryClient.invalidateQueries({ queryKey: ["/api/minas"] });
        queryClient.invalidateQueries({ queryKey: ["/api/balances/minas"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/minas"] }); // Refetch inmediato
        // Invalidar queries específicas de minas
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length > 0) {
              const firstKey = queryKey[0] as string;
              // Invalidar queries como ["/api/transacciones/socio/mina/${minaId}"] y ["/api/transacciones/socio/mina/${minaId}/all"]
              return firstKey?.startsWith("/api/transacciones/socio/mina/");
            }
            return false;
          }
        });
      }
      if (affectedEntityTypes.has('comprador')) {
        queryClient.invalidateQueries({ queryKey: ["/api/compradores"] });
        queryClient.invalidateQueries({ queryKey: ["/api/balances/compradores"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/compradores"] }); // Refetch inmediato
        // Invalidar queries específicas de compradores
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length >= 2) {
              const firstKey = queryKey[0] as string;
              const secondKey = queryKey[1];
              // Invalidar queries como ["/api/transacciones/comprador", compradorId] y ["/api/transacciones/comprador", compradorId, "includeHidden"]
              return firstKey === "/api/transacciones/comprador" && 
                     (typeof secondKey === 'number' || typeof secondKey === 'string');
            }
            return false;
          }
        });
      }
      if (affectedEntityTypes.has('volquetero')) {
        queryClient.invalidateQueries({ queryKey: ["/api/volqueteros"] });
        queryClient.invalidateQueries({ queryKey: ["/api/balances/volqueteros"] });
        queryClient.refetchQueries({ queryKey: ["/api/balances/volqueteros"] }); // Refetch inmediato
        // Invalidar queries específicas de volqueteros
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            return Array.isArray(queryKey) && 
                   queryKey.length === 3 && 
                   queryKey[0] === "/api/volqueteros" && 
                   queryKey[2] === "transacciones";
          }
        });
        // También invalidar queries como ["/api/transacciones/socio/volquetero", volqueteroId, "all"]
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length >= 2) {
              const firstKey = queryKey[0] as string;
              return firstKey === "/api/transacciones/socio/volquetero";
            }
            return false;
          }
        });
      }
      
      // 5. Invalidar queries específicas para LCDM/Postobón
      if (affectedEntityTypes.has('lcdm') || affectedEntityTypes.has('postobon')) {
        // Invalidar queries de cuentas RodMar
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        // Refetch inmediato para actualizar balances de tarjetas
        queryClient.refetchQueries({ queryKey: ["/api/rodmar-accounts"] });
        
        // Invalidar queries específicas de LCDM (con paginación)
        if (affectedEntityTypes.has('lcdm')) {
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/lcdm";
            },
          });
        }
        
        // Invalidar queries específicas de Postobón (con paginación)
        if (affectedEntityTypes.has('postobon')) {
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/postobon";
            },
          });
        }
        
        // Invalidar queries de transacciones para asegurar actualización del balance
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      }
      
      // 6. Invalidar queries específicas para cuentas RodMar (Bemovil, Corresponsal, Efectivo, etc.)
      if (affectedEntityTypes.has('rodmar-cuenta')) {
        // Invalidar queries de cuentas RodMar
        queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
        // Refetch inmediato para actualizar balances de tarjetas
        queryClient.refetchQueries({ queryKey: ["/api/rodmar-accounts"] });
        
        // Invalidar queries específicas de transacciones por cuenta
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey.length >= 2) {
              const firstKey = queryKey[0] as string;
              // Invalidar queries como ["/api/transacciones/cuenta/Bemovil"], ["/api/transacciones/cuenta/Corresponsal"], etc.
              return firstKey?.startsWith("/api/transacciones/cuenta/");
            }
            return false;
          }
        });
        
        // Invalidar queries de transacciones para asegurar actualización del balance
        queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
      }
      
      // También invalidar si la transacción original tenía LCDM/Postobón
      if (currentTransaction) {
        if (currentTransaction.deQuienTipo === 'lcdm' || currentTransaction.paraQuienTipo === 'lcdm') {
          queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
          // Refetch inmediato para actualizar balances de tarjetas
          queryClient.refetchQueries({ queryKey: ["/api/rodmar-accounts"] });
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/lcdm";
            },
          });
          queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
        }
        if (currentTransaction.deQuienTipo === 'postobon' || currentTransaction.paraQuienTipo === 'postobon') {
          queryClient.invalidateQueries({ queryKey: ["/api/rodmar-accounts"] });
          // Refetch inmediato para actualizar balances de tarjetas
          queryClient.refetchQueries({ queryKey: ["/api/rodmar-accounts"] });
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return Array.isArray(queryKey) &&
                queryKey.length > 0 &&
                typeof queryKey[0] === "string" &&
                queryKey[0] === "/api/transacciones/postobon";
            },
          });
          queryClient.invalidateQueries({ queryKey: ["/api/transacciones"] });
        }
      }
      
      // 6. Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["/api/transacciones"] });
      
      console.log("=== Cache invalidation completed - closing modal");
      
      // Esperar un poco antes de cerrar para que el parent component reciba los datos actualizados
      setTimeout(() => {
        onClose();
      }, 150);
    },
    onError: (error: any) => {
      console.error("=== Error updating transaction:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la transacción",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const onSubmit = (data: EditTransactionFormData) => {
    console.log("=== EditTransactionModal - Form submitted with data:", data);
    console.log("=== EditTransactionModal - Converting valor:", data.valor, "to numeric:", getNumericValue(data.valor));
    
    if (!currentTransaction?.id) {
      console.error("=== EditTransactionModal - No transaction ID available");
      toast({
        title: "Error",
        description: "No se pudo identificar la transacción a editar",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    updateTransactionMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200">
        <DialogHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Edit3 className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-800">
                Editar Transacción
              </DialogTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="hover:bg-blue-200">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ¿De quién? - exactamente igual que new-transaction-modal.tsx */}
            <FormField
              control={form.control}
              name="deQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold">¿De quién?</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("deQuienId", ""); // Reset selection
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                        <SelectValue placeholder="Seleccionar origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rodmar">RodMar</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="mina">Mina</SelectItem>
                      <SelectItem value="volquetero">Volquetero</SelectItem>
                      <SelectItem value="lcdm">LCDM</SelectItem>
                      <SelectItem value="postobon">Postobón</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-assign IDs for special entities */}
            {watchedDeQuienTipo === "banco" && (() => {
              if (form.getValues("deQuienId") !== "banco") {
                form.setValue("deQuienId", "banco");
              }
              return null;
            })()}
            
            {watchedDeQuienTipo === "lcdm" && (() => {
              if (form.getValues("deQuienId") !== "lcdm") {
                form.setValue("deQuienId", "lcdm");
              }
              return null;
            })()}
            
            {watchedDeQuienTipo === "postobon" && (() => {
              if (form.getValues("deQuienId") !== "postobon") {
                form.setValue("deQuienId", "postobon");
              }
              return null;
            })()}

            {/* De quién específico - exactamente igual que new-transaction-modal.tsx */}
            {watchedDeQuienTipo && watchedDeQuienTipo !== "rodmar" && watchedDeQuienTipo !== "banco" && watchedDeQuienTipo !== "lcdm" && watchedDeQuienTipo !== "postobon" && (
              <FormField
                control={form.control}
                name="deQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">
                      {watchedDeQuienTipo === "comprador" ? "Comprador" :
                       watchedDeQuienTipo === "volquetero" ? "Volquetero" : "Mina"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getEntityOptions(watchedDeQuienTipo)}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder={`Buscar ${watchedDeQuienTipo === "comprador" ? "comprador" : watchedDeQuienTipo === "volquetero" ? "volquetero" : "mina"}...`}
                        emptyMessage="No se encontraron resultados"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* De quién específico - RodMar con dropdown especial */}
            {watchedDeQuienTipo === "rodmar" && (
              <FormField
                control={form.control}
                name="deQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Cuenta RodMar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rodmarOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ¿Para quién? - exactamente igual que new-transaction-modal.tsx */}
            <FormField
              control={form.control}
              name="paraQuienTipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold">¿Para quién?</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("paraQuienId", ""); // Reset selection
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                        <SelectValue placeholder="Seleccionar destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mina">Mina</SelectItem>
                      <SelectItem value="volquetero">Volquetero</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="rodmar">RodMar</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                      <SelectItem value="lcdm">LCDM</SelectItem>
                      <SelectItem value="postobon">Postobón</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-assign IDs for special entities as destination */}
            {watchedParaQuienTipo === "banco" && (() => {
              if (form.getValues("paraQuienId") !== "banco") {
                form.setValue("paraQuienId", "banco");
              }
              return null;
            })()}
            
            {watchedParaQuienTipo === "lcdm" && (() => {
              if (form.getValues("paraQuienId") !== "lcdm") {
                form.setValue("paraQuienId", "lcdm");
              }
              return null;
            })()}
            
            {watchedParaQuienTipo === "postobon" && (() => {
              if (form.getValues("paraQuienId") !== "postobon") {
                form.setValue("paraQuienId", "postobon");
              }
              return null;
            })()}

            {/* Para quién específico - Otras entidades con búsqueda */}
            {watchedParaQuienTipo && watchedParaQuienTipo !== "rodmar" && watchedParaQuienTipo !== "banco" && watchedParaQuienTipo !== "lcdm" && watchedParaQuienTipo !== "postobon" && (
              <FormField
                control={form.control}
                name="paraQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">
                      {watchedParaQuienTipo === "comprador" ? "Comprador" :
                       watchedParaQuienTipo === "volquetero" ? "Volquetero" : "Mina"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getEntityOptions(watchedParaQuienTipo)}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder={`Buscar ${watchedParaQuienTipo === "comprador" ? "comprador" : watchedParaQuienTipo === "volquetero" ? "volquetero" : "mina"}...`}
                        emptyMessage="No se encontraron resultados"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Para quién específico - RodMar con dropdown especial */}
            {watchedParaQuienTipo === "rodmar" && (
              <FormField
                control={form.control}
                name="paraQuienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Cuenta RodMar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rodmarOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Selector de Cuenta Postobón - cuando origen o destino es postobon */}
            {(watchedDeQuienTipo === "postobon" || watchedParaQuienTipo === "postobon") && (
              <FormField
                control={form.control}
                name="postobonCuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Cuenta Postobón</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="santa-rosa">Santa Rosa</SelectItem>
                        <SelectItem value="cimitarra">Cimitarra</SelectItem>
                        <SelectItem value="otras">Otras</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Valor - con formateo igual que new-transaction-modal.tsx */}
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Valor</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                        <Input 
                          type="text"
                          placeholder="0" 
                          className="pl-8 bg-white border-gray-300 focus:border-blue-500"
                          maxLength={20}
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatNumber(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Fecha */}
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Fecha</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        className="bg-white border-gray-300 focus:border-blue-500"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Forma de Pago */}
            <FormField
              control={form.control}
              name="formaPago"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold">Forma de Pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                        <SelectValue placeholder="Seleccionar forma de pago" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Consignación">Consignación</SelectItem>
                      <SelectItem value="Otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Voucher/Recibo - exactamente igual que new-transaction-modal.tsx */}
            <FormField
              control={form.control}
              name="voucher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold">Voucher/Recibo (Opcional)</FormLabel>
                  <FormControl>
                    <ReceiptImageUpload
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Número de voucher o adjuntar imagen"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Comentario */}
            <FormField
              control={form.control}
              name="comentario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold">Comentario (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Comentarios adicionales sobre la transacción"
                      className="resize-none bg-white border-gray-300 focus:border-blue-500"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="modal-buttons-container flex justify-end space-x-3 pt-6 border-t border-blue-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateTransactionMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
              >
                {updateTransactionMutation.isPending ? "Actualizando..." : "Actualizar Transacción"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}