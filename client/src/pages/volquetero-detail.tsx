import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Truck, Eye, EyeOff, Plus, Edit, Trash2, Search, CalendarDays, DollarSign, ArrowUp, ArrowDown, X, Download, Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import TripCard from "@/components/trip-card";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { formatCurrency, highlightText, highlightValue } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { getAuthToken } from "@/hooks/useAuth";
import { formatDateForInputBogota } from "@/lib/date-utils";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { SolicitarTransaccionModal } from "@/components/modals/solicitar-transaccion-modal";
import { PendingDetailModal } from "@/components/pending-transactions/pending-detail-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CompleteTransactionModal } from "@/components/modals/complete-transaction-modal";
import { GestionarTransaccionesModal } from "@/components/modals/gestionar-transacciones-modal";
import { PendingListModal } from "@/components/pending-transactions/pending-list-modal";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
import { TransaccionesImageModal } from "@/components/modals/transacciones-image-modal";
import VolqueteroViajesImageModal from "@/components/modals/volquetero-viajes-image-modal";
import { EditTripModal } from "@/components/forms/edit-trip-modal";
import RegisterCargueModal from "@/components/forms/register-cargue-modal";
import RegisterDescargueModal from "@/components/forms/register-descargue-modal";
import { useHiddenTransactions } from "@/hooks/useHiddenTransactions";
import type { ViajeWithDetails, TransaccionWithSocio } from "@shared/schema";

// Filtro de fechas (tipos válidos)
type DateFilterType = "todos" | "exactamente" | "entre" | "despues-de" | "antes-de" | "hoy" | "ayer" | "esta-semana" | "semana-pasada" | "este-mes" | "mes-pasado" | "este-año" | "año-pasado";

// Función para obtener día de la semana abreviado
const getDayOfWeek = (dateInput: string | Date): string => {
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  let date: Date;
  if (typeof dateInput === 'string') {
    const dateStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    const [year, month, day] = dateStr.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    // Si es Date, convertirlo a YYYY-MM-DD en Colombia y reconstruir en local para evitar corrimiento por UTC
    const ymd = formatDateForInputBogota(dateInput);
    const [year, month, day] = ymd.split('-').map(Number);
    date = new Date(year, month - 1, day);
  }
  
  return daysOfWeek[date.getDay()];
};

// Tipos importados del schema compartido

interface VolqueteroConPlacas {
  id: number;
  nombre: string;
  placas: Array<{ placa: string }>;
  viajesCount?: number;
}

interface VolqueteroTransaccion {
  id: string;
  concepto: string;
  valor: string;
  fecha: Date;
  formaPago: string;
  voucher: string | null;
  comentario: string | null;
  deQuienTipo: string;
  deQuienId: string;
  paraQuienTipo: string;
  paraQuienId: string;
  tipo: "Viaje" | "Manual" | "Temporal";
  esViajeCompleto: boolean;
  oculta?: boolean;
  originalTransaction?: any; // Referencia al objeto original para transacciones manuales
  viajeId?: string; // ID del viaje para poder ocultarlo
}

export default function VolqueteroDetail() {
  const { id } = useParams();
  const { has } = usePermissions();
  const canViewCargue = has("action.VIAJES.cargue.view");
  const canUseCargue = has("action.VIAJES.cargue.use");
  const canViewDescargue = has("action.VIAJES.descargue.view");
  const canUseDescargue = has("action.VIAJES.descargue.use");
  const canViewEditTrip = has("action.VIAJES.edit.view") || has("action.VIAJES.edit");
  const canUseEditTrip = has("action.VIAJES.edit.use") || has("action.VIAJES.edit");
  const canViewExtendedFinancial = has("action.VIAJES.extendedFinancial.view");
  const canUseExtendedFinancial = has("action.VIAJES.extendedFinancial.use");
  
  // Estado inicial de activeTab basado en permisos
  const getInitialTab = () => {
    if (has("module.VOLQUETEROS.tab.TRANSACCIONES.view")) return "transacciones";
    if (has("module.VOLQUETEROS.tab.BALANCES.view")) return "balance";
    return "transacciones"; // fallback
  };
  
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showEditPendingTransaction, setShowEditPendingTransaction] = useState(false);
  const [showPendingDetailModal, setShowPendingDetailModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDeletePendingConfirm, setShowDeletePendingConfirm] = useState(false);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [selectedRelatedTrip, setSelectedRelatedTrip] = useState<any>(null);
  const [showTransaccionesImagePreview, setShowTransaccionesImagePreview] = useState(false);
  const [showViajesImagePreview, setShowViajesImagePreview] = useState(false);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<ViajeWithDetails | null>(null);
  const [showRegisterCargue, setShowRegisterCargue] = useState(false);
  const [showRegisterDescargue, setShowRegisterDescargue] = useState(false);
  
  // Estado para transacciones temporales (solo en memoria)
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<TransaccionWithSocio[]>([]);
  
  // Estado para rastrear pestaña activa y ejecutar limpieza al cambiar
  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  
  // Estados de filtros de fecha para transacciones
  const [transaccionesFechaFilterType, setTransaccionesFechaFilterType] = useState<DateFilterType>("todos");
  const [transaccionesFechaFilterValue, setTransaccionesFechaFilterValue] = useState("");
  const [transaccionesFechaFilterValueEnd, setTransaccionesFechaFilterValueEnd] = useState("");

  // Estados de filtros de fecha para viajes
  const [viajesFechaFilterType, setViajesFechaFilterType] = useState<DateFilterType>("todos");
  const [viajesFechaFilterValue, setViajesFechaFilterValue] = useState("");
  const [viajesFechaFilterValueEnd, setViajesFechaFilterValueEnd] = useState("");
  
  // Estado para filtrar entre todas y ocultas
  const [filterType, setFilterType] = useState<"todas" | "ocultas">("todas");
  
  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [viajesSearchTerm, setViajesSearchTerm] = useState("");
  
  // Estado para filtro de balance (positivos, negativos, todos)
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positivos' | 'negativos'>('all');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: volqueteros = [] } = useQuery({
    queryKey: ["/api/volqueteros"],
  });

  // Usar viajes específicos del volquetero en lugar de todos los viajes
  // Esto se define después de obtener el volquetero

  // Procesar datos
  const volquetero = (volqueteros as VolqueteroConPlacas[]).find(v => 
    v.nombre === decodeURIComponent(id || "") || 
    v.placas.some((p: any) => p.placa === decodeURIComponent(id || ""))
  );

  const volqueteroIdActual = volquetero?.id || 0;

  // Hook para manejar transacciones ocultas de forma local y temporal
  const {
    hideTransaction: hideTransactionLocal,
    showAllHidden: showAllHiddenLocal,
    getHiddenCount: getHiddenTransactionsCount,
    isHidden: isTransactionHidden,
    filterVisible: filterVisibleTransactions,
  } = useHiddenTransactions(`volquetero-${volqueteroIdActual}`);

  const { data: transaccionesData = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(apiUrl(`/api/volqueteros/${volqueteroIdActual}/transacciones`), {
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        console.error(`Error fetching transacciones for volquetero ${volqueteroIdActual}:`, res.status, res.statusText);
        return []; // Devolver array vacío en caso de error
      }
      const data = await res.json();
      // Asegurar que siempre sea un array
      return Array.isArray(data) ? data : [];
    },
    enabled: volqueteroIdActual > 0,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  
  // Obtener solo los viajes de este volquetero específico (optimización) - solo visibles
  const { data: viajesVolquetero = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "viajes"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/volqueteros/${volqueteroIdActual}/viajes`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error('Error al obtener viajes');
      }
      const data = await response.json();
      // Asegurar que siempre sea un array
      return Array.isArray(data) ? data : [];
    },
    enabled: volqueteroIdActual > 0,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Obtener TODOS los viajes del volquetero (incluyendo ocultos) solo para el balance del encabezado
  const { data: todosViajesIncOcultos = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "viajes", "includeHidden"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/volqueteros/${volqueteroIdActual}/viajes?includeHidden=true`), {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error('Error al obtener viajes');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: volqueteroIdActual > 0,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Procesar transacciones
  const transaccionesFormateadas: VolqueteroTransaccion[] = useMemo(() => {
    if (!volquetero) return [];
    
    const transaccionesManuales = (transaccionesData as any[])
      .map(t => {
        let valorFinal = parseFloat(t.valor);
        
        // Lógica correcta de signos para volqueteros:
        // - Si deQuienTipo === 'volquetero' → POSITIVO (volquetero paga = suma a su balance)
        // - Si paraQuienTipo === 'volquetero' → NEGATIVO (RodMar paga = reduce su saldo)
        if (t.deQuienTipo === 'volquetero' && t.deQuienId === volqueteroIdActual.toString()) {
          valorFinal = Math.abs(valorFinal); // POSITIVO
        } else if (t.paraQuienTipo === 'volquetero' && t.paraQuienId === volqueteroIdActual.toString()) {
          valorFinal = -Math.abs(valorFinal); // NEGATIVO
        }
        
        const formatted = {
          id: t.id.toString(),
          concepto: t.concepto,
          valor: valorFinal.toString(),
          // Normalizar fecha a YYYY-MM-DD (Colombia) para evitar corrimiento al día anterior
          fecha: (() => {
            const raw = t.fecha ?? t.createdAt ?? Date.now();
            if (raw instanceof Date) {
              const ymd = formatDateForInputBogota(raw);
              const [y, m, d] = ymd.split("-").map(Number);
              return new Date(y, m - 1, d);
            }
            if (typeof raw === "string") {
              const ymd = raw.includes("T") ? raw.split("T")[0] : raw;
              const [y, m, d] = ymd.split("-").map(Number);
              if (y && m && d) return new Date(y, m - 1, d);
              return new Date(raw);
            }
            // number/otros
            return new Date(raw);
          })(),
          formaPago: t.formaPago || "",
          voucher: t.voucher || null,
          comentario: t.comentario || null,
          deQuienTipo: t.deQuienTipo || "",
          deQuienId: t.deQuienId || "",
          paraQuienTipo: t.paraQuienTipo || "",
          paraQuienId: t.paraQuienId || "",
          tipo: "Manual" as const,
          esViajeCompleto: false,
          originalTransaction: t // Guardar referencia al objeto original
        };
        
        return formatted;
      });

    // Transacciones dinámicas de viajes completados
    // Filtrar solo viajes donde RodMar paga el flete (no cuando el comprador paga)
    // Esto es solo para la pestaña de transacciones; en la pestaña de viajes se muestran todos
    const viajesCompletados = (Array.isArray(viajesVolquetero) ? viajesVolquetero : [])
      .filter(v => 
        v.quienPagaFlete !== "comprador" && 
        v.quienPagaFlete !== "El comprador"
      )
      .map(v => {
        const fechaViajeRaw = v.fechaDescargue!;
        // Convertir fecha a Date si es string
        let fechaViaje: Date;
        if (fechaViajeRaw instanceof Date) {
          fechaViaje = fechaViajeRaw;
        } else if (typeof fechaViajeRaw === 'string') {
          // Si es string, convertir a Date
          const dateStr = fechaViajeRaw.includes('T') ? fechaViajeRaw.split('T')[0] : fechaViajeRaw;
          const [year, month, day] = dateStr.split('-').map(Number);
          fechaViaje = new Date(year, month - 1, day);
        } else {
          // Fallback a fecha actual si no hay fecha válida
          fechaViaje = new Date();
        }
        
        const totalFlete = parseFloat(v.totalFlete || "0");
        
        return {
          id: `viaje-${v.id}`,
          concepto: `Viaje ${v.id}`,
          valor: totalFlete.toString(),
          fecha: fechaViaje,
          formaPago: "Viaje",
          voucher: null,
          comentario: null,
          deQuienTipo: "viaje",
          deQuienId: v.id,
          paraQuienTipo: "volquetero",
          paraQuienId: volqueteroIdActual.toString(),
          tipo: "Viaje" as const,
          esViajeCompleto: true,
          oculta: v.oculta || false,
          viajeId: v.id
        };
      });

    // Transacciones temporales con tipo marcado
    const transaccionesTemporalesConTipo: VolqueteroTransaccion[] = transaccionesTemporales.map(t => {
      let valorFinal = parseFloat(t.valor || "0");
      
      // Aplicar misma lógica de signos que transacciones manuales
      if (t.deQuienTipo === 'volquetero' && t.deQuienId === volqueteroIdActual.toString()) {
        valorFinal = Math.abs(valorFinal); // POSITIVO
      } else if (t.paraQuienTipo === 'volquetero' && t.paraQuienId === volqueteroIdActual.toString()) {
        valorFinal = -Math.abs(valorFinal); // NEGATIVO
      }
      
      return {
        id: t.id.toString(),
        concepto: t.concepto,
        valor: valorFinal.toString(),
        // Importante: evitar new Date("YYYY-MM-DD") o new Date(ISO-Z) + getDate() local (puede correrse al día anterior en Colombia)
        // Normalizamos a Date local basado en YYYY-MM-DD (Colombia) para que UI muestre el día correcto.
        fecha: (() => {
          const raw = t.fecha ?? t.createdAt;
          if (!raw) return new Date();
          if (raw instanceof Date) {
            const ymd = formatDateForInputBogota(raw);
            const [y, m, d] = ymd.split("-").map(Number);
            return new Date(y, m - 1, d);
          }
          if (typeof raw === "string") {
            const ymd = raw.includes("T") ? raw.split("T")[0] : raw;
            const [y, m, d] = ymd.split("-").map(Number);
            if (y && m && d) return new Date(y, m - 1, d);
            return new Date(raw);
          }
          return new Date();
        })(),
        formaPago: t.formaPago || "",
        voucher: t.voucher || null,
        comentario: t.comentario || null,
        deQuienTipo: t.deQuienTipo || "",
        deQuienId: t.deQuienId || "",
        paraQuienTipo: t.paraQuienTipo || "",
        paraQuienId: t.paraQuienId || "",
        tipo: "Temporal" as const,
        esViajeCompleto: false
      };
    });
    
    const resultado = [...transaccionesManuales, ...viajesCompletados, ...transaccionesTemporalesConTipo]
      .sort((a, b) => {
        // Ordenar usando fecha normalizada a YYYY-MM-DD (Colombia) para evitar corrimientos por UTC
        const norm = (raw: any): number => {
          if (!raw) return 0;
          if (raw instanceof Date) {
            const ymd = formatDateForInputBogota(raw);
            const [y, m, d] = ymd.split("-").map(Number);
            return new Date(y, m - 1, d).getTime();
          }
          if (typeof raw === "string") {
            const ymd = raw.includes("T") ? raw.split("T")[0] : raw;
            const [y, m, d] = ymd.split("-").map(Number);
            if (y && m && d) return new Date(y, m - 1, d).getTime();
            return new Date(raw).getTime();
          }
          return 0;
        };
        return norm(b.fecha) - norm(a.fecha);
      });
    
    return resultado;
  }, [transaccionesData, viajesVolquetero, volquetero, volqueteroIdActual, transaccionesTemporales]);

  // Resolver viaje relacionado para transacciones tipo "Viaje"
  const getRelatedTripForTransaction = useCallback((tx: any) => {
    const idFromProp = tx?.viajeId;
    const idFromId = typeof tx?.id === "string" && tx.id.startsWith("viaje-") ? tx.id.replace("viaje-", "") : null;
    const viajeId = idFromProp || idFromId || null;
    if (!viajeId) return null;

    const listA = Array.isArray(viajesVolquetero) ? viajesVolquetero : [];
    const listB = Array.isArray(todosViajesIncOcultos) ? todosViajesIncOcultos : [];
    return listA.find((v: any) => v.id === viajeId) || listB.find((v: any) => v.id === viajeId) || null;
  }, [viajesVolquetero, todosViajesIncOcultos]);

  // Función para obtener el rango de fechas según el filtro
  const getDateRange = useCallback((filterType: DateFilterType, filterValue: string, filterValueEnd: string) => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');

    switch (filterType) {
      case "exactamente":
        return filterValue ? { start: filterValue, end: filterValue } : null;
      
      case "entre":
        return (filterValue && filterValueEnd) ? { start: filterValue, end: filterValueEnd } : null;
      
      case "despues-de":
        return filterValue ? { start: filterValue, end: null } : null;
      
      case "antes-de":
        return filterValue ? { start: null, end: filterValue } : null;
      
      case "hoy":
        return { start: todayStr, end: todayStr };
      
      case "ayer": {
        const ayer = new Date(today);
        ayer.setDate(today.getDate() - 1);
        const ayerStr = ayer.getFullYear() + '-' + 
          String(ayer.getMonth() + 1).padStart(2, '0') + '-' + 
          String(ayer.getDate()).padStart(2, '0');
        return { start: ayerStr, end: ayerStr };
      }
      
      case "esta-semana": {
        const inicioSemana = new Date(today);
        inicioSemana.setDate(today.getDate() - today.getDay());
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        
        const inicioStr = inicioSemana.getFullYear() + '-' + 
          String(inicioSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioSemana.getDate()).padStart(2, '0');
        const finStr = finSemana.getFullYear() + '-' + 
          String(finSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finSemana.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "semana-pasada": {
        const inicioSemana = new Date(today);
        inicioSemana.setDate(today.getDate() - today.getDay() - 7);
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        
        const inicioStr = inicioSemana.getFullYear() + '-' + 
          String(inicioSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioSemana.getDate()).padStart(2, '0');
        const finStr = finSemana.getFullYear() + '-' + 
          String(finSemana.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finSemana.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "este-mes": {
        const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1);
        const finMes = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const inicioStr = inicioMes.getFullYear() + '-' + 
          String(inicioMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioMes.getDate()).padStart(2, '0');
        const finStr = finMes.getFullYear() + '-' + 
          String(finMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finMes.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "mes-pasado": {
        const inicioMes = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const finMes = new Date(today.getFullYear(), today.getMonth(), 0);
        
        const inicioStr = inicioMes.getFullYear() + '-' + 
          String(inicioMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioMes.getDate()).padStart(2, '0');
        const finStr = finMes.getFullYear() + '-' + 
          String(finMes.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finMes.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "este-año": {
        const inicioAño = new Date(today.getFullYear(), 0, 1);
        const finAño = new Date(today.getFullYear(), 11, 31);
        
        const inicioStr = inicioAño.getFullYear() + '-' + 
          String(inicioAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioAño.getDate()).padStart(2, '0');
        const finStr = finAño.getFullYear() + '-' + 
          String(finAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finAño.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      case "año-pasado": {
        const inicioAño = new Date(today.getFullYear() - 1, 0, 1);
        const finAño = new Date(today.getFullYear() - 1, 11, 31);
        
        const inicioStr = inicioAño.getFullYear() + '-' + 
          String(inicioAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(inicioAño.getDate()).padStart(2, '0');
        const finStr = finAño.getFullYear() + '-' + 
          String(finAño.getMonth() + 1).padStart(2, '0') + '-' + 
          String(finAño.getDate()).padStart(2, '0');
        
        return { start: inicioStr, end: finStr };
      }
      
      default:
        return null;
    }
  }, []);

  // Función para filtrar transacciones por fecha
  const filterTransaccionesByDate = useCallback((transacciones: VolqueteroTransaccion[], filterType: DateFilterType, filterValue: string, filterValueEnd: string) => {
    if (filterType === "todos") return transacciones;
    
    const range = getDateRange(filterType, filterValue, filterValueEnd);
    if (!range) return transacciones;
    
    return transacciones.filter(t => {
      const fechaStr = (() => {
        if (t.fecha instanceof Date) return formatDateForInputBogota(t.fecha);
        if (typeof (t as any).fecha === "string") return (t as any).fecha.includes("T") ? (t as any).fecha.split("T")[0] : (t as any).fecha;
        return formatDateForInputBogota(new Date((t as any).fecha));
      })();
      
      if (range.start && range.end) {
        return fechaStr >= range.start && fechaStr <= range.end;
      } else if (range.start) {
        return fechaStr >= range.start;
      } else if (range.end) {
        return fechaStr <= range.end;
      }
      return true;
    });
  }, [getDateRange]);

  // Función para filtrar viajes por fecha (usa fecha de descargue)
  const filterViajesByDate = useCallback((viajes: ViajeWithDetails[], filterType: DateFilterType, filterValue: string, filterValueEnd: string) => {
    if (filterType === "todos") return viajes;

    const range = getDateRange(filterType, filterValue, filterValueEnd);
    if (!range) return viajes;

    return viajes.filter(v => {
      if (!v.fechaDescargue) return false;
      const fechaStr = (() => {
        if (v.fechaDescargue instanceof Date) return formatDateForInputBogota(v.fechaDescargue);
        if (typeof (v as any).fechaDescargue === "string") return (v as any).fechaDescargue.includes("T") ? (v as any).fechaDescargue.split("T")[0] : (v as any).fechaDescargue;
        return formatDateForInputBogota(new Date((v as any).fechaDescargue));
      })();

      if (range.start && range.end) {
        return fechaStr >= range.start && fechaStr <= range.end;
      } else if (range.start) {
        return fechaStr >= range.start;
      } else if (range.end) {
        return fechaStr <= range.end;
      }
      return true;
    });
  }, [getDateRange]);

  // Función para ocultar transacciones localmente (sin llamar a la API)
  const handleHideTransaction = (transactionId: string | number) => {
    hideTransactionLocal(transactionId);
    toast({
      title: "Transacción ocultada",
      description: "La transacción se ha ocultado correctamente"
    });
  };

  // Mutación para eliminar transacciones pendientes
  const deletePendingTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/transacciones/${id}`), {
        method: "DELETE",
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitud eliminada",
        description: "La transacción pendiente se ha eliminado exitosamente.",
      });
      
      // Invalidar y refetch queries de pendientes
      // Invalidar y refetch queries de pendientes (crítico para notificaciones push)
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes"] });
      queryClient.refetchQueries({ queryKey: ["/api/transacciones/pendientes/count"] });
      
      // Invalidar queries del volquetero
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"] });
      // React Query refetchea automáticamente si la query está activa
      
      // Invalidar y refetch módulo general de transacciones (todas las páginas)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            typeof queryKey[0] === "string" &&
            queryKey[0] === "/api/transacciones";
        },
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
            queryKey.length > 0 &&
            typeof queryKey[0] === "string" &&
            queryKey[0] === "/api/transacciones";
        },
      });
      
      setShowDeletePendingConfirm(false);
      setSelectedTransaction(null);
    },
    onError: (error: any) => {
      console.error("Error deleting solicitud:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la solicitud. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Función para mostrar todas las transacciones ocultas localmente
  const handleShowAllHidden = () => {
    showAllHiddenLocal();
    toast({
      title: "Transacciones restauradas",
      description: "Todas las transacciones ocultas ahora son visibles"
    });
  };

  // Aplicar filtros a transacciones (incluyendo filtro de ocultas local)
  const transaccionesFiltradas = useMemo(() => {
    // Primero filtrar transacciones ocultas localmente (aplica a viajes y manuales)
    let filtered = filterType === "ocultas"
      ? transaccionesFormateadas.filter(t => isTransactionHidden(t.id))
      : transaccionesFormateadas.filter(t => !isTransactionHidden(t.id));
    
    // Luego filtrar por fecha
    filtered = filterTransaccionesByDate(
      filtered,
      transaccionesFechaFilterType,
      transaccionesFechaFilterValue,
      transaccionesFechaFilterValueEnd
    );
    
    // Aplicar filtro de búsqueda
    // Filtro de búsqueda (concepto, comentario y monto/valor)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const searchNumeric = searchTerm.replace(/[^\d]/g, ''); // Solo números para búsqueda en valor
      filtered = filtered.filter(t => {
        const concepto = (t.concepto || '').toLowerCase();
        const comentario = (t.comentario || '').toLowerCase();
        const valor = String(t.valor || '').replace(/[^\d]/g, ''); // Solo números del valor
        return concepto.includes(searchLower) ||
               comentario.includes(searchLower) ||
               (searchNumeric && valor.includes(searchNumeric));
      });
    }
    
    // Aplicar filtro de balance
    if (balanceFilter === 'positivos') {
      filtered = filtered.filter(t => {
        const valor = parseFloat(t.valor || "0");
        return valor > 0;
      });
    } else if (balanceFilter === 'negativos') {
      filtered = filtered.filter(t => {
        const valor = parseFloat(t.valor || "0");
        return valor < 0;
      });
    }
    // Si balanceFilter === 'all', no filtrar por balance
    
    return filtered;
  }, [transaccionesFormateadas, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd, searchTerm, filterTransaccionesByDate, balanceFilter, isTransactionHidden, filterType]);

  // Aplicar filtros a viajes
  const viajesFiltrados = useMemo(() => {
    let filtered = Array.isArray(viajesVolquetero) ? viajesVolquetero : [];

    filtered = filterViajesByDate(
      filtered,
      viajesFechaFilterType,
      viajesFechaFilterValue,
      viajesFechaFilterValueEnd
    );

    if (viajesSearchTerm.trim()) {
      const searchLower = viajesSearchTerm.toLowerCase();
      const searchNumeric = viajesSearchTerm.replace(/[^\d]/g, "");
      filtered = filtered.filter(v => {
        const idStr = String(v.id || "");
        const conductor = (v.conductor || "").toLowerCase();
        const placa = (v.placa || "").toLowerCase();
        const tipoCarro = (v.tipoCarro || "").toLowerCase();
        return idStr.includes(searchNumeric || searchLower) ||
          conductor.includes(searchLower) ||
          placa.includes(searchLower) ||
          tipoCarro.includes(searchLower);
      });
    }

    return filtered;
  }, [viajesVolquetero, viajesFechaFilterType, viajesFechaFilterValue, viajesFechaFilterValueEnd, viajesSearchTerm, filterViajesByDate]);

  const viajesById = useMemo(() => {
    const source = (todosViajesIncOcultos && todosViajesIncOcultos.length > 0)
      ? todosViajesIncOcultos
      : viajesVolquetero;
    return new Map(source.map((viaje) => [String(viaje.id), viaje]));
  }, [todosViajesIncOcultos, viajesVolquetero]);

  const formatConductorShort = useCallback((name?: string | null) => {
    if (!name) return "-";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "-";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }, []);

  const buildConceptoForTransaccion = useCallback((transaccion: any) => {
    const conceptoBase = transaccion.concepto || "";
    if (transaccion.tipo !== "Viaje" && transaccion.deQuienTipo !== "viaje") {
      return conceptoBase;
    }

    const idFromId = typeof transaccion.id === "string" && transaccion.id.startsWith("viaje-")
      ? transaccion.id.replace("viaje-", "")
      : null;
    const idFromConcepto = typeof transaccion.concepto === "string"
      ? (transaccion.concepto.match(/Viaje\s+([A-Za-z0-9_-]+)/i)?.[1] || null)
      : null;
    const viajeId = idFromId || idFromConcepto;
    if (!viajeId) return conceptoBase;

    const viaje = viajesById.get(String(viajeId));
    if (!viaje) return conceptoBase;

    const conductorLabel = formatConductorShort(viaje.conductor || viaje.volquetero?.nombre);
    const placa = viaje.placa || "-";
    const peso = viaje.peso ? String(viaje.peso) : "-";
    return `${conceptoBase} | ${conductorLabel} | ${placa} | ${peso}`;
  }, [viajesById, formatConductorShort]);

  const transaccionesParaImagen = useMemo(() => {
    return transaccionesFiltradas.map((transaccion) => ({
      ...transaccion,
      concepto: buildConceptoForTransaccion(transaccion),
    }));
  }, [transaccionesFiltradas, buildConceptoForTransaccion]);
  
  // Balance del encabezado (INCLUYE todas las transacciones y viajes, incluso ocultos)
  // Este balance NO debe cambiar al ocultar/mostrar transacciones
  const balanceEncabezado = useMemo(() => {
    if (!volquetero) return { total: 0 };
    
    // Calcular ingresos de viajes (solo viajes donde RodMar paga el flete, incluyendo ocultos)
    // Excluir viajes donde el comprador paga el flete porque no afectan el balance del volquetero
    const ingresosViajes = todosViajesIncOcultos
      .filter(v => 
        v.quienPagaFlete !== "comprador" && 
        v.quienPagaFlete !== "El comprador"
      )
      .reduce((sum, v) => {
        const totalFlete = parseFloat(v.totalFlete || "0");
        return sum + totalFlete; // Positivo porque es ingreso para volquetero
      }, 0);
    
    // Calcular transacciones manuales (todas, incluyendo ocultas localmente)
    // EXCLUIR transacciones pendientes (no afectan balances)
    let totalManuales = 0;
    (transaccionesData as TransaccionWithSocio[])
      .filter((t: TransaccionWithSocio) => t.estado !== 'pendiente') // Excluir transacciones pendientes
      .forEach((t: TransaccionWithSocio) => {
        const valor = parseFloat(t.valor || "0");
        
        // Lógica correcta de signos para volqueteros:
        // - Si deQuienTipo === 'volquetero' → POSITIVO (volquetero paga = suma a su balance)
        // - Si paraQuienTipo === 'volquetero' → NEGATIVO (RodMar paga = reduce su saldo)
        if (t.deQuienTipo === 'volquetero' && t.deQuienId === volqueteroIdActual.toString()) {
          totalManuales += Math.abs(valor); // POSITIVO
        } else if (t.paraQuienTipo === 'volquetero' && t.paraQuienId === volqueteroIdActual.toString()) {
          totalManuales -= Math.abs(valor); // NEGATIVO
        }
      });
    
    return {
      ingresosViajes,
      transacciones: totalManuales,
      total: ingresosViajes + totalManuales
    };
  }, [todosViajesIncOcultos, transaccionesData, volquetero, volqueteroIdActual]);

  // Calcular balance resumido correctamente (para la pestaña de transacciones - usa transacciones filtradas)
  const balanceResumido = useMemo(() => {
    // Excluir transacciones pendientes del cálculo de balance (las ocultas ya están filtradas)
    const transaccionesVisibles = transaccionesFiltradas.filter(t => {
      const realTransaction = (t as any).originalTransaction || t;
      return realTransaction?.estado !== 'pendiente';
    });
    
    let positivos = 0;
    let negativos = 0;
    
    transaccionesVisibles.forEach(t => {
      const valor = parseFloat(t.valor || "0");
      if (valor > 0) {
        positivos += valor;
      } else if (valor < 0) {
        negativos += Math.abs(valor);
      }
    });
    
    return {
      positivos,
      negativos,
      balance: positivos - negativos
    };
  }, [transaccionesFiltradas]);

  const viajesFilterLabel = useMemo(() => {
    const formatDateForLabel = (dateString: string): string => {
      if (!dateString) return "";
      if (dateString.includes("-")) {
        const [year, month, day] = dateString.split("-");
        return `${day}/${month}/${year}`;
      }
      return dateString;
    };

    const formatValue = formatDateForLabel(viajesFechaFilterValue);
    const formatValueEnd = formatDateForLabel(viajesFechaFilterValueEnd);

    const filterLabels: Record<string, string> = {
      "todos": "Todos los Viajes",
      "exactamente": `Fecha: ${formatValue}`,
      "entre": `Entre: ${formatValue} - ${formatValueEnd}`,
      "despues-de": `Después de ${formatValue}`,
      "antes-de": `Antes de ${formatValue}`,
      "hoy": "Hoy",
      "ayer": "Ayer",
      "esta-semana": "Esta Semana",
      "semana-pasada": "Semana Pasada",
      "este-mes": "Este Mes",
      "mes-pasado": "Mes Pasado",
      "este-año": "Este Año",
      "año-pasado": "Año Pasado"
    };

    return filterLabels[viajesFechaFilterType] || "Filtro Personalizado";
  }, [viajesFechaFilterType, viajesFechaFilterValue, viajesFechaFilterValueEnd]);
  
  // Función para crear transacción temporal
  const handleCreateTemporalTransaction = (data: any) => {
    const temporalId = `temporal-${Date.now()}`;
    const fechaTransaccion = new Date(data.fecha);
    const horaInternaFija = new Date(fechaTransaccion);
    horaInternaFija.setHours(0, 0, 1, 0);
    
    const nuevaTransacionTemporal: TransaccionWithSocio = {
      id: parseInt(temporalId.replace('temporal-', '')) || 0,
      concepto: data.concepto,
      valor: data.valor.toString(),
      fecha: fechaTransaccion,
      horaInterna: horaInternaFija,
      formaPago: data.formaPago,
      voucher: data.voucher || null,
      comentario: data.comentario || null,
      deQuienTipo: data.deQuienTipo || null,
      deQuienId: data.deQuienId || null,
      paraQuienTipo: data.paraQuienTipo || null,
      paraQuienId: data.paraQuienId || null,
      postobonCuenta: data.postobonCuenta || null,
      tipoTransaccion: "manual",
      oculta: false,
      ocultaEnComprador: false,
      ocultaEnMina: false,
      ocultaEnVolquetero: false,
      ocultaEnGeneral: false,
      userId: "main_user",
      createdAt: new Date(),
      tipoSocio: "volquetero" as const,
      socioId: volqueteroIdActual,
      socioNombre: volquetero?.nombre || ""
    };
    
    setTransaccionesTemporales(prev => [...prev, nuevaTransacionTemporal]);
    setShowTemporalTransaction(false);
    
    toast({
      title: "Transacción temporal creada",
      description: "La transacción temporal se ha agregado correctamente. Se eliminará al salir de la vista.",
    });
  };
  
  // Función para eliminar transacción temporal
  const handleDeleteTemporalTransaction = (temporalId: string | number) => {
    const idToCompare = typeof temporalId === 'string' ? parseInt(temporalId.replace('temporal-', '')) || 0 : temporalId;
    setTransaccionesTemporales(prev => prev.filter(t => t.id !== idToCompare));
    toast({
      title: "Transacción temporal eliminada",
      description: "La transacción temporal se ha eliminado correctamente.",
    });
  };
  
  // Limpiar transacciones temporales al cambiar de pestaña o salir
  useEffect(() => {
    if (activeTab !== "transacciones") {
      setTransaccionesTemporales([]);
    }
    
    return () => {
      setTransaccionesTemporales([]);
    };
  }, [activeTab]);

  // Early return después de todos los hooks
  if (!volquetero) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Volquetero no encontrado</p>
              <Link href="/volqueteros">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Volqueteros
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // viajesVolquetero ya está definido arriba usando useQuery con el endpoint específico

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-card shadow-sm border-b">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/volqueteros">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{volquetero.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                {volquetero.placas.length} vehículo{volquetero.placas.length !== 1 ? 's' : ''} • {volquetero.viajesCount || 0} viajes
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className={`text-lg font-bold ${balanceEncabezado.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {balanceEncabezado.total >= 0 ? '+' : ''}{formatCurrency(balanceEncabezado.total)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${
            [has("module.VOLQUETEROS.tab.VIAJES.view"), has("module.VOLQUETEROS.tab.TRANSACCIONES.view"), has("module.VOLQUETEROS.tab.BALANCES.view")]
              .filter(Boolean).length === 3 ? "grid-cols-3" :
            [has("module.VOLQUETEROS.tab.VIAJES.view"), has("module.VOLQUETEROS.tab.TRANSACCIONES.view"), has("module.VOLQUETEROS.tab.BALANCES.view")]
              .filter(Boolean).length === 2 ? "grid-cols-2" : "grid-cols-1"
          }`}>
            {has("module.VOLQUETEROS.tab.VIAJES.view") && (
              <TabsTrigger value="viajes" className="text-xs">
                Viajes ({viajesVolquetero.length})
              </TabsTrigger>
            )}
            {has("module.VOLQUETEROS.tab.TRANSACCIONES.view") && (
              <TabsTrigger value="transacciones" className="text-xs">
                Transacciones ({transaccionesFiltradas.length})
              </TabsTrigger>
            )}
            {has("module.VOLQUETEROS.tab.BALANCES.view") && (
              <TabsTrigger value="balance" className="text-xs">
                Balance
              </TabsTrigger>
            )}
          </TabsList>

          {has("module.VOLQUETEROS.tab.VIAJES.view") && (
            <TabsContent value="viajes" className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  type="text"
                  placeholder="Buscar..."
                  value={viajesSearchTerm}
                  onChange={(e) => setViajesSearchTerm(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <Select value={viajesFechaFilterType} onValueChange={(value: DateFilterType) => setViajesFechaFilterType(value)}>
                  <SelectTrigger className="h-8 text-xs px-2 w-40">
                    <SelectValue placeholder="Filtrar por fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="exactamente">Exactamente</SelectItem>
                    <SelectItem value="entre">Entre</SelectItem>
                    <SelectItem value="despues-de">Después de</SelectItem>
                    <SelectItem value="antes-de">Antes de</SelectItem>
                    <SelectItem value="hoy">Hoy</SelectItem>
                    <SelectItem value="ayer">Ayer</SelectItem>
                    <SelectItem value="esta-semana">Esta semana</SelectItem>
                    <SelectItem value="semana-pasada">Semana pasada</SelectItem>
                    <SelectItem value="este-mes">Este mes</SelectItem>
                    <SelectItem value="mes-pasado">Mes pasado</SelectItem>
                    <SelectItem value="este-año">Este año</SelectItem>
                    <SelectItem value="año-pasado">Año pasado</SelectItem>
                  </SelectContent>
                </Select>
                {canViewCargue && (
                  <Button
                    onClick={() => {
                      if (canUseCargue) setShowRegisterCargue(true);
                    }}
                    size="sm"
                    variant="outline"
                    disabled={!canUseCargue}
                    className={`h-8 px-3 text-xs font-medium ${
                      canUseCargue
                        ? "text-blue-600 border-blue-600 hover:bg-blue-50"
                        : "text-gray-400 border-gray-200"
                    }`}
                  >
                    <span className="sm:hidden">+ Cargue</span>
                    <span className="hidden sm:inline">Registrar Cargue</span>
                  </Button>
                )}
                {canViewDescargue && (
                  <Button
                    onClick={() => {
                      if (canUseDescargue) setShowRegisterDescargue(true);
                    }}
                    size="sm"
                    variant="outline"
                    disabled={!canUseDescargue}
                    className={`h-8 px-3 text-xs font-medium ${
                      canUseDescargue
                        ? "text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                        : "text-gray-400 border-gray-200"
                    }`}
                  >
                    <span className="sm:hidden">+ Descargue</span>
                    <span className="hidden sm:inline">Registrar Descargue</span>
                  </Button>
                )}
                <Button
                  onClick={() => setShowViajesImagePreview(true)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1"
                  title="Descargar imagen de viajes"
                  disabled={viajesFiltrados.length === 0}
                >
                  <Image className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Imagen</span>
                  <span className="sm:hidden">IMG</span>
                </Button>
              </div>

              {(viajesFechaFilterType === "exactamente" || viajesFechaFilterType === "entre" || viajesFechaFilterType === "despues-de" || viajesFechaFilterType === "antes-de") && (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={viajesFechaFilterValue}
                    onChange={(e) => setViajesFechaFilterValue(e.target.value)}
                    className="h-8 text-xs"
                  />
                  {viajesFechaFilterType === "entre" && (
                    <Input
                      type="date"
                      value={viajesFechaFilterValueEnd}
                      onChange={(e) => setViajesFechaFilterValueEnd(e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              )}
            </div>
            {viajesFiltrados.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay viajes registrados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {viajesFiltrados.map((viaje) => (
                  <TripCard 
                    key={viaje.id} 
                    viaje={viaje as any}
                    context="volquetero"
                    onEditTrip={(trip) => {
                      setSelectedTrip(trip);
                      setShowEditTrip(true);
                    }}
                    showEditButton={canViewEditTrip}
                    editDisabled={!canUseEditTrip}
                    showExtendedFinancialToggle={canViewExtendedFinancial}
                    extendedFinancialDisabled={!canUseExtendedFinancial}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          )}

          {has("module.VOLQUETEROS.tab.TRANSACCIONES.view") && (
            <TabsContent value="transacciones" className="space-y-4">
            {/* Card de filtros - SIEMPRE visible */}
            <Card className="border-gray-200">
                  <CardContent className="p-2">
                    <div className="space-y-2">
                      {/* Fila superior: Búsqueda */}
                      <div className="flex gap-2 items-center">
                        <Input
                          type="text"
                          placeholder="Buscar..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="flex-1 h-8 text-xs"
                        />
                        <Button
                          onClick={() => setShowTemporalTransaction(true)}
                          size="sm"
                          variant="outline"
                          className="bg-orange-50 hover:bg-orange-100 border-orange-600 text-orange-600 h-8 px-3 text-xs flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>TEMP</span>
                        </Button>
                        <Button
                          onClick={() => setShowTransaccionesImagePreview(true)}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1"
                          title="Descargar imagen de transacciones"
                        >
                          <Image className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Imagen</span>
                          <span className="sm:hidden">IMG</span>
                        </Button>
                      </div>
                      
                      {/* Fila inferior: Filtro de tipo y botón mostrar ocultas */}
                      <div className="flex gap-2 items-center">
                        {/* Filtro de tipo (todas/ocultas) */}
                        <Select value={filterType} onValueChange={(value: "todas" | "ocultas") => setFilterType(value)}>
                          <SelectTrigger className="h-8 text-xs px-2 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todas">Todas</SelectItem>
                            <SelectItem value="ocultas">Ocultas</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {/* Botón mostrar ocultas */}
                        {(() => {
                          const transaccionesOcultas = getHiddenTransactionsCount();
                          const hayElementosOcultos = transaccionesOcultas > 0;
                          
                          return hayElementosOcultos ? (
                            <Button
                              onClick={handleShowAllHidden}
                              size="sm"
                              className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs"
                              title={`Mostrar ${transaccionesOcultas} transacción(es) oculta(s)`}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              {transaccionesOcultas}
                            </Button>
                          ) : null;
                        })()}
                        
                        {/* Filtro de fecha compacto */}
                        <div className="flex-1 sm:w-48">
                          <Select value={transaccionesFechaFilterType} onValueChange={(value: DateFilterType) => setTransaccionesFechaFilterType(value)}>
                            <SelectTrigger className="h-8 text-xs px-2">
                              <SelectValue placeholder="Filtrar por fecha" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              <SelectItem value="exactamente">Exactamente</SelectItem>
                              <SelectItem value="entre">Entre</SelectItem>
                              <SelectItem value="despues-de">Después de</SelectItem>
                              <SelectItem value="antes-de">Antes de</SelectItem>
                              <SelectItem value="hoy">Hoy</SelectItem>
                              <SelectItem value="ayer">Ayer</SelectItem>
                              <SelectItem value="esta-semana">Esta semana</SelectItem>
                              <SelectItem value="semana-pasada">Semana pasada</SelectItem>
                              <SelectItem value="este-mes">Este mes</SelectItem>
                              <SelectItem value="mes-pasado">Mes pasado</SelectItem>
                              <SelectItem value="este-año">Este año</SelectItem>
                              <SelectItem value="año-pasado">Año pasado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Segunda fila solo cuando se necesiten inputs de fecha */}
                      {(transaccionesFechaFilterType === "exactamente" || transaccionesFechaFilterType === "entre" || transaccionesFechaFilterType === "despues-de" || transaccionesFechaFilterType === "antes-de") && (
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={transaccionesFechaFilterValue}
                            onChange={(e) => setTransaccionesFechaFilterValue(e.target.value)}
                            className="flex-1 h-8 text-xs"
                          />
                          {transaccionesFechaFilterType === "entre" && (
                            <Input
                              type="date"
                              value={transaccionesFechaFilterValueEnd}
                              onChange={(e) => setTransaccionesFechaFilterValueEnd(e.target.value)}
                              className="flex-1 h-8 text-xs"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

            {/* Balance dinámico basado en transacciones filtradas y visibles - SIEMPRE visible */}
            <Card className="border-gray-200 bg-gray-50">
              <CardContent className="p-1.5 sm:p-2">
                <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center">
                  <div 
                    className={`bg-green-50 rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${
                      balanceFilter === 'positivos' ? 'ring-2 ring-green-400 shadow-md' : ''
                    }`}
                    onClick={() => setBalanceFilter('positivos')}
                  >
                    <div className="text-green-600 text-xs font-medium">Positivos</div>
                    <div className="text-green-700 text-xs sm:text-sm font-semibold">
                      +{transaccionesFiltradas.filter(t => {
                        const realTransaction = (t as any).originalTransaction || t;
                        return realTransaction?.estado !== 'pendiente' && parseFloat(t.valor) > 0;
                      }).length} {formatCurrency(balanceResumido.positivos)}
                    </div>
                  </div>
                  <div 
                    className={`bg-red-50 rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${
                      balanceFilter === 'negativos' ? 'ring-2 ring-red-400 shadow-md' : ''
                    }`}
                    onClick={() => setBalanceFilter('negativos')}
                  >
                    <div className="text-red-600 text-xs font-medium">Negativos</div>
                    <div className="text-red-700 text-xs sm:text-sm font-semibold">
                      -{transaccionesFiltradas.filter(t => {
                        const realTransaction = (t as any).originalTransaction || t;
                        return realTransaction?.estado !== 'pendiente' && parseFloat(t.valor) < 0;
                      }).length} {formatCurrency(balanceResumido.negativos)}
                    </div>
                  </div>
                  <div 
                    className={`rounded px-2 py-1 cursor-pointer transition-all hover:shadow-md ${
                      balanceResumido.balance >= 0 ? 'bg-green-100' : 'bg-red-100'
                    } ${
                      balanceFilter === 'all' 
                        ? balanceResumido.balance >= 0
                          ? 'ring-2 ring-green-400 shadow-md'
                          : 'ring-2 ring-red-400 shadow-md'
                        : ''
                    }`}
                    onClick={() => setBalanceFilter('all')}
                  >
                    <div className={`text-xs font-medium ${balanceResumido.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balance</div>
                    <div className={`text-xs sm:text-sm font-bold ${balanceResumido.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {balanceResumido.balance >= 0 ? '+' : ''}{formatCurrency(Math.abs(balanceResumido.balance))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contenido de transacciones - condicionado */}
            {transaccionesFormateadas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No hay transacciones registradas</p>
                </CardContent>
              </Card>
            ) : transaccionesFiltradas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-muted-foreground">
                    {filterType === "ocultas" 
                      ? "No hay transacciones ocultas" 
                      : "No hay transacciones que coincidan con los filtros"}
                  </p>
                  {(transaccionesFechaFilterType !== "todos" || 
                    transaccionesFechaFilterValue || 
                    transaccionesFechaFilterValueEnd ||
                    searchTerm.trim() ||
                    filterType === "ocultas") && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setTransaccionesFechaFilterType("todos");
                        setTransaccionesFechaFilterValue("");
                        setTransaccionesFechaFilterValueEnd("");
                        setSearchTerm("");
                        setFilterType("todas");
                      }}
                      className="mt-2"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpiar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Vista de tabla para desktop */}
                <div className="bg-card rounded-lg border overflow-hidden hidden md:block">
                    <div className="overflow-x-auto">
                    <Table className="w-full min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left p-3 font-medium text-sm">FECHA</TableHead>
                          <TableHead className="text-left p-3 font-medium text-sm">CONCEPTO</TableHead>
                          <TableHead className="text-right p-3 font-medium text-sm">VALOR</TableHead>
                          <TableHead className="text-center p-3 font-medium text-sm min-w-[80px] whitespace-nowrap">ACCIÓN</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transaccionesFiltradas.map((transaccion, index) => {
                          const valor = parseFloat(transaccion.valor);
                          
                          return (
                            <TableRow 
                              key={transaccion.id}
                              className={`cursor-pointer transition-colors ${
                                transaccion.originalTransaction?.estado === 'pendiente'
                                  ? 'bg-orange-50 border-l-4 border-l-orange-400 hover:bg-orange-100'
                                  : `${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-gray-50`
                              }`}
                              onClick={() => {
                                if (transaccion.tipo === "Manual" && transaccion.originalTransaction) {
                                  setSelectedTransaction(transaccion.originalTransaction);
                                  setSelectedRelatedTrip(null);
                                  // Si es transacción pendiente, abrir modal de detalles de solicitud
                                  if (transaccion.originalTransaction.estado === 'pendiente') {
                                    setShowPendingDetailModal(true);
                                  } else {
                                    setShowTransactionDetail(true);
                                  }
                                } else if (transaccion.tipo === "Viaje") {
                                  // Transacción automática de viaje: abrir detalle con el viaje relacionado.
                                  setSelectedTransaction(transaccion);
                                  setSelectedRelatedTrip(getRelatedTripForTransaction(transaccion));
                                  setShowTransactionDetail(true);
                                } else if (transaccion.tipo === "Temporal") {
                                  // Las transacciones temporales no tienen detalle, solo se pueden eliminar
                                }
                              }}
                            >
                              <TableCell className="p-3 text-sm">
                                {(() => {
                                  const fecha = transaccion.fecha;
                                  let fechaDate: Date;
                                  
                                  if (fecha instanceof Date) {
                                    fechaDate = fecha;
                                  } else if (typeof fecha === 'string') {
                                    // Convertir string a Date
                                    const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                                    const [year, month, day] = dateStr.split('-').map(Number);
                                    fechaDate = new Date(year, month - 1, day);
                                  } else {
                                    return "Sin fecha";
                                  }
                                  
                                  // Validar que la fecha sea válida
                                  if (isNaN(fechaDate.getTime())) {
                                    return "Sin fecha";
                                  }
                                  
                                  const day = String(fechaDate.getDate()).padStart(2, '0');
                                  const month = String(fechaDate.getMonth() + 1).padStart(2, '0');
                                  const year = String(fechaDate.getFullYear()).slice(-2);
                                  const dayOfWeek = getDayOfWeek(fechaDate);
                                  return `${dayOfWeek}. ${day}/${month}/${year}`;
                                })()}
                              </TableCell>
                              <TableCell className="p-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <span>{highlightText(buildConceptoForTransaccion(transaccion), searchTerm)}</span>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs px-1.5 py-0.5"
                                  >
                                    {transaccion.tipo === "Manual" ? "M" : transaccion.tipo === "Temporal" ? "T" : "V"}
                                  </Badge>
                                </div>
                                {/* Comentario si existe */}
                                {transaccion.comentario && transaccion.comentario.trim() && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {highlightText(transaccion.comentario, searchTerm)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className={`p-3 text-sm text-right font-medium ${
                                (() => {
                                  // Transacciones pendientes = azul claro (no afectan balances)
                                  const realTransaction = transaccion.originalTransaction || transaccion;
                                  if (realTransaction?.estado === 'pendiente') {
                                    return 'text-blue-400'; // Azul claro para pendientes
                                  } else if (transaccion.tipo === "Viaje") {
                                    return 'text-green-600 dark:text-green-400';
                                  } else if (valor >= 0) {
                                    return 'text-green-600 dark:text-green-400';
                                  } else {
                                    return 'text-red-600 dark:text-red-400';
                                  }
                                })()
                              }`}>
                                {(() => {
                                  const valorText = transaccion.tipo === "Viaje" 
                                    ? `+${formatCurrency(Math.abs(valor))}`
                                    : valor >= 0 
                                      ? `+${formatCurrency(valor)}`
                                      : `-${formatCurrency(Math.abs(valor))}`;
                                  return highlightValue(valorText, searchTerm);
                                })()}
                              </TableCell>
                              <TableCell className="p-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {transaccion.tipo === "Temporal" ? (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTemporalTransaction(transaccion.id);
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-red-100"
                                      title="Eliminar transacción temporal"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-600" />
                                    </Button>
                                  ) : transaccion.tipo === "Manual" && transaccion.originalTransaction ? (
                                    <>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const realTransaction = transaccion.originalTransaction;
                                          setSelectedTransaction(realTransaction);
                                          // Si es transacción pendiente, abrir modal de editar pendiente
                                          if (realTransaction?.estado === 'pendiente') {
                                            setShowEditPendingTransaction(true);
                                          } else {
                                            setEditingTransaction(realTransaction);
                                          }
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-blue-100"
                                        title="Editar transacción"
                                      >
                                        <Edit className="h-3 w-3 text-blue-600" />
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const realTransaction = transaccion.originalTransaction;
                                          setSelectedTransaction(realTransaction);
                                          // Si es transacción pendiente, abrir modal de confirmación de eliminación
                                          if (realTransaction?.estado === 'pendiente') {
                                            setShowDeletePendingConfirm(true);
                                          } else {
                                            setDeletingTransaction(realTransaction);
                                          }
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-red-100"
                                        title="Eliminar transacción"
                                      >
                                        <Trash2 className="h-3 w-3 text-red-600" />
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleHideTransaction(transaccion.id);
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-gray-100"
                                        title="Ocultar transacción"
                                      >
                                        <Eye className="h-3 w-3 text-gray-500" />
                                      </Button>
                                    </>
                                  ) : transaccion.tipo === "Viaje" ? (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleHideTransaction(transaccion.id);
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-gray-100"
                                      title="Ocultar viaje de transacciones"
                                    >
                                      <Eye className="h-3 w-3 text-gray-500" />
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Vista de cards para móvil */}
                <div className="space-y-2 md:hidden">
                  {transaccionesFiltradas.map((transaccion) => {
                    const valor = parseFloat(transaccion.valor);
                    
                    return (
                      <Card 
                        key={transaccion.id} 
                        className={`transition-colors ${
                          transaccion.originalTransaction?.estado === 'pendiente'
                            ? 'bg-orange-50 border-2 border-orange-300 cursor-pointer hover:bg-orange-100'
                            : `border border-gray-200 ${
                                transaccion.tipo === "Manual" || transaccion.tipo === "Temporal"
                                  ? "cursor-pointer hover:bg-gray-50" 
                                  : "cursor-default"
                              }`
                        }`}
                        onClick={() => {
                          if (transaccion.tipo === "Manual" && transaccion.originalTransaction) {
                            setSelectedTransaction(transaccion.originalTransaction);
                            setSelectedRelatedTrip(null);
                            // Si es transacción pendiente, abrir modal de detalles de solicitud
                            if (transaccion.originalTransaction.estado === 'pendiente') {
                              setShowPendingDetailModal(true);
                            } else {
                              setShowTransactionDetail(true);
                            }
                          } else if (transaccion.tipo === "Viaje") {
                            setSelectedTransaction(transaccion);
                            setSelectedRelatedTrip(getRelatedTripForTransaction(transaccion));
                            setShowTransactionDetail(true);
                          } else if (transaccion.tipo === "Temporal") {
                            // Las transacciones temporales no tienen detalle, solo se pueden eliminar
                          }
                        }}
                      >
                        <CardContent className="p-2 sm:p-3">
                          <div className="flex items-center justify-between gap-2">
                            {/* Lado izquierdo: Fecha y concepto */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-600">
                        {(() => {
                          const fecha = transaccion.fecha;
                          let fechaDate: Date;
                          
                          if (fecha instanceof Date) {
                            fechaDate = fecha;
                          } else if (typeof fecha === 'string') {
                            // Convertir string a Date
                            const dateStr = fecha.includes('T') ? fecha.split('T')[0] : fecha;
                            const [year, month, day] = dateStr.split('-').map(Number);
                            fechaDate = new Date(year, month - 1, day);
                          } else {
                            return "Sin fecha";
                          }
                          
                          // Validar que la fecha sea válida
                          if (isNaN(fechaDate.getTime())) {
                            return "Sin fecha";
                          }
                          
                          const day = String(fechaDate.getDate()).padStart(2, '0');
                          const month = String(fechaDate.getMonth() + 1).padStart(2, '0');
                          const year = String(fechaDate.getFullYear()).slice(-2);
                          const dayOfWeek = getDayOfWeek(fechaDate);
                          return `${dayOfWeek}. ${day}/${month}/${year}`;
                        })()}
                                </span>
                                {transaccion.tipo === "Viaje" ? (
                                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4">V</Badge>
                                ) : transaccion.tipo === "Temporal" ? (
                                  <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-yellow-50">T</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs px-1 py-0 h-4">M</Badge>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-900 truncate pr-1">
                                {highlightText(buildConceptoForTransaccion(transaccion), searchTerm)}
                              </div>
                              {/* Comentario compacto si existe */}
                              {transaccion.comentario && transaccion.comentario.trim() && (
                                <div className="text-xs text-gray-500 mt-0.5 leading-tight">
                                  {(() => {
                                    const comentarioText = transaccion.comentario.length > 50 ? 
                                      `${transaccion.comentario.substring(0, 50)}...` : 
                                      transaccion.comentario;
                                    return highlightText(comentarioText, searchTerm);
                                  })()}
                                </div>
                              )}
                      </div>

                            {/* Lado derecho: Valor y acción */}
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                                (() => {
                                  // Transacciones pendientes = azul claro (no afectan balances)
                                  const realTransaction = transaccion.originalTransaction || transaccion;
                                  if (realTransaction?.estado === 'pendiente') {
                                    return 'text-blue-400'; // Azul claro para pendientes
                                  } else if (transaccion.tipo === "Viaje") {
                                    return 'text-green-600';
                                  } else if (valor >= 0) {
                                    return 'text-green-600';
                                  } else {
                                    return 'text-red-600';
                                  }
                                })()
                              }`}>
                                {transaccion.tipo === "Viaje" 
                                  ? `+$ ${Math.abs(valor).toLocaleString()}`
                                  : valor >= 0 
                                    ? `+$ ${valor.toLocaleString()}`
                                    : `-$ ${Math.abs(valor).toLocaleString()}`
                                }
                              </span>
                              
                              {transaccion.tipo === "Temporal" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-red-100 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTemporalTransaction(transaccion.id);
                                  }}
                                  title="Eliminar transacción temporal"
                                >
                                  <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600" />
                                </Button>
                              ) : transaccion.tipo === "Manual" && transaccion.originalTransaction ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-blue-100 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const realTransaction = transaccion.originalTransaction;
                                      setSelectedTransaction(realTransaction);
                                      // Si es transacción pendiente, abrir modal de editar pendiente
                                      if (realTransaction?.estado === 'pendiente') {
                                        setShowEditPendingTransaction(true);
                                      } else {
                                        setEditingTransaction(realTransaction);
                                      }
                                    }}
                                    title="Editar transacción"
                                  >
                                    <Edit className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-red-100 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const realTransaction = transaccion.originalTransaction;
                                      setSelectedTransaction(realTransaction);
                                      // Si es transacción pendiente, abrir modal de confirmación de eliminación
                                      if (realTransaction?.estado === 'pendiente') {
                                        setShowDeletePendingConfirm(true);
                                      } else {
                                        setDeletingTransaction(realTransaction);
                                      }
                                    }}
                                    title="Eliminar transacción"
                                  >
                                    <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-gray-100 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHideTransaction(transaccion.id);
                                    }}
                                    title="Ocultar transacción"
                                  >
                                    <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                                  </Button>
                                </div>
                              ) : transaccion.tipo === "Viaje" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-gray-100 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHideTransaction(transaccion.id);
                                  }}
                                  title="Ocultar viaje de transacciones"
                                >
                                  <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                                </Button>
                              ) : (
                                <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center shrink-0">
                                  <span className="text-xs text-gray-400">—</span>
                                </div>
                              )}
                      </div>
                    </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
          )}

          {has("module.VOLQUETEROS.tab.BALANCES.view") && (
            <TabsContent value="balance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Balance General</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Desglose de ingresos por viajes */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Ingresos por Viajes (Fletes)</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(transaccionesFormateadas
                        .filter(t => t.tipo === "Viaje")
                        .reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transaccionesFormateadas.filter(t => t.tipo === "Viaje" && !isTransactionHidden(t.id)).length} viajes donde RodMar paga el flete
                    </p>
                  </div>
                  
                  {/* Desglose de transacciones manuales */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Transacciones Manuales</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Ingresos</p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(transaccionesFormateadas
                            .filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && parseFloat(t.valor) > 0)
                            .reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0)
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaccionesFormateadas.filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && !isTransactionHidden(t.id) && parseFloat(t.valor) > 0).length} transacciones
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Egresos</p>
                        <p className="text-sm font-semibold text-red-600">
                          {formatCurrency(Math.abs(transaccionesFormateadas
                            .filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && parseFloat(t.valor) < 0)
                            .reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0)
                          ))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaccionesFormateadas.filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && !isTransactionHidden(t.id) && parseFloat(t.valor) < 0).length} transacciones
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Balance neto */}
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Balance Neto</p>
                    <p className={`text-2xl font-bold ${
                      balanceResumido.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {balanceResumido.balance >= 0 ? '+' : ''}{formatCurrency(Math.abs(balanceResumido.balance))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {balanceResumido.balance >= 0 
                        ? 'RodMar debe al volquetero' 
                        : 'El volquetero debe a RodMar'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>



      {/* Botón flotante para nueva transacción - Solo visible si tiene permisos */}
      {(has("action.TRANSACCIONES.create") || 
        has("action.TRANSACCIONES.solicitar") || 
        has("action.TRANSACCIONES.completePending")) && (
        <Button
          size="icon"
          className="fixed bottom-24 right-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg z-50"
          onClick={() => setShowGestionarModal(true)}
          aria-label="Gestionar transacciones"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      )}

      {/* Modal de gestionar transacciones */}
      <GestionarTransaccionesModal
        open={showGestionarModal}
        onClose={() => setShowGestionarModal(false)}
        onCrear={() => setShowNewTransactionModal(true)}
        onSolicitar={() => setShowSolicitarModal(true)}
        onCompletar={() => setShowPendingModal(true)}
      />

      {/* Modal de solicitar transacción */}
      <SolicitarTransaccionModal
        open={showSolicitarModal}
        onClose={() => setShowSolicitarModal(false)}
      />

      {/* Modal de transacciones pendientes */}
      <PendingListModal
        open={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        onSelectTransaction={(transaction) => {
          setSelectedTransaction(transaction);
          setShowPendingDetailModal(true);
          setShowPendingModal(false);
        }}
      />

      {/* Modals */}
      <NewTransactionModal
        open={showNewTransactionModal}
        onClose={() => setShowNewTransactionModal(false)}
      />
      
      <NewTransactionModal
        open={showTemporalTransaction}
        onClose={() => setShowTemporalTransaction(false)}
        onSuccess={handleCreateTemporalTransaction}
        isTemporalMode={true}
      />

      <TransactionDetailModal
        open={showTransactionDetail}
        onOpenChange={(open) => {
          setShowTransactionDetail(open);
          if (!open) {
            setSelectedTransaction(null);
            setSelectedRelatedTrip(null);
          }
        }}
        transaction={selectedTransaction}
        relatedTrip={selectedRelatedTrip}
      />

      <EditTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => {
          setEditingTransaction(null);
          setSelectedTransaction(null);
        }}
        transaction={editingTransaction}
      />

      <DeleteTransactionModal
        isOpen={!!deletingTransaction}
        onClose={() => {
          setDeletingTransaction(null);
          setSelectedTransaction(null);
        }}
        transaction={deletingTransaction}
      />

      {/* Modales para transacciones pendientes */}
      {selectedTransaction && selectedTransaction.estado === 'pendiente' && (
        <>
          <SolicitarTransaccionModal
            open={showEditPendingTransaction}
            onClose={() => {
              setShowEditPendingTransaction(false);
              setSelectedTransaction(null);
            }}
            initialData={{
              id: selectedTransaction.id,
              paraQuienTipo: selectedTransaction.paraQuienTipo || '',
              paraQuienId: selectedTransaction.paraQuienId || '',
              valor: selectedTransaction.valor || '',
              comentario: selectedTransaction.comentario || undefined,
              detalle_solicitud: selectedTransaction.detalle_solicitud || '',
            }}
          />
          <PendingDetailModal
            open={showPendingDetailModal}
            transaccion={{
              id: selectedTransaction.id,
              concepto: selectedTransaction.concepto || '',
              valor: selectedTransaction.valor || '',
              fecha: selectedTransaction.fecha?.toString() || '',
              codigo_solicitud: selectedTransaction.codigo_solicitud || null,
              detalle_solicitud: selectedTransaction.detalle_solicitud || null,
              paraQuienTipo: selectedTransaction.paraQuienTipo || null,
              paraQuienId: selectedTransaction.paraQuienId || null,
              comentario: selectedTransaction.comentario || null,
            }}
            onClose={() => {
              setShowPendingDetailModal(false);
              setSelectedTransaction(null);
            }}
            onEdit={(transaccion) => {
              setShowPendingDetailModal(false);
              setShowEditPendingTransaction(true);
            }}
            onComplete={(transaccion) => {
              setShowPendingDetailModal(false);
              setShowCompleteModal(true);
            }}
          />
          <CompleteTransactionModal
            open={showCompleteModal}
            onClose={() => {
              setShowCompleteModal(false);
              setSelectedTransaction(null);
            }}
            transaccionId={selectedTransaction.id}
            paraQuienTipo={selectedTransaction.paraQuienTipo || undefined}
            paraQuienId={selectedTransaction.paraQuienId || undefined}
          />
        </>
      )}

      {/* AlertDialog para confirmar eliminación de transacción pendiente */}
      <AlertDialog open={showDeletePendingConfirm} onOpenChange={setShowDeletePendingConfirm}>
        <AlertDialogContent className="border-2 border-red-300">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la transacción pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTransaction) {
                  deletePendingTransactionMutation.mutate(selectedTransaction.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePendingTransactionMutation.isPending}
            >
              {deletePendingTransactionMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de imagen de transacciones */}
      <TransaccionesImageModal
        open={showTransaccionesImagePreview}
        onOpenChange={(open) => setShowTransaccionesImagePreview(open)}
        transacciones={transaccionesParaImagen}
        title={volquetero?.nombre || "Volquetero"}
        volquetero={volquetero ? { id: volquetero.id, nombre: volquetero.nombre } : undefined}
        subtitle={(() => {
          // Función para formatear fecha en formato DD/MM/YYYY
          const formatDateForLabel = (dateString: string): string => {
            if (!dateString) return "";
            if (dateString.includes('-')) {
              const [year, month, day] = dateString.split('-');
              return `${day}/${month}/${year}`;
            }
            return dateString;
          };

          const formatValue = formatDateForLabel(transaccionesFechaFilterValue);
          const formatValueEnd = formatDateForLabel(transaccionesFechaFilterValueEnd);
          
          const filterLabels: Record<string, string> = {
            "todos": "Todas las Transacciones",
            "exactamente": `Fecha: ${formatValue}`,
            "entre": `Entre: ${formatValue} - ${formatValueEnd}`,
            "despues-de": `Después de ${formatValue}`,
            "antes-de": `Antes de ${formatValue}`,
            "hoy": "Hoy",
            "ayer": "Ayer",
            "esta-semana": "Esta Semana",
            "semana-pasada": "Semana Pasada",
            "este-mes": "Este Mes",
            "mes-pasado": "Mes Pasado",
            "este-año": "Este Año",
            "año-pasado": "Año Pasado"
          };
          
          return filterLabels[transaccionesFechaFilterType] || "Filtro Personalizado";
        })()}
      />

      {/* Modal de imagen de viajes */}
      {volquetero && (
        <VolqueteroViajesImageModal
          open={showViajesImagePreview}
          onOpenChange={setShowViajesImagePreview}
          volquetero={{ id: volquetero.id, nombre: volquetero.nombre }}
          viajes={viajesFiltrados || []}
          filterLabel={viajesFilterLabel}
        />
      )}

      {selectedTrip && (
        <EditTripModal
          isOpen={showEditTrip}
          onClose={() => {
            setShowEditTrip(false);
            setSelectedTrip(null);
          }}
          viaje={selectedTrip}
        />
      )}

      <RegisterCargueModal
        open={showRegisterCargue}
        onClose={() => setShowRegisterCargue(false)}
      />

      <RegisterDescargueModal
        open={showRegisterDescargue}
        onClose={() => setShowRegisterDescargue(false)}
      />

      {/* Navegación inferior */}
      <BottomNavigation />
    </div>
  );
}