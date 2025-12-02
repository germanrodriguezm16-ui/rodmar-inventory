import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, ChevronDown } from "lucide-react";

interface DateFilterDropdownProps {
  buttonText: string;
  onApplyFilter: (filterType: string, startDate?: Date, endDate?: Date, sortOrder?: string) => void;
  currentFilter?: string;
  currentSort?: string;
}

const dateFilterOptions = [
  { value: "exactamente", label: "Exactamente" },
  { value: "entre", label: "Entre" },
  { value: "despues_de", label: "Después de" },
  { value: "antes_de", label: "Antes de" },
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "esta_semana", label: "Esta semana" },
  { value: "semana_pasada", label: "Semana pasada" },
  { value: "este_mes", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "este_año", label: "Este año" },
  { value: "año_pasado", label: "Año pasado" },
];

function DateFilterDropdown({ buttonText, onApplyFilter, currentFilter, currentSort }: DateFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const needsCustomDate = ["exactamente", "despues_de", "antes_de"].includes(selectedFilter);
  const needsDateRange = selectedFilter === "entre";
  const isPresetFilter = [
    "hoy", "ayer", "esta_semana", "semana_pasada", 
    "este_mes", "mes_pasado", "este_año", "año_pasado"
  ].includes(selectedFilter);

  const handleApply = () => {
    // Si no hay filtro seleccionado pero se cambió el ordenamiento, aplicar solo ordenamiento
    if (!selectedFilter) {
      onApplyFilter("all", undefined, undefined, sortOrder);
    } else if (isPresetFilter) {
      onApplyFilter(selectedFilter, undefined, undefined, sortOrder);
    } else if (needsCustomDate && startDate) {
      onApplyFilter(selectedFilter, new Date(startDate), undefined, sortOrder);
    } else if (needsDateRange && startDate && endDate) {
      onApplyFilter(selectedFilter, new Date(startDate), new Date(endDate), sortOrder);
    }
    setIsOpen(false);
    resetForm();
  };

  const handleClear = () => {
    onApplyFilter("all", undefined, undefined, "desc");
    setIsOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedFilter("");
    setStartDate("");
    setEndDate("");
    setSortOrder("desc");
  };

  const getCurrentFilterLabel = () => {
    if (!currentFilter || currentFilter === "all") return buttonText;
    const option = dateFilterOptions.find(opt => opt.value === currentFilter);
    const sortLabel = currentSort === "asc" ? "↑" : "↓";
    return option ? `${buttonText}: ${option.label} ${sortLabel}` : `${buttonText}: Filtro ${sortLabel}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={currentFilter && currentFilter !== "all" ? "default" : "outline"} 
          className="justify-between"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {getCurrentFilterLabel()}
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Tipo de filtro</Label>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar filtro" />
              </SelectTrigger>
              <SelectContent>
                {dateFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsCustomDate && (
            <div>
              <Label className="text-sm font-medium">Fecha</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {needsDateRange && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Fecha inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Fecha final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Sort Order */}
          <div>
            <Label className="text-sm font-medium">Ordenar por fecha</Label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Más reciente a más antiguo</SelectItem>
                <SelectItem value="asc">Más antiguo a más reciente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-2">
            {/* Botón para aplicar solo ordenamiento */}
            <Button
              onClick={() => {
                onApplyFilter("all", undefined, undefined, sortOrder);
                setIsOpen(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Aplicar ordenamiento
            </Button>
            
            {/* Botones para filtros */}
            <div className="flex gap-2">
              <Button
                variant="success"
                onClick={handleApply}
                disabled={
                  selectedFilter && (
                    (needsCustomDate && !startDate) ||
                    (needsDateRange && (!startDate || !endDate))
                  )
                }
                className="flex-1"
              >
                Aplicar filtro
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateFilterDropdown;