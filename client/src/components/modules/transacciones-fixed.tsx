import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, X, Filter, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import DateFilterDropdown from "@/components/ui/date-filter-dropdown-new";
import EditTransactionModal from "@/components/forms/edit-transaction-modal";
import DeleteTransactionModal from "@/components/forms/delete-transaction-modal";
import { formatCurrency } from "@/lib/calculations";
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

  const [editingTransaction, setEditingTransaction] = useState<TransaccionWithSocio | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransaccionWithSocio | null>(null);

  const { data: transacciones = [], isLoading } = useQuery<TransaccionWithSocio[]>({
    queryKey: ["/api/transacciones"],
    staleTime: 0, // Siempre datos frescos para reflejar cambios de nombres
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: false, // No refetch automático para evitar overhead
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

      return true;
    });

    // Aplicar filtros de fecha usando comparación de strings para evitar problemas UTC
    if (filters.dateFilter || filters.dateRange) {
      if (filters.dateFilter) {
        const now = new Date();
        const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (filters.dateFilter) {
          case "hoy":
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString === todayString;
            });
            break;
          case "ayer":
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString === yesterdayString;
            });
            break;
          case "esta-semana":
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const startWeekString = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString >= startWeekString && dateString <= todayString;
            });
            break;
          case "semana-pasada":
            const startOfLastWeek = new Date(today);
            startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
            const startLastWeekString = `${startOfLastWeek.getFullYear()}-${String(startOfLastWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfLastWeek.getDate()).padStart(2, '0')}`;
            const endLastWeekString = `${endOfLastWeek.getFullYear()}-${String(endOfLastWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfLastWeek.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString >= startLastWeekString && dateString <= endLastWeekString;
            });
            break;
          case "este-mes":
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startMonthString = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString >= startMonthString && dateString <= todayString;
            });
            break;
          case "mes-pasado":
            const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            const startLastMonthString = `${startOfLastMonth.getFullYear()}-${String(startOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfLastMonth.getDate()).padStart(2, '0')}`;
            const endLastMonthString = `${endOfLastMonth.getFullYear()}-${String(endOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfLastMonth.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString >= startLastMonthString && dateString <= endLastMonthString;
            });
            break;
          case "este-ano":
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const startYearString = `${startOfYear.getFullYear()}-${String(startOfYear.getMonth() + 1).padStart(2, '0')}-${String(startOfYear.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString >= startYearString && dateString <= todayString;
            });
            break;
          case "ano-pasado":
            const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
            const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
            const startLastYearString = `${startOfLastYear.getFullYear()}-${String(startOfLastYear.getMonth() + 1).padStart(2, '0')}-${String(startOfLastYear.getDate()).padStart(2, '0')}`;
            const endLastYearString = `${endOfLastYear.getFullYear()}-${String(endOfLastYear.getMonth() + 1).padStart(2, '0')}-${String(endOfLastYear.getDate()).padStart(2, '0')}`;
            filtered = filtered.filter(t => {
              const fecha = new Date(t.fecha);
              const dateString = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
              return dateString >= startLastYearString && dateString <= endLastYearString;
            });
            break;
        }
      }
      
      if (filters.dateRange) {
        filtered = filtered.filter(t => 
          t.fecha >= filters.dateRange!.start && t.fecha <= filters.dateRange!.end
        );
      }
    }

    // Ordenamiento por fecha
    filtered = filtered.sort((a: TransaccionWithSocio, b: TransaccionWithSocio) => {
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return filters.sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Cargando transacciones...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transacciones</h2>
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedTransacciones.length} de {transacciones.length} transacciones
          </p>
        </div>
        <Button onClick={onOpenTransaction} size="sm">
          Nueva Transacción
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          </div>

          {/* Filtros por tipo y forma de pago */}
          <div className="grid grid-cols-2 gap-3">
            <Select value={filters.tipoSocio} onValueChange={(value) => setFilters(prev => ({ ...prev, tipoSocio: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de socio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="mina">Minas</SelectItem>
                <SelectItem value="comprador">Compradores</SelectItem>
                <SelectItem value="volquetero">Volqueteros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.formaPago} onValueChange={(value) => setFilters(prev => ({ ...prev, formaPago: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Forma de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las formas</SelectItem>
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

          {/* Filtro de fecha con dropdown */}
          <div className="mb-4">
            <DateFilterDropdown
              buttonText="Filtrar por Fecha"
              onApplyFilter={(filterType, startDate, endDate, sortOrder) => {
                setFilters(prev => ({
                  ...prev,
                  dateFilter: filterType === "all" ? "" : filterType,
                  dateRange: startDate && endDate ? { start: startDate, end: endDate } : null,
                  sortOrder: (sortOrder as "asc" | "desc") || "desc"
                }));
              }}
              currentFilter={filters.dateFilter}
              currentSort={filters.sortOrder}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de transacciones */}
      <div className="space-y-3">
        {filteredAndSortedTransacciones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No se encontraron transacciones con los filtros aplicados</p>
          </div>
        ) : (
          filteredAndSortedTransacciones.map((transaccion: TransaccionWithSocio) => (
            <Card key={transaccion.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {transaccion.tipoSocio === "mina" ? "Mina" : 
                         transaccion.tipoSocio === "comprador" ? "Comprador" : "Volquetero"}
                      </Badge>
                      <Badge variant="secondary">
                        {transaccion.formaPago}
                      </Badge>
                    </div>
                    
                    <h4 className="font-medium">{transaccion.socioNombre}</h4>
                    <p className="text-sm text-muted-foreground mb-1">
                      {transaccion.concepto}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(transaccion.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${
                        (transaccion.concepto === "Pago" || transaccion.concepto === "Adelanto" || transaccion.concepto === "Préstamo") 
                          ? "text-red-600" 
                          : "text-green-600"
                      }`}>
                        {formatCurrency(transaccion.valor)}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTransaction(transaccion)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeletingTransaction(transaccion)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modales */}
      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {deletingTransaction && (
        <DeleteTransactionModal
          isOpen={!!deletingTransaction}
          transaction={deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
        />
      )}
    </div>
  );
}