import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, X, Filter, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import DateFilterDropdown from "@/components/ui/date-filter-dropdown-new";
import type { TransaccionWithSocio } from "@shared/schema";

interface TransaccionesProps {
  onOpenTransaction: () => void;
}

export default function Transacciones({ onOpenTransaction }: TransaccionesProps) {
  const [filters, setFilters] = useState({
    searchSocio: "",
    searchValor: "",
    tipoSocio: "",
    formaPago: "",
    dateFilter: "",
    dateRange: null as { start: Date; end: Date } | null,
    sortOrder: "desc" as "asc" | "desc"
  });

  const { data: transacciones = [], isLoading } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const clearFilters = () => {
    setFilters({
      searchSocio: "",
      searchValor: "",
      tipoSocio: "",
      formaPago: "",
      dateFilter: "",
      dateRange: null,
      sortOrder: "desc"
    });
  };

  const handleDateSort = (order: "asc" | "desc") => {
    setFilters(prev => ({ ...prev, sortOrder: order }));
  };

  const handleDateFilterPreset = (preset: string) => {
    setFilters(prev => ({ ...prev, dateFilter: preset }));
  };

  // Filtrado y ordenamiento de transacciones
  const filteredAndSortedTransacciones = (() => {
    let filtered = transacciones.filter((transaccion: TransaccionWithSocio) => {
      // Filtro por búsqueda de socio
      if (filters.searchSocio && !transaccion.socioNombre.toLowerCase().includes(filters.searchSocio.toLowerCase())) {
        return false;
      }

      // Filtro por valor
      if (filters.searchValor && !transaccion.valor.includes(filters.searchValor)) {
        return false;
      }

      // Filtro por tipo de socio
      if (filters.tipoSocio && filters.tipoSocio !== "all" && transaccion.tipoSocio !== filters.tipoSocio) {
        return false;
      }

      // Filtro por forma de pago
      if (filters.formaPago && filters.formaPago !== "all" && transaccion.formaPago !== filters.formaPago) {
        return false;
      }

      // Filtros de fecha
      if (filters.dateFilter && filters.dateFilter !== "all") {
        const transactionDate = new Date(transaccion.fecha);
        const today = new Date();
        
        switch (filters.dateFilter) {
          case "hoy":
            if (transactionDate.toDateString() !== today.toDateString()) return false;
            break;
          case "ayer":
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (transactionDate.toDateString() !== yesterday.toDateString()) return false;
            break;
          case "esta_semana":
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            if (transactionDate < startOfWeek) return false;
            break;
          case "este_mes":
            if (transactionDate.getMonth() !== today.getMonth() || 
                transactionDate.getFullYear() !== today.getFullYear()) return false;
            break;
          case "este_año":
            if (transactionDate.getFullYear() !== today.getFullYear()) return false;
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

  const getTipoSocioLabel = (tipo: string) => {
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
    filters.formaPago && filters.formaPago !== "all",
    filters.dateFilter && filters.dateFilter !== "all"
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Cargando transacciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      {/* Filters Section */}
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-foreground flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros Avanzados
          </h2>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpiar
          </Button>
        </div>
        
        <div className="space-y-3">
          {/* Tipo de Socio y Forma de Pago */}
          <div className="grid grid-cols-2 gap-3">
            <Select 
              value={filters.tipoSocio} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, tipoSocio: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Socio" />
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
              <SelectTrigger>
                <SelectValue placeholder="Forma de Pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Búsqueda */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Buscar por socio..."
              value={filters.searchSocio}
              onChange={(e) => setFilters(prev => ({ ...prev, searchSocio: e.target.value }))}
            />
            <Input
              placeholder="Buscar por valor..."
              value={filters.searchValor}
              onChange={(e) => setFilters(prev => ({ ...prev, searchValor: e.target.value }))}
            />
          </div>

          {/* Filtros de Fecha */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros por Fecha</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={filters.dateFilter === "hoy" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateFilterPreset("hoy")}
              >
                Hoy
              </Button>
              <Button
                variant={filters.dateFilter === "ayer" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateFilterPreset("ayer")}
              >
                Ayer
              </Button>
              <Button
                variant={filters.dateFilter === "esta_semana" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateFilterPreset("esta_semana")}
              >
                Esta semana
              </Button>
              <Button
                variant={filters.dateFilter === "este_mes" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateFilterPreset("este_mes")}
              >
                Este mes
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={filters.sortOrder === "desc" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateSort("desc")}
                className="flex-1"
              >
                Más recientes ↓
              </Button>
              <Button
                variant={filters.sortOrder === "asc" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDateSort("asc")}
                className="flex-1"
              >
                Más antiguos ↑
              </Button>
            </div>
          </div>

          {/* Botón para limpiar filtros activos */}
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
              <X className="h-4 w-4 mr-1" />
              Limpiar Filtros ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-foreground">
            Transacciones ({filteredAndSortedTransacciones.length})
          </h2>
          <Button variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {filteredAndSortedTransacciones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {transacciones.length === 0 ? "No hay transacciones registradas" : "No se encontraron transacciones con los filtros aplicados"}
            <br />
            <small className="text-xs">Total transacciones: {transacciones.length}, Filtradas: {filteredAndSortedTransacciones.length}</small>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedTransacciones.map((transaccion: TransaccionWithSocio) => (
              <Card key={transaccion.id} className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {getTipoSocioLabel(transaccion.tipoSocio)}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {transaccion.socioNombre}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {transaccion.concepto}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(transaccion.fecha), 'dd/MM/yyyy', { locale: es })}</span>
                        <span>•</span>
                        <span>{transaccion.formaPago}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        transaccion.concepto === "Pago" || transaccion.concepto === "Adelanto" || transaccion.concepto === "Préstamo"
                          ? "text-red-600" 
                          : "text-green-600"
                      }`}>
                        {formatCurrency(transaccion.valor)}
                      </p>
                    </div>
                  </div>
                  {transaccion.comentario && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
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
}