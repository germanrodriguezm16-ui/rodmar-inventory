import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, X, Pencil, Trash2 } from "lucide-react";
import { formatDateForInputBogota, formatDateSimple } from "@/lib/date-utils";
import DateFilterDropdown from "@/components/ui/date-filter-dropdown-new";
import type { TransaccionWithSocio } from "@shared/schema";

interface TransaccionesProps {
  onOpenTransaction: () => void;
  onEditTransaction?: (transaccion: TransaccionWithSocio) => void;
  onDeleteTransaction?: (transaccion: TransaccionWithSocio) => void;
}

export default function Transacciones({ onOpenTransaction, onEditTransaction, onDeleteTransaction }: TransaccionesProps) {
  console.log('🎯 COMPONENTE TRANSACCIONES - Iniciando render', { onOpenTransaction, onEditTransaction, onDeleteTransaction });
  const [filters, setFilters] = useState({
    searchSocio: "",
    searchValor: "",
    tipoSocio: "",
    concepto: "",
    formaPago: "",
    dateFilter: "",
    dateRange: null as { start: Date; end: Date } | null,
    sortOrder: "desc" as "asc" | "desc"
  });

  const { data: rawTransacciones = [], isLoading } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Procesar transacciones para asegurar que las fechas sean strings
  const transacciones = rawTransacciones.map(transaccion => ({
    ...transaccion,
    fecha: typeof transaccion.fecha === 'string' ? transaccion.fecha : 
           transaccion.fecha instanceof Date ? formatDateForInputBogota(transaccion.fecha) : 
           String(transaccion.fecha)
  }));

  // Función helper para verificar si una fecha está en el rango
  const isDateInRange = (date: Date, range: { start: Date; end: Date }) => {
    const dateTime = date.getTime();
    const startTime = range.start.getTime();
    const endTime = range.end.getTime();
    return dateTime >= startTime && dateTime <= endTime;
  };

  // Funciones para manejar filtros de fecha
  const handleDateFilter = (filterType: string, startDate?: Date, endDate?: Date, sortOrder?: string) => {
    setFilters(prev => ({
      ...prev,
      dateFilter: filterType,
      dateRange: startDate && endDate ? { start: startDate, end: endDate } : null,
      sortOrder: sortOrder as "desc" | "asc" || prev.sortOrder
    }));
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      searchSocio: "",
      searchValor: "",
      tipoSocio: "",
      concepto: "",
      formaPago: "",
      dateFilter: "",
      dateRange: null,
      sortOrder: "desc"
    });
  };

  // Aplicar filtros y ordenamiento
  const filteredAndSortedTransacciones = (() => {
    console.log('🏦 TRANSACCIONES - Total recibidas:', transacciones.length);
    let filtered = transacciones.filter((transaccion: TransaccionWithSocio) => {
      // Excluir transacciones de banco del historial general
      if (transaccion.deQuienTipo === 'banco' || transaccion.paraQuienTipo === 'banco') {
        console.log('❌ BANCO EXCLUIDA - ID:', transaccion.id, 'deQuien:', transaccion.deQuienTipo, 'paraQuien:', transaccion.paraQuienTipo);
        return false;
      }

      // Búsqueda por socio (mina, comprador, volquetero)
      if (filters.searchSocio) {
        const search = filters.searchSocio.toLowerCase();
        if (!transaccion.socioNombre.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Búsqueda por valor
      if (filters.searchValor) {
        const valorBusqueda = filters.searchValor.replace(/[^\d]/g, ''); // Solo números
        const valorTransaccion = transaccion.valor.replace(/[^\d]/g, '');
        if (!valorTransaccion.includes(valorBusqueda)) {
          return false;
        }
      }

      // Filtro por tipo de socio
      if (filters.tipoSocio && filters.tipoSocio !== "all" && transaccion.tipoSocio !== filters.tipoSocio) {
        return false;
      }

      // Filtro por concepto
      if (filters.concepto && !transaccion.concepto.toLowerCase().includes(filters.concepto.toLowerCase())) {
        return false;
      }

      // Filtro por forma de pago
      if (filters.formaPago && filters.formaPago !== "all" && transaccion.formaPago !== filters.formaPago) {
        return false;
      }

      // Filtro por fecha usando comparación de strings para evitar problemas UTC
      if (filters.dateFilter && filters.dateRange) {
        const transaccionDate = new Date(transaccion.fecha);
        if (!isDateInRange(transaccionDate, filters.dateRange)) {
          return false;
        }
      } else if (filters.dateFilter) {
        // Extraer solo la parte de fecha como string (YYYY-MM-DD)
        const transactionDate = new Date(transaccion.fecha);
        const transactionDateString = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}-${String(transactionDate.getDate()).padStart(2, '0')}`;
        
        const now = new Date();
        const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (filters.dateFilter) {
          case "hoy":
            if (transactionDateString !== todayString) return false;
            break;
          case "ayer":
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            if (transactionDateString !== yesterdayString) return false;
            break;
          case "esta_semana":
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const startWeekString = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
            if (transactionDateString < startWeekString || transactionDateString > todayString) return false;
            break;
          case "este_mes":
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startMonthString = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
            if (transactionDateString < startMonthString || transactionDateString > todayString) return false;
            break;
          case "este_año":
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const startYearString = `${startOfYear.getFullYear()}-${String(startOfYear.getMonth() + 1).padStart(2, '0')}-${String(startOfYear.getDate()).padStart(2, '0')}`;
            if (transactionDateString < startYearString || transactionDateString > todayString) return false;
            break;
        }
      }

      return true;
    });

    // Ordenamiento por fecha
    filtered = filtered.sort((a: TransaccionWithSocio, b: TransaccionWithSocio) => {
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return filters.sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    console.log('✅ TRANSACCIONES - Después de filtros:', filtered.length);
    return filtered;
  })();

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getTipoSocioLabel = (tipo: string | null) => {
    if (!tipo) return "Desconocido";
    const labels = {
      mina: "Mina",
      comprador: "Comprador",
      volquetero: "Volquetero"
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  // Contar filtros activos
  const activeFiltersCount = [
    filters.searchSocio,
    filters.searchValor,
    filters.tipoSocio && filters.tipoSocio !== "all",
    filters.concepto,
    filters.formaPago && filters.formaPago !== "all",
    filters.dateFilter
  ].filter(Boolean).length;

  // Calcular resumen financiero de transacciones filtradas
  const financialSummary = (() => {
    let positivos = 0;
    let negativos = 0;
    
    filteredAndSortedTransacciones.forEach((transaccion: TransaccionWithSocio) => {
      const valor = parseFloat(transaccion.valor);
      
      // Determinar si es positivo o negativo según el concepto
      if (["Pago", "Adelanto", "Préstamo"].includes(transaccion.concepto) || 
          transaccion.deQuienTipo === 'rodmar') {
        negativos += valor;
      } else {
        positivos += valor;
      }
    });
    
    return {
      positivos,
      negativos,
      balance: positivos - negativos
    };
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando transacciones...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header compacto con filtros móviles */}
      <div className="px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-foreground">
            Transacciones ({filteredAndSortedTransacciones.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="mr-1 h-4 px-1 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Resumen financiero compacto */}
        {filteredAndSortedTransacciones.length > 0 && (
          <div className="flex items-center justify-between text-xs mb-2 px-2 py-1 bg-muted/30 rounded">
            <div className="flex items-center gap-3">
              <span className="text-green-600 font-medium">
                +{formatCurrency(financialSummary.positivos.toString())}
              </span>
              <span className="text-red-600 font-medium">
                -{formatCurrency(financialSummary.negativos.toString())}
              </span>
            </div>
            <div className={`font-medium ${
              financialSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(financialSummary.balance.toString())}
            </div>
          </div>
        )}
        
        {/* Filtros en diseño ultra-compacto */}
        <div className="space-y-2">
          {/* Primera fila: Selectores */}
          <div className="grid grid-cols-2 gap-2">
            <Select 
              value={filters.tipoSocio} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, tipoSocio: value }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mina">Mina</SelectItem>
                <SelectItem value="comprador">Comprador</SelectItem>
                <SelectItem value="volquetero">Volquetero</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.formaPago} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, formaPago: value }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Segunda fila: Búsquedas */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Buscar socio..."
              value={filters.searchSocio}
              onChange={(e) => setFilters(prev => ({ ...prev, searchSocio: e.target.value }))}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Buscar valor..."
              value={filters.searchValor}
              onChange={(e) => setFilters(prev => ({ ...prev, searchValor: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>

          {/* Tercera fila: Fecha */}
          <div className="flex gap-2">
            <div className="flex-1">
              <DateFilterDropdown
                buttonText={`Fecha ${filters.sortOrder === "desc" ? "↓" : "↑"}`}
                onApplyFilter={handleDateFilter}
                currentFilter={filters.dateFilter}
                currentSort={filters.sortOrder}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de transacciones optimizada para móvil */}
      <div className="px-2 py-2">
        {filteredAndSortedTransacciones.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              {transacciones.length === 0 ? "No hay transacciones registradas" : "No se encontraron transacciones"}
            </p>
            <p className="text-xs mt-1">
              Total: {transacciones.length} | Filtradas: {filteredAndSortedTransacciones.length}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedTransacciones.map((transaccion: TransaccionWithSocio) => (
              <Card key={transaccion.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Header compacto */}
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs px-1 py-0 h-5 shrink-0">
                          {getTipoSocioLabel(transaccion.tipoSocio)}
                        </Badge>
                        <span className="text-sm font-medium text-foreground truncate">
                          {transaccion.socioNombre}
                        </span>
                      </div>
                      
                      {/* Concepto */}
                      <p className="text-sm text-muted-foreground mb-1 line-clamp-1">
                        {transaccion.concepto}
                      </p>
                      
                      {/* Información inferior compacta */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{(() => {
                          console.log('🗓️ TARJETA TRANSACCION - Formateando fecha:', {
                            transaccionId: transaccion.id,
                            fecha: transaccion.fecha,
                            tipo: typeof transaccion.fecha
                          });
                          return formatDateSimple(transaccion.fecha);
                        })()}</span>
                        <span>•</span>
                        <span className="truncate">{transaccion.formaPago}</span>
                        {transaccion.voucher && (
                          <>
                            <span>•</span>
                            <span className="truncate">#{transaccion.voucher}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Valor y Acciones */}
                    <div className="flex flex-col items-end ml-3 shrink-0 gap-1">
                      <div className={`text-base font-semibold ${
                        ["Pago", "Adelanto", "Préstamo"].includes(transaccion.concepto) 
                          ? "text-red-600" 
                          : "text-green-600"
                      }`}>
                        {formatCurrency(transaccion.valor)}
                      </div>
                      
                      {/* Botones de acciones */}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onEditTransaction?.(transaccion)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={() => onDeleteTransaction?.(transaccion)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Comentario si existe */}
                  {transaccion.comentario && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-2 line-clamp-2">
                      {transaccion.comentario}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
  
  console.log('🏁 COMPONENTE TRANSACCIONES - Finalizando render');
}