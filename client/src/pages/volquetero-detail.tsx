import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Truck, Eye, EyeOff, Plus, Edit, Trash2, Search, CalendarDays, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import TripCard from "@/components/trip-card";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { formatCurrency } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import NewTransactionModal from "@/components/forms/new-transaction-modal";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { TransactionDetailModal } from "@/components/modals/transaction-detail-modal";
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
    date = dateInput;
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
  
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [showTemporalTransaction, setShowTemporalTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  
  // Estado para transacciones temporales (solo en memoria)
  const [transaccionesTemporales, setTransaccionesTemporales] = useState<TransaccionWithSocio[]>([]);
  
  // Estado para rastrear pestaña activa y ejecutar limpieza al cambiar
  const [activeTab, setActiveTab] = useState<string>("viajes");
  
  // Estados de filtros de fecha para transacciones
  const [transaccionesFechaFilterType, setTransaccionesFechaFilterType] = useState<DateFilterType>("todos");
  const [transaccionesFechaFilterValue, setTransaccionesFechaFilterValue] = useState("");
  const [transaccionesFechaFilterValueEnd, setTransaccionesFechaFilterValueEnd] = useState("");
  
  // Estado para filtrar entre todas y ocultas
  const [filterType, setFilterType] = useState<"todas" | "ocultas">("todas");
  
  // Estado para búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  
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

  const { data: transaccionesData = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"],
    queryFn: () => fetch(apiUrl(`/api/volqueteros/${volqueteroIdActual}/transacciones`)).then(res => res.json()),
    enabled: volqueteroIdActual > 0,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Obtener TODAS las transacciones del volquetero (incluyendo ocultas) para contar ocultas
  const { data: todasTransaccionesIncOcultas = [] } = useQuery({
    queryKey: ["/api/transacciones/socio/volquetero", volqueteroIdActual, "all"],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/transacciones/socio/volquetero/${volqueteroIdActual}?includeHidden=true`));
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    enabled: volqueteroIdActual > 0,
    staleTime: 300000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  
  // Obtener solo los viajes de este volquetero específico (optimización)
  const { data: viajesVolquetero = [] } = useQuery({
    queryKey: ["/api/volqueteros", volqueteroIdActual, "viajes"],
    queryFn: () => fetch(apiUrl(`/api/volqueteros/${volqueteroIdActual}/viajes`)).then(res => res.json()),
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
          fecha: new Date(t.fecha || t.createdAt || Date.now()),
          formaPago: t.formaPago || "",
          voucher: t.voucher || null,
          comentario: t.comentario || null,
          deQuienTipo: t.deQuienTipo || "",
          deQuienId: t.deQuienId || "",
          paraQuienTipo: t.paraQuienTipo || "",
          paraQuienId: t.paraQuienId || "",
          tipo: "Manual" as const,
          esViajeCompleto: false,
          oculta: t.ocultaEnVolquetero || false,
          originalTransaction: t // Guardar referencia al objeto original
        };
        
        return formatted;
      });

    // Transacciones dinámicas de viajes completados
    // Usar viajesVolquetero que ya viene filtrado del backend
    const viajesCompletados = (viajesVolquetero as ViajeWithDetails[])
      .map(v => {
        const fechaViaje = v.fechaDescargue!;
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
        fecha: t.fecha ? (t.fecha instanceof Date ? t.fecha : new Date(t.fecha)) : new Date(),
        formaPago: t.formaPago || "",
        voucher: t.voucher || null,
        comentario: t.comentario || null,
        deQuienTipo: t.deQuienTipo || "",
        deQuienId: t.deQuienId || "",
        paraQuienTipo: t.paraQuienTipo || "",
        paraQuienId: t.paraQuienId || "",
        tipo: "Temporal" as const,
        esViajeCompleto: false,
        oculta: false
      };
    });
    
    const resultado = [...transaccionesManuales, ...viajesCompletados, ...transaccionesTemporalesConTipo]
      .sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        return fechaB.getTime() - fechaA.getTime();
      });
    
    return resultado;
  }, [transaccionesData, viajesVolquetero, volquetero, volqueteroIdActual, transaccionesTemporales]);

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
      const fechaTransaccion = t.fecha instanceof Date ? t.fecha : new Date(t.fecha);
      const fechaStr = fechaTransaccion.getFullYear() + '-' + 
        String(fechaTransaccion.getMonth() + 1).padStart(2, '0') + '-' + 
        String(fechaTransaccion.getDate()).padStart(2, '0');
      
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

  // Mutación para ocultar transacciones individuales
  const hideTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      const response = await fetch(apiUrl(`/api/transacciones/${transactionId}/hide-volquetero`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error al ocultar transacción');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/socio/volquetero", volqueteroIdActual, "all"] });
      toast({
        title: "Transacción ocultada",
        description: "La transacción se ha ocultado correctamente"
      });
    },
    onError: (error) => {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo ocultar la transacción",
        variant: "destructive"
      });
    }
  });

  // Mutación para ocultar viajes individuales
  const hideViajeMutation = useMutation({
    mutationFn: async (viajeId: string) => {
      const response = await fetch(apiUrl(`/api/viajes/${viajeId}/hide`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error al ocultar viaje');
      return await response.json();
    },
    onSuccess: () => {
      // Invalidar solo las queries necesarias
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros", volqueteroIdActual, "viajes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/socio/volquetero", volqueteroIdActual, "all"] });
      
      toast({
        title: "Viaje ocultado",
        description: "El viaje se ha ocultado de las transacciones"
      });
    },
    onError: (error) => {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudo ocultar el viaje",
        variant: "destructive"
      });
    }
  });

  const showAllHiddenMutation = useMutation({
    mutationFn: async () => {
      const { apiUrl } = await import('@/lib/api');
      
      if (!volquetero || !volqueteroIdActual) {
        throw new Error('Volquetero no encontrado');
      }
      
      // Mostrar transacciones ocultas específicas de este volquetero
      const transaccionesResponse = await fetch(apiUrl(`/api/transacciones/socio/volquetero/${volqueteroIdActual}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Mostrar viajes ocultos específicos de este volquetero (por nombre del conductor)
      const viajesResponse = await fetch(apiUrl(`/api/viajes/volquetero/${encodeURIComponent(volquetero.nombre)}/show-all`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!transaccionesResponse.ok && !viajesResponse.ok) {
        throw new Error('Error al mostrar transacciones y viajes');
      }
      
      const transaccionesResult = transaccionesResponse.ok ? await transaccionesResponse.json() : { updatedCount: 0 };
      const viajesResult = viajesResponse.ok ? await viajesResponse.json() : { updatedCount: 0 };
      
      return {
        transacciones: transaccionesResult.updatedCount || 0,
        viajes: viajesResult.updatedCount || 0,
        total: (transaccionesResult.updatedCount || 0) + (viajesResult.updatedCount || 0)
      };
    },
    onSuccess: (result) => {
      // Invalidar solo las queries necesarias (similar a minas)
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros", volqueteroIdActual, "transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transacciones/socio/volquetero", volqueteroIdActual, "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volqueteros", volqueteroIdActual, "viajes"] });
      
      const mensaje = result.total > 0 
        ? `${result.transacciones} transacciones y ${result.viajes} viajes restaurados`
        : "No había elementos ocultos para restaurar";
        
      toast({
        title: "Elementos restaurados",
        description: mensaje
      });
    },
    onError: (error) => {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron restaurar los elementos ocultos",
        variant: "destructive"
      });
    }
  });

  // Aplicar filtros a transacciones
  const transaccionesFiltradas = useMemo(() => {
    let filtered = filterType === "todas" ? 
      transaccionesFormateadas.filter(t => !t.oculta) : 
      transaccionesFormateadas.filter(t => t.oculta);
    
    // Luego filtrar por fecha
    filtered = filterTransaccionesByDate(
      filtered,
      transaccionesFechaFilterType,
      transaccionesFechaFilterValue,
      transaccionesFechaFilterValueEnd
    );
    
    // Aplicar filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.concepto?.toLowerCase().includes(searchLower) ||
        t.comentario?.toLowerCase().includes(searchLower) ||
        t.valor?.toString().includes(searchLower)
      );
    }
    
    return filtered;
  }, [transaccionesFormateadas, filterType, transaccionesFechaFilterType, transaccionesFechaFilterValue, transaccionesFechaFilterValueEnd, searchTerm, filterTransaccionesByDate]);
  
  // Calcular balance resumido correctamente
  const balanceResumido = useMemo(() => {
    const transaccionesVisibles = transaccionesFiltradas.filter(t => !t.oculta);
    
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

  // Filtrar viajes del volquetero específico
  const viajesVolquetero = (viajes as ViajeWithDetails[]).filter((viaje) => {
    return viaje.conductor === volquetero.nombre;
  });

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
            <div>
              <h1 className="text-xl font-bold text-foreground">{volquetero.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                {volquetero.placas.length} vehículo{volquetero.placas.length !== 1 ? 's' : ''} • {volquetero.viajesCount || 0} viajes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="viajes" className="text-xs">
              Viajes ({viajesVolquetero.length})
            </TabsTrigger>
            <TabsTrigger value="transacciones" className="text-xs">
              Transacciones ({transaccionesFormateadas.filter(t => !t.oculta).length})
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-xs">
              Balance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="viajes" className="space-y-4">
            {viajesVolquetero.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay viajes registrados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {viajesVolquetero.map((viaje) => (
                  <TripCard 
                    key={viaje.id} 
                    viaje={viaje as any}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transacciones" className="space-y-4">
            {transaccionesFormateadas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No hay transacciones registradas</p>
                </CardContent>
              </Card>
            ) : transaccionesFiltradas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    {filterType === "ocultas" 
                      ? "No hay transacciones ocultas" 
                      : "No hay transacciones que coincidan con los filtros"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Card de filtros */}
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
                          className="h-8 px-2 text-xs"
                        >
                          + Temporal
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
                          const transaccionesOcultas = Array.isArray(todasTransaccionesIncOcultas) 
                            ? todasTransaccionesIncOcultas.filter((t: any) => t.ocultaEnVolquetero).length 
                            : 0;
                          const viajesOcultos = Array.isArray(viajes) 
                            ? viajes.filter((v: any) => v.oculta).length 
                            : 0;
                          const totalOcultos = transaccionesOcultas + viajesOcultos;
                          const hayElementosOcultos = totalOcultos > 0;
                          
                          return hayElementosOcultos ? (
                            <Button
                              onClick={() => showAllHiddenMutation.mutate()}
                              size="sm"
                              className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs"
                              disabled={showAllHiddenMutation.isPending}
                              title={`Mostrar ${totalOcultos} elemento(s) oculto(s)`}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              {totalOcultos}
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

                {/* Balance dinámico basado en transacciones filtradas y visibles */}
                <Card className="border-gray-200 bg-gray-50">
                  <CardContent className="p-1.5 sm:p-2">
                    <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center">
                      <div className="bg-green-50 rounded px-2 py-1">
                        <div className="text-green-600 text-xs font-medium">Positivos</div>
                        <div className="text-green-700 text-xs sm:text-sm font-semibold">
                          +{transaccionesFiltradas.filter(t => !t.oculta && parseFloat(t.valor) > 0).length} {formatCurrency(balanceResumido.positivos)}
                        </div>
                      </div>
                      <div className="bg-red-50 rounded px-2 py-1">
                        <div className="text-red-600 text-xs font-medium">Negativos</div>
                        <div className="text-red-700 text-xs sm:text-sm font-semibold">
                          -{transaccionesFiltradas.filter(t => !t.oculta && parseFloat(t.valor) < 0).length} {formatCurrency(balanceResumido.negativos)}
                        </div>
                      </div>
                      <div className={`rounded px-2 py-1 ${balanceResumido.balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                        <div className={`text-xs font-medium ${balanceResumido.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balance</div>
                        <div className={`text-xs sm:text-sm font-bold ${balanceResumido.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {balanceResumido.balance >= 0 ? '+' : ''}{formatCurrency(Math.abs(balanceResumido.balance))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                              className={`cursor-pointer hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                              onClick={() => {
                                if (transaccion.tipo === "Manual" && transaccion.originalTransaction) {
                                  setSelectedTransaction(transaccion.originalTransaction);
                                  setShowTransactionDetail(true);
                                } else if (transaccion.tipo === "Temporal") {
                                  // Las transacciones temporales no tienen detalle, solo se pueden eliminar
                                }
                              }}
                            >
                              <TableCell className="p-3 text-sm">
                                {(() => {
                                  const fecha = transaccion.fecha;
                                  if (fecha instanceof Date) {
                                    const day = String(fecha.getDate()).padStart(2, '0');
                                    const month = String(fecha.getMonth() + 1).padStart(2, '0');
                                    const year = String(fecha.getFullYear()).slice(-2);
                                    const dayOfWeek = getDayOfWeek(fecha);
                                    return `${dayOfWeek}. ${day}/${month}/${year}`;
                                  }
                                  return 'Fecha inválida';
                                })()}
                              </TableCell>
                              <TableCell className="p-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <span>{transaccion.concepto}</span>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs px-1.5 py-0.5"
                                  >
                                    {transaccion.tipo === "Manual" ? "M" : transaccion.tipo === "Temporal" ? "T" : "V"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className={`p-3 text-sm text-right font-medium ${
                                transaccion.tipo === "Viaje" 
                                  ? 'text-green-600 dark:text-green-400'
                                  : valor >= 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                              }`}>
                                {transaccion.tipo === "Viaje" 
                                  ? `+${formatCurrency(Math.abs(valor))}`
                                  : valor >= 0 
                                    ? `+${formatCurrency(valor)}`
                                    : `-${formatCurrency(Math.abs(valor))}`
                                }
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
                                          setEditingTransaction(transaccion.originalTransaction);
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
                                          setDeletingTransaction(transaccion.originalTransaction);
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
                                          hideTransactionMutation.mutate(transaccion.originalTransaction.id);
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-gray-100"
                                        disabled={hideTransactionMutation.isPending}
                                        title="Ocultar transacción"
                                      >
                                        <Eye className="h-3 w-3 text-gray-500" />
                                      </Button>
                                    </>
                                  ) : transaccion.tipo === "Viaje" && transaccion.viajeId ? (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        hideViajeMutation.mutate(transaccion.viajeId!);
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-gray-100"
                                      disabled={hideViajeMutation.isPending}
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
                        className={`border border-gray-200 transition-colors ${
                          transaccion.tipo === "Manual" || transaccion.tipo === "Temporal"
                            ? "cursor-pointer hover:bg-gray-50" 
                            : "cursor-default"
                        }`}
                        onClick={() => {
                          if (transaccion.tipo === "Manual" && transaccion.originalTransaction) {
                            setSelectedTransaction(transaccion.originalTransaction);
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
                          if (fecha instanceof Date) {
                                      const day = String(fecha.getDate()).padStart(2, '0');
                            const month = String(fecha.getMonth() + 1).padStart(2, '0');
                                      const year = String(fecha.getFullYear()).slice(-2);
                                      const dayOfWeek = getDayOfWeek(fecha);
                                      return `${dayOfWeek}. ${day}/${month}/${year}`;
                          }
                          return "Sin fecha";
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
                                {transaccion.concepto}
                              </div>
                              {/* Comentario compacto si existe */}
                              {transaccion.comentario && transaccion.comentario.trim() && (
                                <div className="text-xs text-gray-500 mt-0.5 leading-tight">
                                  {transaccion.comentario.length > 50 ? 
                                    `${transaccion.comentario.substring(0, 50)}...` : 
                                    transaccion.comentario
                                  }
                                </div>
                              )}
                      </div>

                            {/* Lado derecho: Valor y acción */}
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className={`font-medium text-xs sm:text-sm text-right min-w-0 ${
                                transaccion.tipo === "Viaje" 
                                  ? 'text-green-600'
                                  : valor >= 0 
                                    ? 'text-green-600' 
                                    : 'text-red-600'
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
                                      setEditingTransaction(transaccion.originalTransaction);
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
                                      setDeletingTransaction(transaccion.originalTransaction);
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
                                      hideTransactionMutation.mutate(transaccion.originalTransaction.id);
                                    }}
                                    disabled={hideTransactionMutation.isPending}
                                    title="Ocultar transacción"
                                  >
                                    <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
                                  </Button>
                                </div>
                              ) : transaccion.tipo === "Viaje" && transaccion.viajeId ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-gray-100 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    hideViajeMutation.mutate(transaccion.viajeId!);
                                  }}
                                  disabled={hideViajeMutation.isPending}
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
                        .filter(t => t.tipo === "Viaje" && !t.oculta)
                        .reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transaccionesFormateadas.filter(t => t.tipo === "Viaje" && !t.oculta).length} viajes donde RodMar paga el flete
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
                            .filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && !t.oculta && parseFloat(t.valor) > 0)
                            .reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0)
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaccionesFormateadas.filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && !t.oculta && parseFloat(t.valor) > 0).length} transacciones
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Egresos</p>
                        <p className="text-sm font-semibold text-red-600">
                          {formatCurrency(Math.abs(transaccionesFormateadas
                            .filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && !t.oculta && parseFloat(t.valor) < 0)
                            .reduce((sum, t) => sum + parseFloat(t.valor || "0"), 0)
                          ))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaccionesFormateadas.filter(t => (t.tipo === "Manual" || t.tipo === "Temporal") && !t.oculta && parseFloat(t.valor) < 0).length} transacciones
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
        </Tabs>
      </div>



      {/* Botón flotante para nueva transacción */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg z-50"
        onClick={() => setShowNewTransactionModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

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
          if (!open) setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
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

      {/* Navegación inferior */}
      <BottomNavigation />
    </div>
  );
}